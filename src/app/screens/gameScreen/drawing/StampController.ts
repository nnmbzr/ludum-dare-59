import { SpineObjectController } from '@/app/objects/SpineObjectController';
import { SpriteButton } from '@/app/ui/SpriteButton';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { Event, TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Sprite, Texture } from 'pixi.js';

export const StampAnimation = {
  STAMP: 'stamp',
  STAMP_IDLE: 'idle',
  APPLY_ON: 'apply_on',
} as const;

export const StampSlots = {
  BUTTON: 'Container_Button',
} as const;
type StampSlots = ValuesOf<typeof StampSlots>;

const SPINE_EVENT = {
  STAMP_DOWN: 'stamp_down',
} as const;

const SPINE_SETTINGS = {
  skeleton: 'Stamp.json',
  atlas: 'background.atlas',
};

const BUTTON_W = 370;
const BUTTON_H = 480;

export class StampController extends SpineObjectController {
  private stampDownCallback: (() => void) | null = null;
  private button: SpriteButton;

  constructor(onPress: () => void) {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;
    this.state.setAnimation(0, StampAnimation.STAMP_IDLE, false);
    this.spine.scale.set(1);

    const makeTransparent = () => {
      const s = new Sprite(Texture.WHITE);
      s.setSize(BUTTON_W, BUTTON_H);
      s.anchor.set(0.5);
      s.alpha = 0;
      return s;
    };

    this.button = new SpriteButton(makeTransparent(), makeTransparent(), onPress);
    /// this.button.hitArea = new Rectangle(-BUTTON_W / 2, -BUTTON_H / 2, BUTTON_W, BUTTON_H);
    this.button.enabled = false;
    this.spine.addSlotObject(StampSlots.BUTTON, this.button);

    this.setupEventListener();
  }

  public buttonOn(): void {
    this.button.buttonOn();
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
    this.stampDownCallback = onStampDown ?? null;

    await this.play(StampAnimation.STAMP, false, 0);

    this.stampDownCallback = null;
    this.state.setAnimation(0, StampAnimation.STAMP_IDLE, false);
  }

  public readyToApply(): void {
    this.state.setAnimation(0, StampAnimation.APPLY_ON, true);
  }

  public override update(_dt: number): void {
    super.update(_dt);
  }

  protected override onAnimationComplete(_animName: string, _entry: TrackEntry): void {}
}
