import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import { DEBUG_GAME_STATE } from '@/dev';
import type { AppScreen } from '@/engine/navigation/navigation';
import { randomRange } from '@/engine/utils/random';
import { waitFor } from '@/engine/utils/waitFor';
import { MAX_DT } from '@/main';
import type { PartIds } from '@/shared/serverTypes';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, type Ticker } from 'pixi.js';
import { Background, BACKGROUND_SLOTS } from './Background';
import { Balance } from './Balance';
import { BigTV } from './bigTV/BigTV';
import { DayTimer } from './dayTimer/DayTimer';
import { Drawing } from './drawing/Drawing';
import { decodeInkLayer } from './drawing/drawingEncoder';
import { Guessing } from './guessing/Guessing';
import { HintPanel } from './HintPanel';
import { Server } from './Server';
import { GameStates, type GameState, type GuessTarget, type VisitorData } from './types';

// Время между опросом сервера на уведомления (есть ли у нас отгаданные фотороботы)
const SPAWN_POLL_INTERVAL_MS = 15_000;

/** The screen that holds the app */
export class GameScreen extends Container implements AppScreen {
  /** Assets bundles required by this screen */
  public static assetBundles = ['main'];
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);

  // === Layers ===
  public mainContainer: Container;
  private background: Background;

  // === Systems / visuals ===
  private balance: Balance;
  private server: Server;
  private bigTV: BigTV;
  private drawing: Drawing;
  private guessing: Guessing;
  private dayTimer: DayTimer;
  private hintPanel: HintPanel;

  // === State ===
  private _state: GameState = DEBUG_GAME_STATE || GameStates.GAME_RESET;
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

    this.bigTV = new BigTV(this.balance);
    this.background.addObjectToSlot(BACKGROUND_SLOTS.BIG_MONITOR, this.bigTV.getTVSpine());

    this.drawing = new Drawing();
    this.background.addObjectToSlot(BACKGROUND_SLOTS.DRAWING_PAD, this.drawing.getDrawingPadSpine());

    this.background.addObjectToSlot(BACKGROUND_SLOTS.STAMP, this.drawing.getStampSpine());

    this.guessing = new Guessing(this.balance);
    this.background.addObjectToSlot(BACKGROUND_SLOTS.FAX, this.guessing.getFaxSpine());

    this.dayTimer = new DayTimer();
    this.background.addObjectToSlot(BACKGROUND_SLOTS.CLOCK, this.dayTimer.getTimerSpine());
    this.background.addObjectToSlot(BACKGROUND_SLOTS.CALENDAR, this.dayTimer.getTextContainer());

    this.hintPanel = new HintPanel();
    this.background.addObjectToSlot(BACKGROUND_SLOTS.HINT, this.hintPanel.getHintContainer());
    this.background.addObjectToSlot(BACKGROUND_SLOTS.POINTS, this.hintPanel.getPointsContainer());

    // TODO: на самом деле нужно подумать как конкретно разместить слои. Что-то будет под бэкграундом, что-то над ним. Реализовать в процессе внедрения ассетов.
    this.mainContainer.addChild(this.background, this.bigTV, this.guessing, this.dayTimer, this.hintPanel);

    this.wireCallbacks();
  }

  /** Проводки между системами.. */
  private wireCallbacks(): void {
    this.bigTV.onVisitorLeft = () => this.handleVisitorLeft();

    this.drawing.onSubmitted = (canvas, skins) => this.handlePhotofitSubmitted(canvas, skins);

    this.guessing.onFaxRequested = () => this.handleFaxRequested();
    this.guessing.onGuessMade = (correct, portraitId) => this.handleGuessMade(correct, portraitId);
  }

  // ==========================================================================
  // AppScreen lifecycle
  // ==========================================================================

  /** Prepare the screen just before showing */
  public prepare() {
    this.mainContainer.alpha = 0;
    this.setupEventHandlers();
    this.drawing.activate();

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
    const dt = Math.min(time.deltaMS * 0.001, MAX_DT);

    // Таймер дня
    this.dayTimer.update(dt);
    this.balance.dayTimeRemainingSec = this.dayTimer.getRemainingSec();

    // Видимые системы
    this.background.updateFrame(deltaMs);

    // FIXME: Syncronyze all dt!
    this.bigTV.update(dt);
    this.guessing.update(dt);
    this.drawing.update(dt);
    this.dayTimer.update(dt);

    // Логика стейта
    this.tickState(deltaMs);

    // Опрос сервера на уведомления
    this.notificationPollMs -= deltaMs;
    if (this.notificationPollMs <= 0) {
      this.notificationPollMs = SPAWN_POLL_INTERVAL_MS;
      this.pollNotifications();
    }

    // Конец дня
    // FIXME: нужно корректно настроить эту логику. Сейчас будет блочить игру.
    /* if (this.balance.isDayOver() && this.state !== GameStates.dayEnded) {
      this.endDay();
    } */
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
        // this.bigTV.triggerAlarm();
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

        // TODO: ПРОВЕРИТЬ ОТКЛЮЧЕНИЕ РИСОВАНИЯ
        this.startDay();

        // Проходит немного времени (таймер 1-2 секунды)
        await waitFor(randomRange(1, 2));

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

        // +++ Загорается лампочка на правом мониторе.
        // +++ Возможно что-то происходит с экраном.+++
        // Кнопка становится доступна для клика. +++
        this.bigTV.triggerAlarm();

        await this.bigTV.waitForCameraButtonPress();

        // Переходим на следующий стейт
        nextState = GameStates.visitorOnCamera;

        break;

      case GameStates.visitorOnCamera:
        // ОТОБРАЖАЕМ ПОСЕТИТЕЛЯ НА КАМЕРЕ.

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // +++ Показываем посетителя на камере
        // +++ Генерим рандомный скин
        this.bigTV.showVisitorOnCamera();
        // ---Возможно отбираем в этот момент управление? (ЭКСПЕРИМЕНТАЛЬНО)

        // +++++По идее, в этот-же момент должна включиться анимация вылезания папки.
        // ++++В зависимости от количества оставшихся папок, запускается анимация вылезания.
        await this.drawing.newDrawingPadUpAnimation();

        // TODO: РЕАЛИЗОВАТЬ
        // Уменьшаем каунтер папок.

        // Как только папка вылезла на столе и открылась, переходим на следующий стейт
        nextState = GameStates.readyToDraw;

        break;
      case GameStates.readyToDraw:
        // ПОЛЬЗОВАТЕЛЬ ПОЛУЧАЕТ ВОЗМОЖНОСТЬ РИСОВАТЬ

        // Отображаем подсказку.
        this.hintPanel.setHintForState(this.state);

        // +++ Запускается счётчик времени, пока посетитель будет находится на камере.
        // +++ Если пользователь ушёл, то выключаем отображение на телевизоре.
        this.bigTV.startVisitorStayTimer();

        // FIXME: РЕАЛИЗОВАТЬ
        // !!! Папка становится доступна для взаимодействия.
        // +++Если камера игрока при этом находится внизу, на папке, то лочим её.
        // +++Чтобы пользователь мог спокойно работать с рисованием.
        // +++Если пользователь уводит мышку в стороны (далеко от папки), то возвращаем управление камерой
        this.drawing.readyToDraw();

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
        this.drawing.enableStamp();

        /* setTimeout(() => {
          this.drawing.onStampButtonPressed();
        }, testDrawingTimeToLev); */

        // TODO: Ждём пока пользователь нажмёт на подтверждение
        await this.drawing.waitForStampButtonPress();

        // FIXME: ВЫКЛЮЧАЕМ ВОЗМОЖНОСТЬ РИСОВАТЬ
        this.drawing.deactivateDrawing();

        // TODO: РЕАЛИЗОВАТЬ
        // +++ Запускается анимация штампирования
        // +++ Добавляем в контейнер спрайт штампа
        await this.drawing.toPutStamp();

        // +++ Отправляем на сервер данные фоторобота.
        // +++ Получаем визитёра из BigTV
        this.sendDrawingResult(await this.drawing.getDrawingData(), this.bigTV.getCurrentVisitor());

        // +++ После этого запускается анимация закрытия и ухода папки.
        await this.drawing.closeDrawingPad();

        // FIXME: ОТВЯЗЫВАЕМ КАМЕРУ
        this.drawing.disableCameraLock();

        // +++ Увеличиваем очки и обновляем счётчик обслуженных посетителей.
        this.balance.visitorServed();
        this.hintPanel.setPoints(this.balance.getCurrentPoints());

        // ++++ Камера гаснет (если посетитель уже на камере, то потом просто скрываем его).
        this.bigTV.turnOffCamera();

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
        // ОБНОВЛЯЕМ СЧЁТЧИК ПАПОК НА ЭКРАНЕ

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
        // Запускается анимация бэкграунда (загорается свет над мониторами)
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

    // TODO: проверить что это всё устанавливается!!
    // Календарь показывает текущий день. ++
    // Время показывает 00 ++
    // КВОТА (под часами) показывает необходимую норму для этого дня. ++
    // Экраны ничего не показывают (надпись НО СИГНАЛ) (????) +++
    // Из контейнера для папки видна папка с бумагой (если она есть) (ЛОЛ ПРО ЭТО ЗАБЫЛИ!) Вместо этого папки просто не будет +++

    this.balance.startDay();
    this.dayTimer.startDay(this.balance.getDayDurationSec(), this.balance.day, this.balance.getDailyQuota());
    this.bigTV.resetForNewDay();
    this.drawing.resetForNewDay();
    this.spawnDelayMs = this.balance.getVisitorSpawnDelaySec();
  }

  // ==========================================================================
  // Callbacks (строго упорядочены по флоу игры)
  // ==========================================================================

  private handleVisitorLeft(): void {
    // Посетитель ушёл с камеры. Если игрок не успел подтвердить — лист остаётся
  }

  // FIXME: надо подумать куда деть эту логику получения данных. Может быть получать её из промиса в стейтмашине?
  private async handlePhotofitSubmitted(data: string, skins: PartIds): Promise<void> {
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
  private handleGuessMade(correct: boolean, portraitId: string): void {
    // Награда за угадывание
    // TODO: наверное это нужно как-то явно показать!
    this.balance.paperCount += this.balance.getRewardForGuessing(correct);
    void this.server.reportGuess(portraitId, correct);

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

  private async sendDrawingResult(drawingBase64: string, visitor: VisitorData): Promise<void> {
    // const base64String =
    //   'eJx9V0tPXVUUzrf23uec+wJaLhe4BQoU6EMLtIratAUu0hJaQmlJOjCmTpw4cOCoo06aNOpEB2pjNBpjfMUY48SZQ/+Cf8Df4MiRrm+vfe659HGAyzn7rL2+9fzWvv9e9MD9sC0ABGjCweEt8MqAWcABHd6j82aOgCYwEjBFCc9P2xtXDp1I+c4hXWFI+CylZLr0OUcOj0KfDgSeaAF1vnc1XVGzhhHKHarfm5WyX7Whilvjrz4naZQyLa7n0bo93a24CVVxPfU4SobK7mBIRcTcFeqHSaPEFtvmyh1lXKmz1rfmBuhhiPGNq0XEHzbMKn5CCLtqtTyBfRS9euVH0HW339H/6kXAULkueVx9ng2U3o6ZdU9YoQUlmeb86TYUA6uemrxZMtJfL55jRdGAuyaMqjuCjZTLQl8M1l0eI+A1z2mNNbQVEdSK47aeTeYDyHVITTsBm9W6G/QQpXdufAAxrkHqsFjJVmY5HE27xpO2UGpycDmYH1kX01Hg6JX3PTHUrERljRYJ1W3mZUSin83JzORh0aQka4B2XE22F0+JZRlDQTve+WoMVEM99r7b6Peus2prQcZhDGDpgjQL8zVm1z8DUfnJl5lP9guCFbJfj9lMXdI0xJgXGcB0TUma6K3zGKjdI7jAWAYJCZXZqdPbjcB1KWuwhdCxqAQxTRbheoqVYdbCM9AcS4SxbyRvA9DUlbBuFtVTzFvR7jbtr/eZM9RiXWlsQyKbMm4JK4wZUtP2ZaiEK0Culh3V6FeZ0BNhSeW0hfGMv7XSiytA3nL9+s6jToyZxiEfK6ZJdtuw1VaMU4j+tok6lBhKDI3616mthf40MGy1zLQNq4z638dwwy52foO9MkrDRlLcVB/Xr1KrKLa3Tua60YVMYMSYaIPRPG7zoW4ZameQ01Gr3/QWLb5pivpEPdmShXwjTeDQKCM+mlhWFm3mbZivrDFpAAXj4+bpQ4/SZ1PXymhiEDdnPUKcAJwpOrmuTxt6j/13tqyMdqoQB9+Vyl4PnAVydr+P83ZMK1H5FPCGLePlbkUbTh45oJdFDZMxozGTzUwLzm1Tx+lKiU5EHurzfbrnZ4++CBaB/ESZPzi2jaJncNdYc2dKJjshxnmpHyrTbFsSzy8A+UmLojVh9MbviEb6VNovc9VpxJjGIbRTTou5fNFVdDi4m1lENISqx6ZBsJsyVusab5wr+jpuxegrUC2WZQylstiF0qsDYX9F/zI0Ix8Aa4z93ei1N4nEDD7+fVY+uDRUjOYD/OcQclKaTVmK/RepgOwQiPI1UHxNrIHzwDclXacrkWL2I/81ErP+VjHP7v7u4K9R/DALFH8gEXr4nb7rSRO/pCSRUuRnZEO6P/8uLh9TOwTuW4j2YkPgv4qOjGjJZl9SSGIXPtY3KtamxGPIcdHq/DTq0jNLF3CfaNdOA24V9/wxADN8/bEuz+rYFOD9mCg9KfPcLR+A03nh/6HwoWINKW8IxfSscIrj9hEN0zfuUXyzxCg/rIjFweyABxIZbRGQUHT4cKBysijkSy2bRuWUnu+Ze8A8P+uBsfdlPwHuhkSkBWmkk1gwGSkbjN11DZC2nNJvGumUBWBKUPRkDOwvtHHa2EK1XOKt8o7uWreifg2Qjqj06+SSNekQ/6ZjnSs/0N59g19RDiXuOSz4Va51CHEyHoAmgCVZkS6AuZS4o99UrBAXsArIpMyzCiLlLvjzluhZp/GdpG0OL7hu9ATKQyOAdHWfLItTyFo8p42I2HltTpYBmU2topaJ0wpE183Rnhdlka0GtEStnAarBSvgVPHVM+Aw4LoyK3DLcj76U+jOYZkCZBqQC4Cs9D3lf62/Kf2jBcsALnMy61c+sikuym0A09INL3PTHiJndUzJS/Z+Iqxx5ZbMMO/AJbkj026UtfEqYu1FzTqXL8shZtRugVwBcIddQqJ1ejY61Dh6zmzoyfDAcAsHt0l5YEYKiNuSQ0YlEKln705KIpJtQG5jzmbGdXebO5HfFGBfUflmD3D7FOG8USm/h/Ecchfwu5af6PQbFsIdzXINuOeB60KiMhp7m3dbaPK70jvsx55kdmp614jqSjSRVr5nxHYZfdq871Bf4zeqBzHYgleUSB+yxVokOXniJwAfDdCpswng0ywmk/60hF/n8c8k/gQe1fE9sPofxs5zBw==';

    const padding = drawingBase64.endsWith('==') ? 2 : drawingBase64.endsWith('=') ? 1 : 0;
    const sizeInKB = (drawingBase64.length * 0.75 - padding) / 1024;

    console.log('Размер фоторобота в КБ:', sizeInKB);
    console.log('Получены данные с рисовалки:', drawingBase64, JSON.stringify(visitor.skins));

    const dataToSubmit = {
      imageBase64: drawingBase64,
      partIds: visitor.skins,
    };

    engine()
      .server.submitPortrait(dataToSubmit)
      .then((response) => {
        console.log('Ответ от сервера на отправку фоторобота:', response);
      });
  }

  private async getRandomResult(): Promise<void> {
    let randomPhoto = await engine().server.getRandomPortrait();

    // FIXME: ТЕСТИРОВАНИЕ КОНТЕЙНЕРА С ЧЁРНЫМ ФОНОМ
    randomPhoto = null;

    if (!randomPhoto) {
      console.warn('Не удалось получить случайный фоторобот');

      // FIXME: нужно учеть вероятность того что фотки не будет. Что в этом случае???
      const fallBackBase =
        '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';

      randomPhoto = {
        portraitId: 'test-id',
        authorName: 'test-author',
        authorId: 'test-author-id',
        imageBase64: fallBackBase,
        partIds: {
          head: 1,
          body: 1,
          nose: 1,
          ear: 1,
          eye: 1,
          mouth: 1,
          brow: 1,
        },
      };
    }

    const canvas = await decodeInkLayer(randomPhoto.imageBase64);

    const data: GuessTarget = {
      portraitId: randomPhoto.portraitId,
      authorNickname: randomPhoto.authorName,
      canvasData: canvas, // готовая картинка, не пересобираем
      originalSkins: randomPhoto.partIds, // правильный ответ
    };

    this.guessing.presentTarget(data);
  }

  // ==========================================================================
  // Input
  // ==========================================================================

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'KeyK') {
      e.preventDefault();

      // this.showDrawingResult();
    }

    if (e.code === 'KeyL') {
      e.preventDefault();

      this.getRandomResult();
    }
  }

  private onPointerDown(_e: FederatedPointerEvent) {}

  private onPointerMove(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);
    this.background.updateMouse(x, y, this.drawing.getHolstCenterVirtual());
  }

  private setupEventHandlers() {
    this.on('pointermove', this.boundOnPointerMove);
    this.on('pointerdown', this.boundOnPointerDown);
    document.addEventListener('keydown', this.boundOnKeyDown);
    this.eventMode = 'static';
  }

  private cleanupEventHandlers() {
    this.off('pointermove', this.boundOnPointerMove);
    this.off('pointerdown', this.boundOnPointerDown);
    document.removeEventListener('keydown', this.boundOnKeyDown);
  }
}
