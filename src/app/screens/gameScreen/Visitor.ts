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
  private balance: Balance;

  /** Коллбэки наружу. Назначаются из GameScreen при инициализации. */
  public onCameraButtonPressed: () => void = () => {};
  public onVisitorLeft: () => void = () => {};

  constructor(balance: Balance) {
    super();

    this.balance = balance;

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
    throw new Error('Not implemented');
  }
}
