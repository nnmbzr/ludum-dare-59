import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import type { Event } from '@esotericsoftware/spine-pixi-v8';

export const StampAnimation = {
  STAMP: 'stamp',
} as const;

const SPINE_EVENT = {
  STAMP_DOWN: 'stamp_down',
} as const;

const SPINE_SETTINGS = {
  skeleton: 'Stamp.json',
  atlas: 'background.atlas',
};

export class StampController extends SpineObjectController {
  private isShowing = false;
  private stampDownCallback: (() => void) | null = null;

  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;
    this.state.setEmptyAnimation(0);
    this.spine.scale.set(1);

    this.isShowing = false;
    this.setupEventListener();
  }

  private setupEventListener(): void {
    this.state.addListener({
      event: (_entry: TrackEntry, event: Event) => {
        if (event.data.name === SPINE_EVENT.STAMP_DOWN && this.stampDownCallback) {
          this.stampDownCallback();
        }
      },
    });
  }

  public async stamp(onStampDown?: () => void): Promise<void> {
    this.isShowing = true;
    this.stampDownCallback = onStampDown ?? null;

    await this.play(StampAnimation.STAMP, false, 0);

    this.stampDownCallback = null;
    this.state.setEmptyAnimation(0);
    this.isShowing = false;
  }

  public override update(_dt: number): void {
    if (!this.isShowing) return;

    super.update(_dt);
  }

  protected override onAnimationComplete(_animName: string, _entry: TrackEntry): void {}
}
