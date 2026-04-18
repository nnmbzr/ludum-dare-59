// src/app/screens/game/controllers/DudeController.ts

import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';

/**
 * Перечисление анимаций персонажа boy
 */
export const BoyAnimation = {
  GUITAR_ON: 'guitar_on',
  IDLE: 'idle',
  IDLE_FIRE: 'idle_fire',
  IDLE_GUITAR: 'idle_guitar',
  IDLE_GUITAR_FIRE: 'idle_guitar_fire',
} as const;
type BoyAnimation = ValuesOf<typeof BoyAnimation>;

const SPINE_SETTINGS = {
  skeleton: 'boy.json',
  atlas: 'boy.atlas',
};

export class BoyController extends SpineObjectController {
  private haveGuitar: boolean = false;
  private fireLit: boolean = false;

  /**
   * Создает контроллер для персонажа boy
   */
  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;

    // Устанавливаем начальную анимацию
    this.state.setAnimation(0, BoyAnimation.IDLE, true);
    this.spine.scale.set(1);
  }

  /**
   * Обрабатывает завершение анимации персонажа
   */
  protected override onAnimationComplete(animName: BoyAnimation, entry: TrackEntry): void {
    // После анимации прогона переходим к out_idle
    if (animName === BoyAnimation.GUITAR_ON) {
      this.updateIdleAnimation(entry.trackIndex);
    }
  }

  private getIdleAnimation(): BoyAnimation {
    if (this.haveGuitar) {
      return this.fireLit ? BoyAnimation.IDLE_GUITAR_FIRE : BoyAnimation.IDLE_GUITAR;
    }
    return this.fireLit ? BoyAnimation.IDLE_FIRE : BoyAnimation.IDLE;
  }

  /**
   * Обновляет idle-анимацию в зависимости от текущего состояния
   * @param trackIndex Индекс трека анимации
   */
  private updateIdleAnimation(trackIndex: number = 0): void {
    // Выбираем анимацию на основе состояния костра
    const animation = this.getIdleAnimation();

    // Устанавливаем соответствующую idle-анимацию
    this.state.setAnimation(trackIndex, animation, true);
  }

  /**
   * Устанавливает состояние костра и обновляет анимацию,
   * @param isLit Горит ли костер
   */
  public setFireState(isLit: boolean): void {
    // Если состояние не изменилось, ничего не делаем
    if (this.fireLit === isLit || this.guitarProcessed()) {
      return;
    }

    this.fireLit = isLit;
    this.updateIdleAnimation();
  }

  public toggleGuitar(): void {
    if (this.guitarProcessed()) {
      return;
    }

    this.haveGuitar = !this.haveGuitar;

    if (this.haveGuitar) {
      this.play(BoyAnimation.GUITAR_ON, false, 0);
    } else {
      this.updateIdleAnimation(0);
    }
  }

  private guitarProcessed(): boolean {
    if (this.currentAnimation() === BoyAnimation.GUITAR_ON) {
      return true;
    }
    return false;
  }

  public clickTest(x: number, y: number) {
    const hit = this.hitTest(x, y);

    if (hit) {
      this.toggleGuitar();
    }
  }

  public hoverTest(x: number, y: number) {
    const hovering = this.hitTest(x, y);

    this.setFireState(hovering);
  }
}
