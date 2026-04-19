import { Container } from 'pixi.js';
import { type Balance } from './Balance';
import { type VisitorData } from './types';

/**
 * Всё, что относится к правому монитору:
 *  - сборный спайн-персонаж (скины включаются по VisitorData)
 *  - лампочка сигнализации
 *  - кнопка включения камеры
 *  - эффект "НЕТ СИГНАЛА" когда посетитель ушёл
 *
 * Логика появления (когда и какого) — снаружи, из GameScreen.
 */
export class Visitor extends Container {
  private currentVisitor: VisitorData | null = null;
  private stayTimerMs = 0;
  private gameBalance: Balance;

  // Ожидание нажатия кнопки камеры: создается в waitForCameraButtonPress и резолвится в onCameraButtonPressed.
  private cameraButtonPressPromise: Promise<void> | null = null;
  private resolveCameraButtonPress: (() => void) | null = null;

  /** Коллбэки наружу. Назначаются из GameScreen при инициализации. */
  public onVisitorLeft: () => void = () => {};

  constructor(balance: Balance) {
    super();

    this.gameBalance = balance;

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
  public async showOnCamera(): Promise<void> {
    if (!this.currentVisitor) return;
    this.stayTimerMs = this.currentVisitor.stayMs;
    // TODO:
    // - применить skins к спайну
    // - проиграть idle-анимацию
    // - выключить лампочку
    // - показать экран камеры (убрать заглушку "выключено")
  }

  public update(deltaMs: number): void {
    if (this.stayTimerMs > 0) {
      this.stayTimerMs -= deltaMs;
      if (this.stayTimerMs <= 0) {
        this.showNoSignal();
        this.onVisitorLeft();
      }
    }
  }

  private showNoSignal(): void {
    // TODO: показать помехи + надпись "НЕТ СИГНАЛА", gsap-анимация + выключить спайн
    this.currentVisitor = null;
  }

  public getCurrentVisitor(): VisitorData | null {
    return this.currentVisitor;
  }

  private generateVisitor(): VisitorData {
    // TODO:
    // - взять balance.getAvailableSkins()
    // - для каждого patternId выбрать случайный skinId
    // - собрать SkinSet
    // - вернуть VisitorData
    console.warn('Visitor generation not implemented, returning fallback visitor !!!');
    return {
      stayMs: 5000,
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
