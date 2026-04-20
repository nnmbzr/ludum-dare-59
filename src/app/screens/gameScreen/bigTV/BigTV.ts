import { Container } from 'pixi.js';
import { type Balance } from '../Balance';
import { type VisitorData } from '../types';
import { TVController, TvSlots } from './TVController';
import { VisitorManController } from './VisitorManController';

/**
 * Всё, что относится к правому монитору:
 *  - сборный спайн-персонаж (скины включаются по VisitorData)
 *  - лампочка сигнализации
 *  - кнопка включения камеры
 *  - эффект "НЕТ СИГНАЛА" когда посетитель ушёл
 *
 * Логика появления (когда и какого) — снаружи, из GameScreen.
 */
export class BigTV extends Container {
  private currentVisitor: VisitorData | null = null;
  private stayTimerSec = 0;
  private gameBalance: Balance;

  private visitorSpine: VisitorManController;
  private tvSpine: TVController;

  // Ожидание нажатия кнопки камеры: создается в waitForCameraButtonPress и резолвится в onCameraButtonPressed.
  private cameraButtonPressPromise: Promise<void> | null = null;
  private resolveCameraButtonPress: (() => void) | null = null;

  /** Коллбэки наружу. Назначаются из GameScreen при инициализации. */
  public onVisitorLeft: () => void = () => {};

  constructor(balance: Balance) {
    super();

    this.gameBalance = balance;

    this.visitorSpine = new VisitorManController();
    this.tvSpine = new TVController();
    // TODO:
    // - создать Spine-объект с пустым набором скинов
    // - создать лампочку (Sprite с gsap-мигалкой)
    // - создать кнопку камеры (interactive Sprite)
    // - привязать кнопку к onCameraButtonPressed
    // - скрыть всё кроме кнопки/лампочки
  }

  /**
   * Сгенерировать посетителя и включить лампочку.
   * Посетитель НЕ виден, пока игрок не нажмёт кнопку камеры.
   */
  public triggerAlarm(): void {
    this.currentVisitor = this.generateVisitor();
    this.tvSpine.playAlarm();
    // TODO: включить мигание лампочки
  }

  // Этот метод дожидается, пока игрок не нажмёт кнопку камеры.
  // Вызывается из стейтмашины.
  public waitForCameraButtonPress(): Promise<void> {
    if (!this.cameraButtonPressPromise) {
      this.cameraButtonPressPromise = new Promise<void>((resolve) => {
        this.resolveCameraButtonPress = resolve;
      });
    }
    return this.cameraButtonPressPromise;
  }

  // FIXME: Временная заглушка для будущего callback интерактивной кнопки.
  public onCameraButtonPressed(): void {
    if (!this.resolveCameraButtonPress) return;

    this.resolveCameraButtonPress();
    this.resolveCameraButtonPress = null;
    this.cameraButtonPressPromise = null;
  }

  /** Игрок нажал кнопку камеры — анимация показа посетителя */
  public async showVisitorOnCamera(): Promise<void> {
    if (!this.currentVisitor) return;
    this.stayTimerSec = this.currentVisitor.staySec;

    // TODO:
    // - применить skins к спайну
    // - проиграть idle-анимацию
    this.tvSpine.addVisitorToSlot(TvSlots.PORTRAITS, this.visitorSpine);
    this.visitorSpine.showCharacter();
    // - выключить лампочку
    this.tvSpine.stopAlarm();
    // - показать экран камеры (убрать заглушку "выключено")
  }

  public turnOffCamera(): void {
    this.visitorSpine.hideCharacterInstance();
    this.tvSpine.removeVisitorFromSlot(this.visitorSpine);
  }

  public update(dt: number): void {
    if (this.stayTimerSec > 0) {
      this.stayTimerSec -= dt;
      if (this.stayTimerSec <= 0) {
        this.showNoSignal();
        this.onVisitorLeft();
      }
    }

    this.visitorSpine.update(dt);
    this.tvSpine.update(dt);
  }

  private async showNoSignal(): Promise<void> {
    // TODO: показать помехи + надпись "НЕТ СИГНАЛА", gsap-анимация + выключить спайн
    this.currentVisitor = null;

    await this.visitorSpine.playHideCharacterAnimation();
    this.tvSpine.removeVisitorFromSlot(this.visitorSpine);
  }

  public getCurrentVisitor(): VisitorData | null {
    return this.currentVisitor;
  }

  public getTVSpine(): TVController {
    return this.tvSpine;
  }

  private generateVisitor(): VisitorData {
    // TODO:
    // - взять balance.getAvailableSkins()
    // - для каждого patternId выбрать случайный skinId
    // - собрать SkinSet
    // - вернуть VisitorData
    console.warn('Visitor generation not implemented, returning fallback visitor !!!');
    return {
      staySec: 60,
      skins: {
        eyes: 1,
        nose: 2,
        mouth: 3,
        face: 4,
        clothes: 5,
      },
      idleAnimation: 'idle_1',
      id: 'visitor_fallback',
    };
  }
}
