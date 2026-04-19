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

const TIMER_ANIMATION = 'timer';

export class TimerController extends SpineObjectController {
  private timerEntry: TrackEntry | null = null;

  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0;

    this.timerEntry = this.state.setAnimation(0, TIMER_ANIMATION, false);
    this.timerEntry.timeScale = 0;
    this.timerEntry.trackTime = 0;
  }

  public setTime(progress: number): void {
    if (!this.timerEntry) return;

    const duration = this.timerEntry.animation?.duration ?? 1;
    this.timerEntry.trackTime = Math.max(0, Math.min(1, progress)) * duration;
  }

  public addToSlot(slot: TimerSlots, object: Container): void {
    this.spine.addSlotObject(slot, object);
  }

  public removeFromSlot(object: Container): void {
    this.spine.removeSlotObject(object);
  }

  protected override onAnimationComplete(_animName: string, _entry: TrackEntry): void {}
}
