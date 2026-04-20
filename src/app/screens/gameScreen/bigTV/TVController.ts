// src/app/screens/game/controllers/DudeController.ts

import { SpineObjectController } from '@/app/objects/SpineObjectController';
import { SpriteButton } from '@/app/ui/SpriteButton';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Sprite, type Container } from 'pixi.js';

/**
 * Перечисление анимаций персонажа TV
 */
export const TvAnimation = {
  ALARM_ON: 'alarm_on',
  ALARM_OFF: 'alarm_off',
  GLITCHES: 'glitches',
  IDLE: 'idle',
  SIGNAL_DETECTED: 'signal_detected',
  SIGNAL_LOST: 'signal_lost',
} as const;
type TvAnimation = ValuesOf<typeof TvAnimation>;

export const TvSlots = {
  PORTRAITS: 'Container_Portraits',
  BUTTON: 'Container_Button',
} as const;
type TvSlots = ValuesOf<typeof TvSlots>;

const SPINE_SETTINGS = {
  skeleton: 'TV.json',
  atlas: 'background.atlas',
};

export class TVController extends SpineObjectController {
  /**
   * Создает контроллер для персонажа TV
   */

  private button: SpriteButton;

  constructor(onCameraButtonPressed: () => void) {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;
    this.state.setAnimation(0, TvAnimation.GLITCHES, true);
    this.spine.scale.set(1);

    this.button = new SpriteButton(
      Sprite.from('TV_big_button_off'),
      Sprite.from('TV_big_button_on'),
      onCameraButtonPressed,
    );
    this.button.enabled = false;
    this.spine.addSlotObject(TvSlots.BUTTON, this.button);
  }

  public buttonOn(): void {
    this.button.buttonOn();
  }

  public turnOffCamera(): void {
    this.state.setAnimation(0, TvAnimation.GLITCHES, true);
  }

  public playAlarm(): void {
    this.play(TvAnimation.ALARM_ON, true, 0);
  }

  public stopAlarm() {
    this.state.setAnimation(0, TvAnimation.IDLE, false);
  }

  public addVisitorToSlot(slot: TvSlots, visitor: Container): void {
    this.spine.addSlotObject(slot, visitor);
  }

  public removeVisitorFromSlot(visitor: Container): void {
    this.spine.removeSlotObject(visitor);
  }

  public playSygnalLost(): void {
    this.state.setAnimation(0, TvAnimation.SIGNAL_LOST, false);
  }

  public override update(_dt: number): void {
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
