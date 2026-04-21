import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import type { Container } from 'pixi.js';

export const MonitorAnimation = {
  GLITCH_IDLE: 'glitch_idle',
  IDLE: 'idle',
  SCREENS_OFF: 'screens_off',
  SCREENS_ON: 'screens_on',
} as const;
type MonitorAnimation = ValuesOf<typeof MonitorAnimation>;

export const MonitorSlots = {
  PORTRAIT_01: 'Container_TV_portrait_01',
  PORTRAIT_02: 'Container_TV_portrait_02',
  PORTRAIT_03: 'Container_TV_portrait_03',
} as const;
type MonitorSlots = ValuesOf<typeof MonitorSlots>;

const SPINE_SETTINGS = {
  skeleton: 'TV_Signals.json',
  atlas: 'background.atlas',
};

export class MonitorsController extends SpineObjectController {
  constructor() {
    super(SPINE_SETTINGS);

    // this.state.data.defaultMix = 0.2;
    this.state.setAnimation(0, MonitorAnimation.GLITCH_IDLE, true);
    this.spine.scale.set(1);
  }

  public screensOn(): void {
    this.play(MonitorAnimation.SCREENS_ON, false, 0);
  }

  public screensOff(): void {
    this.play(MonitorAnimation.SCREENS_OFF, false, 0);
  }

  public addToSlot(slot: MonitorSlots, object: Container): void {
    this.spine.addSlotObject(slot, object);
  }

  public removeFromSlot(object: Container): void {
    this.spine.removeSlotObject(object);
  }

  public override update(_dt: number): void {
    super.update(_dt);
  }

  protected override onAnimationComplete(animName: MonitorAnimation, _entry: TrackEntry): void {
    if (animName === MonitorAnimation.SCREENS_ON) {
      this.state.setAnimation(0, MonitorAnimation.IDLE, false);
    } else if (animName === MonitorAnimation.SCREENS_OFF) {
      this.state.setAnimation(0, MonitorAnimation.GLITCH_IDLE, true);
    }
  }
}
