import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import type { Container } from 'pixi.js';

export const FaxAnimation = {
  IDLE: 'idle',
  NUMBERS: 'numbers',
  RECEIVE: 'recieve',
  SEND: 'send',
} as const;
type FaxAnimation = ValuesOf<typeof FaxAnimation>;

export const FaxSlots = {
  BUTTON: 'Container_Button',
} as const;
type FaxSlots = ValuesOf<typeof FaxSlots>;

const SPINE_SETTINGS = {
  skeleton: 'Fax.json',
  atlas: 'background.atlas',
};

export class FaxController extends SpineObjectController {
  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;
    this.play(FaxAnimation.IDLE, true, 0);
  }

  public waitServerResponce(): void {
    this.play(FaxAnimation.NUMBERS, true, 0);
  }

  public async acceptsServerResponse(): Promise<void> {
    await this.play(FaxAnimation.RECEIVE, false, 0);
    this.play(FaxAnimation.IDLE, true, 0);
  }

  public async guessRecived(): Promise<void> {
    await this.play(FaxAnimation.SEND, false, 0);
    this.play(FaxAnimation.IDLE, true, 0);
  }

  public addToSlot(slot: FaxSlots, object: Container): void {
    this.spine.addSlotObject(slot, object);
  }

  public removeFromSlot(object: Container): void {
    this.spine.removeSlotObject(object);
  }

  protected override onAnimationComplete(_animName: FaxAnimation, _entry: TrackEntry): void {}
}
