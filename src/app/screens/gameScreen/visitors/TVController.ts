// src/app/screens/game/controllers/DudeController.ts

import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import type { Container } from 'pixi.js';

/**
 * Перечисление анимаций персонажа TV
 */
export const TvAnimation = {
  ALARM: 'alarm_on',
} as const;
type TvAnimation = ValuesOf<typeof TvAnimation>;

export const TvSlots = {
  PORTRAITS: 'Container_Portraits',
} as const;
type TvSlots = ValuesOf<typeof TvSlots>;

const SPINE_SETTINGS = {
  skeleton: 'TV.json',
  atlas: 'background.atlas',
};

export class TVController extends SpineObjectController {
  private isShowing = false;

  /**
   * Создает контроллер для персонажа TV
   */
  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;

    // Устанавливаем начальную анимацию
    this.state.setEmptyAnimation(0);
    this.spine.scale.set(1);

    this.isShowing = false;
  }

  public playAlarm(): void {
    this.isShowing = true;
    this.play(TvAnimation.ALARM, true, 0);
  }

  public stopAlarm() {
    this.state.setEmptyAnimation(0);
  }

  public addVisitorToSlot(slot: TvSlots, visitor: Container): void {
    this.spine.addSlotObject(slot, visitor);
  }

  public removeVisitorFromSlot(visitor: Container): void {
    this.spine.removeSlotObject(visitor);
  }

  public override update(_dt: number): void {
    if (!this.isShowing) return;

    super.update(_dt);
  }

  /**
   * Обрабатывает завершение анимации персонажа
   */
  protected override onAnimationComplete(_animName: TvAnimation, _entry: TrackEntry): void {
    // После анимации прогона переходим к out_idle
    /* if (animName === TvAnimation.OUT) {
      this.state.setEmptyAnimation(0);
      this.isShowing = false;
    } */
  }
}
