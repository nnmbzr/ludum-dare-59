import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import type { AppScreen } from '@/engine/navigation/navigation';
import { waitFor } from '@/engine/utils/waitFor';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, type Ticker } from 'pixi.js';
import { Background } from './Background';
import { Balance } from './Balance';
import { DayTimer } from './DayTimer';
import { Drawing } from './Drawing';
import { Guessing } from './Guessing';
import { HintPanel } from './HintPanel';
import { Server } from './Server';
import { Visitor } from './Visitor';
import { GameStates, type GameState, type GuessTarget, type SkinSet } from './types';

// Время между опросом сервера на уведомления (есть ли у нас отгаданные фотороботы)
const SPAWN_POLL_INTERVAL_MS = 15_000;

/** The screen that holds the app */
export class GameScreen extends Container implements AppScreen {
  /** Assets bundles required by this screen */
  public static assetBundles = ['main'];
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerDown = this.onPointerDown.bind(this);

  // === Layers ===
  public mainContainer: Container;
  private background: Background;

  // === Systems / visuals ===
  private balance: Balance;
  private server: Server;
  private visitor: Visitor;
  private drawing: Drawing;
  private guessing: Guessing;
  private dayTimer: DayTimer;
  private hintPanel: HintPanel;

  // === State ===
  private _state: GameState = GameStates.GAME_RESET;
  private spawnDelayMs = 0;
  private notificationPollMs = 0;
  private paused = false;

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    // Менеджеры
    this.balance = new Balance();
    this.server = new Server();

    // Игровые объекты
    this.background = new Background();
    this.visitor = new Visitor(this.balance);
    this.drawing = new Drawing();
    this.guessing = new Guessing(this.balance);
    this.dayTimer = new DayTimer();
    this.hintPanel = new HintPanel();

    // TODO: на самом деле нужно подумать как конкретно разместить слои. Что-то будет под бэкграундом, что-то над ним. Реализовать в процессе внедрения ассетов.
    this.mainContainer.addChild(
      this.background,
      this.visitor,
      this.drawing,
      this.guessing,
      this.dayTimer,
      this.hintPanel,
    );

    this.wireCallbacks();
  }

  /** Проводки между системами.. */
  private wireCallbacks(): void {
    this.visitor.onVisitorLeft = () => this.handleVisitorLeft();

    this.drawing.onSubmitted = (canvas, skins) => this.handlePhotofitSubmitted(canvas, skins);

    this.guessing.onFaxRequested = () => this.handleFaxRequested();
    this.guessing.onGuessMade = (correct, author) => this.handleGuessMade(correct, author);
  }

  // ==========================================================================
  // AppScreen lifecycle
  // ==========================================================================

  /** Prepare the screen just before showing */
  public prepare() {
    this.mainContainer.alpha = 0;
    this.setupEventHandlers();

    // TODO: загрузить baked photofits из ассетов и передать в server.setBakedPhotofits(...)

    // TODO: нужно подумать. Потому что может быть лучше вместо того чтобы оставаться в GameScreen, таки переходить в другой экран. Просто чистить и так далее.
    //  В этом случае нужно будет добавить сюда приравнивание this._state = GameStates.GAME_RESET
    // Ну и убедиться что в функции this.reset() мы тоже всё чистим и приравниваем к начальному состоянию.
    this.goToNextState();
  }

  public async show(): Promise<void> {
    await gsap.to(this.mainContainer, { alpha: 1, duration: 0.5 });
  }

  public async hide(): Promise<void> {
    await gsap.to(this.mainContainer, { alpha: 0, scale: 5, duration: 0.5 });
  }

  public update(time: Ticker): void {
    if (this.paused) return;
    const deltaMs = time.deltaMS;

    // Таймер дня
    this.dayTimer.update(deltaMs);
    this.balance.dayTimeRemainingMs = this.dayTimer.getRemainingMs();

    // Видимые системы
    this.background.updateFrame(deltaMs);
    this.visitor.update(deltaMs);

    // Логика стейта
    this.tickState(deltaMs);

    // Опрос сервера на уведомления
    this.notificationPollMs -= deltaMs;
    if (this.notificationPollMs <= 0) {
      this.notificationPollMs = SPAWN_POLL_INTERVAL_MS;
      this.pollNotifications();
    }

    // Конец дня
    if (this.balance.isDayOver() && this.state !== GameStates.dayEnded) {
      this.endDay();
    }
  }

  /** Resize the screen, fired whenever window size changes */
  public resize(_width: number, _height: number) {}

  /** Fully reset */
  public reset() {
    this.cleanupEventHandlers();
  }

  public async pause(): Promise<void> {
    this.mainContainer.interactiveChildren = false;
    this.paused = true;
  }

  public async resume(): Promise<void> {
    this.mainContainer.interactiveChildren = true;
    this.paused = false;
  }

  public blur(): void {
    if (!engine().navigation.currentPopup) {
      engine().navigation.presentPopup(PausePopup);
    }
  }

  // ==========================================================================
  // Flow
  // ==========================================================================

  private tickState(deltaMs: number): void {
    if (this.state !== GameStates.waitingForVisitor) return;

    // Если бумага кончилась — в режим угадывания, посетители не приходят
    if (this.balance.paperCount === 0) {
      // TODO: включить мигание факса (guessing.enableFax()), если ещё не включено
      // Посетителей не спавним — возвращаемся
      return;
    }

    if (this.spawnDelayMs > 0) {
      this.spawnDelayMs -= deltaMs;
      if (this.spawnDelayMs <= 0) {
        this.visitor.triggerAlarm();
        // FIXME: сейчас мы считаем прямо тут, внутри. Вместо этого нужно перенести логику старта и расчёта задержки в visitor
        // this.setState(GameStates.alarmOn);
      }
    }
  }

  // ВАЖНО! Все изменения стейта должны идти через setState. Получать через this.state. Устанавливать через this._state где-то кроме этого места нельзя!
  // Суть в том, что вся логика переходов будет решаться в рамках этого метода.
  // setState асинхронный специально, чтобы можно было встраивать анимации и прочие эффекты и дожидаться их завершения.
  // Дожидаемся окончания стейтов именно в этом стейте и тут-же переходим на следующий.
  // Нужно правда подумать как лучше организовать прерывание очереди. Возможно будем проверять прямо на входе.
  private async goToNextState(): Promise<void> {
    //

    console.log('Текущий стейт:', this.state);

    let nextState: GameState | undefined;

    // TODO: ВНЕДРИТЬ ПРОВЕРКУ ЕСЛИ ВРЕМЯ ЗАКОНЧИЛОСЬ
    // this._state = GameStates.dayEnded

    switch (this.state) {
      case GameStates.GAME_RESET:
        // РЕСЕТОВЫЙ СТЕЙТ ПРИ СТАРТЕ ИГРЫ.
        // Нужен просто чтобы зациклить флоу.

        // Переходим на следующий стейт
        nextState = GameStates.readyToStartDay;
        break;

      case GameStates.readyToStartDay:
        // ЖДЁМ НАЧАЛА ДНЯ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: проверить что это всё устанавливается!!
        // Календарь показывает текущий день.
        // Время показывает 00
        // КВОТА (под часами) показывает необходимую норму для этого дня.
        // Экраны ничего не показывают (надпись НО СИГНАЛ)
        // Из контейнера для папки видна папка с бумагой (если она есть)
        this.startDay();

        // Проходит немного времени (таймер 3-4 секунды)
        await waitFor(3);

        // Переходим на следующий стейт
        nextState = GameStates.waitingForVisitor;
        break;

      case GameStates.waitingForVisitor:
        // ЖДЁМ СЛЕДУЮЩЕГО ПОСЕТИТЕЛЯ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // Запускается таймер ожидания нового посетителя.
        await waitFor(this.balance.getVisitorSpawnDelaySec());

        // Переходим на следующий стейт
        nextState = GameStates.alarmOn;

        break;
      case GameStates.alarmOn:
        // ЛАМПОЧКА ГОРИТ, ЖДЁМ КЛИК ПО КНОПКЕ КАМЕРЫ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ (по аналогии с startDay, чтобы не раздувать стейтмашину)
        // Загорается лампочка на правом мониторе.
        // Возможно что-то происходит с экраном.

        // Кнопка становится доступна для клика.
        // FIXME: тестово делаем по ней "клик". Нужно будет выпилить и реализовать через кнопку!!!
        setTimeout(() => {
          this.visitor.onCameraButtonPressed();
          console.log('Кнопка на камере нажата!');
        }, 2000);
        // Ждём пока пользователь не кликнет по кнопке камеры.
        await this.visitor.waitForCameraButtonPress();

        // Переходим на следующий стейт
        nextState = GameStates.visitorOnCamera;

        break;

      case GameStates.visitorOnCamera:
        // ОТОБРАЖАЕМ ПОСЕТИТЕЛЯ НА КАМЕРЕ.

        // TODO: РЕАЛИЗОВАТЬ
        // Запускается счётчик времени, пока посетитель будет находится на камере.
        // Если пользователь ушёл, то выключаем отображение на телевизоре.

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ (по аналогии с startDay, чтобы не раздувать стейтмашину)
        // Возможно отбираем в этот момент управление? (ЭКСПЕРИМЕНТАЛЬНО)
        // По идее, в этот-же момент должна включиться анимация вылезания папки.
        // Уменьшаем каунтер папок.
        // В зависимости от количества оставшихся папок, запускается анимация вылезания.
        await waitFor(5); // FIXME: Эмуляция этих вот всех процессов.

        // Как только папка вылезла на столе и открылась, переходим на следующий стейт
        nextState = GameStates.readyToDraw;

        break;
      case GameStates.readyToDraw:
        // ПОЛЬЗОВАТЕЛЬ ПОЛУЧАЕТ ВОЗМОЖНОСТЬ РИСОВАТЬ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Папка становится доступна для взаимодействия.
        // Если камера игрока при этом находится внизу, на папке, то лочим её.
        // Чтобы пользователь мог спокойно работать с рисованием.
        // Если пользователь уводит мышку в стороны (далеко от папки), то возвращаем управление камерой

        // FIXME: тестово делаем взаимодействие с рисованием.
        setTimeout(() => {
          this.drawing.onDrawingFirstInteraction();
        }, 2000);
        // Ждём пока пользователь начнёт взаимодействие с рисованием (или там, например, начнёт рисовать).
        await this.drawing.waitForUserFirstInteractWithDrawing();

        // переходим на следующий стейт
        nextState = GameStates.readyToAccept;

        break;
      case GameStates.readyToAccept:
        // ЖДЁМ ПОДТВЕРЖДЕНИЯ ЧТО ФОТОРОБОТ ГОТОВ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // Разблокируется штамп.
        // FIXME: тестово эмулируем нажатие на штамп.
        setTimeout(() => {
          this.drawing.onStampButtonPressed();
        }, 2000);

        // TODO: Ждём пока пользователь нажмёт на подтверждение
        await this.drawing.waitForStampButtonPress();

        // TODO: РЕАЛИЗОВАТЬ
        // После этого запускается анимация закрытия и ухода папки.
        // Увеличивается счётчик обслуженных посетителей.
        // Камера гаснет (если посетитель уже на камере, то потом просто скрываем его).
        // Сейчас просто эмулируем все эти анимации
        await waitFor(3);

        // Переходим на следующий стейт
        nextState = GameStates.decideWhatNext;

        break;
      case GameStates.decideWhatNext:
        // РЕШАЕМ ЧТО ДЕЛАТЬ ДАЛЬШЕ
        // перейти на waitingForVisitor или на outOfPaper

        // Показываем подсказку.
        this.hintPanel.setHintForState(this.state);

        // Вычитаем счётчик папок.
        // TODO: возможно лучше делать это в соответствующем классе.
        // вместе с запуском анимаций итд.
        this.balance.paperCount--;

        // Если папки ещё есть, переходим на 2 waitingForVisitor
        if (this.balance.paperCount > 0) {
          nextState = GameStates.waitingForVisitor;
        } else {
          nextState = GameStates.outOfPaper;
        }

        break;

      case GameStates.outOfPaper:
        // БУМАГА КОНЧИЛАСЬ, ЖДЁМ КЛИКА ПО ФАКСУ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: У факса активируется кнопка для запроса бумаги.
        // FIXME: тестово эмулируем нажатие на факс.
        setTimeout(() => {
          this.guessing.onFaxButtonPressed();
        }, 2000);

        // TODO: Ждём пока пользователь нажмёт на кнопку факса
        await this.guessing.waitForFaxButtonPress();

        // Переходим на следующий стейт
        nextState = GameStates.waitForServerResponse;

        break;
      case GameStates.waitForServerResponse:
        // ЖДЁМ ОТВЕТА ОТ СЕРВЕРА

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Запускаем анимацию ожидания у факса (тряска или чёт такое).

        // TODO: РЕАЛИЗОВАТЬ
        // Делаем запрос на сервер. Пока просто эмулируем его авэйтом.
        await waitFor(3);

        // Переходим на следующий стейт.
        nextState = GameStates.showPhotophil;

        break;
      case GameStates.showPhotophil:
        // ПОКАЗЫВАЕМ ФОТОРОБОТ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Серверный ответ преобразуется в картинку и помещшается в контейнер.
        // Запускается анимация получения фоторобота.
        // После этого запускаются мониторы с подозреваемыми.
        // В них передаём информацию о целевом подозреваемом.
        // FIXME: тестово эмулируем всё это время делеем.
        await waitFor(3);

        // После этого переходим на следующий стейт
        nextState = GameStates.guessing;

        break;
      case GameStates.guessing:
        // ПОЛЬЗОВАТЕЛЬ УГАДЫВАЕТ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: Кнопки выбора становятся активны.
        // FIXME: тестово эмулируем нажатие на кнопку выбора.
        setTimeout(() => {
          this.guessing.onGuessButtonPressed();
        }, 2000);

        // TODO: Ждём пока пользователь нажмёт на кнопку выбора
        await this.guessing.waitForGuessButtonPress();
        // Ждём пока пользователь сделает выбор.

        // После этого переходим на
        nextState = GameStates.showGuessingResult;

        break;

      case GameStates.showGuessingResult:
        // ПОКАЗЫВАЕМ РЕЗУЛЬТАТ УГАДЫВАНИЯ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Показываем анимацию результата угадывания.
        // Отображаем надпись "РЕЗУЛЬТАТ: %RESULT%"
        // Увеличиваем квоту (если угадал) и добавляем бумагу на счётчик (обновляем счётчик папок).

        // Запускается анимация появления папки в дыре (?)

        // Эмулируем время показа результата угадывания
        await waitFor(3);

        // После этого переходим на базовый стейт ожидания следующего посетителя
        nextState = GameStates.waitingForVisitor;

        break;
      case GameStates.dayEnded:
        // ВРЕМЯ ЗАКОНЧИЛОСЬ, ДЕНЬ ПРОШЁЛ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Проходимся по всем объектам/системам, сбрасываем промисы, останавливаем анимации, скрываем итд итп
        // Отбираем управление,
        // перемещаем камеру в центр.

        // TODO: РЕАЛИЗОВАТЬ
        // Запускается анимация вычитания КВОТЫ из суммы набранных.
        // Если квота меньше, цифры становятся красными.
        // Эмуляция этой анимации
        await waitFor(3);

        // TODO: УТОЧНИТЬ РЕАЛИЗАЦИЮ
        if (this.balance.isQuotaMet()) {
          // Если квота выполнена, то переходим к завершению дня
          nextState = GameStates.wellDone;
        } else {
          // Если квота не выполнена, то переходим в геймовер
          nextState = GameStates.gameOver;
        }
        break;

      case GameStates.gameOver:
        // НЕ ВЫПОЛНИЛИ НОРМУ, ИГРА ОКОНЧЕНА

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Запускается какая-то анимация, надписи сигнал потерян итд.
        // Эмуляция этой анимации
        await waitFor(3);

        // TODO: РЕАЛИЗОВАТЬ
        // Показываем экран (попап) проигрыша
        // После него (или во время него, нужно подумать как удобнее было бы сделать)
        // Вызывается функция проигрыша в балансе, которая ресетит показатели.
        // Игра начинается заново (переходим в стейт готовности к началу дня)

        // Переходим в начало дня
        nextState = GameStates.readyToStartDay;

        break;
      case GameStates.wellDone:
        // ВЫПОЛНИЛИ НОРМУ, ДЕНЬ ЗАВЕРШЁН УСПЕШНО

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // TODO: РЕАЛИЗОВАТЬ
        // Экран гаснет. Возможно раздаётся какой-то звук?
        // Вызывается функция увеличивающая день в балансе. Возможно что-то ещё.
        await waitFor(3);

        // Переходим в начало дня
        nextState = GameStates.readyToStartDay;

        break;
    }

    const prevState = this.state;
    this._state = nextState ? nextState : GameStates.GAME_RESET;

    if (this._state === GameStates.GAME_RESET) {
      throw new Error('СТЕЙТ РЕСЕТА!! Что-то пошло не так! Предыдущий стейт: ' + prevState);
    }

    // Зацикливаем стейтмашину.
    this.goToNextState();
  }

  private get state(): GameState {
    return this._state;
  }

  /// //////////////// GameStates.readyToStartDay
  private startDay(): void {
    // TODO: проверить, всё ли тут ок и что тут происходит. Например явно таймер spawnDelayMs нужно запускать в визитёре.
    // А вот запускать дневной таймер как будто бы вполне можно и тут.
    this.balance.startDay();
    this.dayTimer.startDay(this.balance.getDayDurationMs(), this.balance.day);
    this.spawnDelayMs = this.balance.getVisitorSpawnDelaySec();
  }

  // ==========================================================================
  // Callbacks (строго упорядочены по флоу игры)
  // ==========================================================================

  private handleVisitorLeft(): void {
    // Посетитель ушёл с камеры. Если игрок не успел подтвердить — лист остаётся
  }

  // FIXME: надо подумать куда деть эту логику получения данных. Может быть получать её из промиса в стейтмашине?
  private async handlePhotofitSubmitted(data: string, skins: SkinSet): Promise<void> {
    // Получаем фоторобот в виде base64
    const base64 = data; // заглушка

    // TODO: нужно ли реализоввать квоту тут или где-то ещё?
    // this.balance.quotaCompleted++;
    void this.server.submitPhotofit(base64, skins); // fire-and-forget
  }

  // FIXME: аналогично
  private async handleFaxRequested(): Promise<void> {
    let target: GuessTarget;
    try {
      target = await this.server.fetchPhotofitToGuess();
    } catch (e) {
      console.warn('Fax fetch failed', e);
      return;
    }
    await this.guessing.presentTarget(target);
  }

  // FIXME: аналогично
  private handleGuessMade(correct: boolean, targetAuthor: string): void {
    // Награда за угадывание
    // TODO: наверное это нужно как-то явно показать!
    this.balance.paperCount += this.balance.getRewardForGuessing(correct);
    void this.server.reportGuess(targetAuthor, correct);

    void this.guessing.dismiss().then(() => {
      // this.spawnDelayMs = this.balance.getVisitorSpawnDelaySec();
    });
  }

  // TODO: Вот это интересная тема. Вполне можно как-то использовать её вне стейтмашины. Главное чтобы мы не попали сюда во время какого-то другого стейта.
  // Может быть ВООБЩЕ отказаться от такого опроса и просто получать эту информацию после того как мы отправим фоторобот на сервер?
  // Да, как будто бы это было сорт офф проще/оптимальнее. Но мы всё равно не будем получать ответ мгновенно. Может быть вместе с получением нового фоторобота?
  // ДА! Там мы как раз ждём и заодно можно давать какой-то бонус за то что фоторобот угадали. Бесплатные бумаги и выполнение квоты?
  private async pollNotifications(): Promise<void> {
    const nickname = await this.server.pollMyPhotofitGuessed();
    if (nickname) {
      // TODO: показать плашку "твой фоторобот угадал @nickname"
      // Наградить игрока (например, +1 бумага)
      // this.paper.add(1);
    }
  }

  // FIXME: кал какой-то. Это вообще всё переносится в стейтмашину.
  private endDay(): void {
    if (this.balance.isQuotaMet()) {
      this.balance.day++;
      this.dayTimer.advanceCalendar(this.balance.day);
      // TODO: показать экран "день прошёл", по кнопке — startDay() снова
    } else {
      // TODO: показать экран геймовера со статистикой, кнопка рестарта вызывает this.balance.reset() + startDay()
    }
  }

  // ==========================================================================
  // Input
  // ==========================================================================

  private onPointerDown(_e: FederatedPointerEvent) {}

  private onPointerMove(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);
    this.background.updateMouse(x, y);
  }

  private setupEventHandlers() {
    this.on('pointermove', this.boundOnPointerMove);
    this.on('pointerdown', this.boundOnPointerDown);
    this.eventMode = 'static';
  }

  private cleanupEventHandlers() {
    this.off('pointermove', this.boundOnPointerMove);
    this.off('pointerdown', this.boundOnPointerDown);
  }
}
