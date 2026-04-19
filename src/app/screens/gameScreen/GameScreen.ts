import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import type { AppScreen } from '@/engine/navigation/navigation';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, type Ticker } from 'pixi.js';
import { Background } from './Background';
import { Balance } from './Balance';
import { DayTimer } from './DayTimer';
import { GameDrawingBoard } from './GameDrawingBoard';
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
  private drawing: GameDrawingBoard;
  private guessing: Guessing;
  private dayTimer: DayTimer;
  private hintPanel: HintPanel;

  // === State ===
  private state: GameState = GameStates.readyToStartDay;
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
    this.drawing = new GameDrawingBoard();
    this.guessing = new Guessing(this.balance);
    this.dayTimer = new DayTimer();
    this.hintPanel = new HintPanel();

    // TODO: на самом деле нужно подумать как конкретно разместить слои. Что-то будет под бэкграундом, что-то над ним. Реализовать в процессе внедрения ассетов.
    this.mainContainer.addChild(this.background, this.visitor, this.guessing, this.dayTimer, this.hintPanel);
    this.background.mountDrawingBoard(this.drawing);

    this.wireCallbacks();
  }

  /** Проводки между системами.. */
  private wireCallbacks(): void {
    this.visitor.onCameraButtonPressed = () => this.handleCameraButtonPressed();
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
    this.drawing.activate();

    // TODO: загрузить baked photofits из ассетов и передать в server.setBakedPhotofits(...)
    this.startDay();
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
    this.drawing.tick(time);
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

  private startDay(): void {
    this.balance.startDay();
    this.dayTimer.startDay(this.balance.getDayDurationMs(), this.balance.day);
    this.setState(GameStates.waitingForVisitor);
    this.spawnDelayMs = this.balance.getVisitorSpawnDelayMs();
  }

  private tickState(deltaMs: number): void {
    if (this.state !== GameStates.waitingForVisitor) return;

    // Если бумага кончилась — в режим угадывания, посетители не приходят
    if (this.balance.paperCount === 0) {
      // TODO: включить мигание факса (guessing.enableFax()), если ещё не включено
      // Посетителей не спавним — возвращаемся
      return;
    }

    this.spawnDelayMs -= deltaMs;
    if (this.spawnDelayMs <= 0) {
      this.visitor.triggerAlarm();
      this.setState(GameStates.alarmOn);
    }
  }

  private setState(next: GameState): void {
    this.state = next;
    this.hintPanel.setHintForState(next);
    // TODO: если нужны глобальные визуальные реакции на переход — сюда
  }

  // ==========================================================================
  // Callbacks (строго упорядочены по флоу игры)
  // ==========================================================================

  private handleCameraButtonPressed(): void {
    if (this.state !== GameStates.alarmOn) return;
    this.visitor.showOnCamera();
    this.setState(GameStates.visitorOnCamera);
    // Игрок теперь может пойти на планшет и начать рисовать.
    // Начало рисования = первое касание стилуса по планшету.
    // Для простоты: сразу даём лист и переводим в drawing.
    const v = this.visitor.getCurrentVisitor();
    if (v) {
      this.drawing.beginNewSheet(v.skins);
      this.setState(GameStates.readyToDraw);
    } else {
      throw new Error('Camera button pressed but no visitor data!!!!');
    }
  }

  private handleVisitorLeft(): void {
    // Посетитель ушёл с камеры. Если игрок не успел подтвердить — лист остаётся
  }

  private async handlePhotofitSubmitted(data: string, skins: SkinSet): Promise<void> {
    // Получаем фоторобот в виде base64
    const base64 = data; // заглушка

    this.balance.quotaCompleted++;
    void this.server.submitPhotofit(base64, skins); // fire-and-forget

    // Возвращаемся в ожидание следующего посетителя
    this.spawnDelayMs = this.balance.getVisitorSpawnDelayMs();
    this.setState(GameStates.waitingForVisitor);
  }

  private async handleFaxRequested(): Promise<void> {
    this.setState(GameStates.guessing);
    let target: GuessTarget;
    try {
      target = await this.server.fetchPhotofitToGuess();
    } catch (e) {
      console.warn('Fax fetch failed', e);
      this.setState(GameStates.waitingForVisitor);
      return;
    }
    await this.guessing.presentTarget(target);
  }

  private handleGuessMade(correct: boolean, targetAuthor: string): void {
    // Награда за угадывание
    // TODO: наверное это нужно как-то явно показать!
    this.balance.paperCount += this.balance.getRewardForGuessing(correct);
    void this.server.reportGuess(targetAuthor, correct);

    void this.guessing.dismiss().then(() => {
      this.setState(GameStates.waitingForVisitor);
      this.spawnDelayMs = this.balance.getVisitorSpawnDelayMs();
    });
  }

  private async pollNotifications(): Promise<void> {
    const nickname = await this.server.pollMyPhotofitGuessed();
    if (nickname) {
      // TODO: показать плашку "твой фоторобот угадал @nickname"
      // Наградить игрока (например, +1 бумага)
      // this.paper.add(1);
    }
  }

  private endDay(): void {
    if (this.balance.isQuotaMet()) {
      this.setState(GameStates.dayEnded);
      this.balance.day++;
      this.dayTimer.advanceCalendar(this.balance.day);
      // TODO: показать экран "день прошёл", по кнопке — startDay() снова
    } else {
      this.setState(GameStates.gameOver);
      // TODO: показать экран геймовера со статистикой, кнопка рестарта вызывает this.balance.reset() + startDay()
    }
  }

  // ==========================================================================
  // Input
  // ==========================================================================

  private onPointerDown(_e: FederatedPointerEvent) {}

  private onPointerMove(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);
    this.background.updateMouse(x, y, this.drawing.getHolstCenterVirtual());
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
