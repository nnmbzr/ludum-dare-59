import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import type { Container } from 'pixi.js';

export const TimerSlots = {
  TARGET_QUOTE: 'Container_Timer',
} as const;
type TimerSlots = ValuesOf<typeof TimerSlots>;

const SPINE_SETTINGS = {
  skeleton: 'Timer.json',
  atlas: 'background.atlas',
};

export const TimerAnimations = {
  TIMER: 'timer', // track 1
  ON: 'clock_on', // track 0
  OFF: 'clock_off', // track 0
} as const;
type TimerAnimations = ValuesOf<typeof TimerAnimations>;

export class TimerController extends SpineObjectController {
  // private timerEntry: TrackEntry;

  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;

    /* this.timerEntry = this.state.setAnimation(1, TimerAnimations.TIMER, false);
    this.timerEntry.timeScale = 0;
    this.timerEntry.trackTime = 0; */
  }

  // FIXME: проблемы с позиционированием при одновременном запуске треков.
  public setTime(_progress: number): void {
    return;

    /* const duration = this.timerEntry.animation?.duration ?? 1;
    this.timerEntry.trackTime = Math.max(0, Math.min(1, progress)) * duration; */
  }

  public playOn(): void {
    this.state.setAnimation(0, TimerAnimations.ON, false);
  }

  public playOff(): void {
    this.state.setAnimation(0, TimerAnimations.OFF, false);
  }

  public addToSlot(slot: TimerSlots, object: Container): void {
    this.spine.addSlotObject(slot, object);
  }

  public removeFromSlot(object: Container): void {
    this.spine.removeSlotObject(object);
  }

  protected override onAnimationComplete(_animName: string, _entry: TrackEntry): void {}
}
