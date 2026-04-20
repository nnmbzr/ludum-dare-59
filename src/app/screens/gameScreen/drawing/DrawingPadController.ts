import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import type { Container } from 'pixi.js';

const DRAWING_SLOT = 'Container_Drawing';

export const DrawingPadAnimation = {
  CLOSE: 'close',
  NEW_FOLDER_UP: 'new_folder_up',
  OPEN: 'open',
} as const;
type DrawingPadAnimation = ValuesOf<typeof DrawingPadAnimation>;

const SPINE_SETTINGS = {
  skeleton: 'Drawing_Pad.json',
  atlas: 'background.atlas',
};

export class DrawingPadController extends SpineObjectController {
  private isShowing = false;

  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;
    this.state.setEmptyAnimation(0);
    this.spine.scale.set(1);

    this.isShowing = true;
  }

  public async close(): Promise<void> {
    await this.play(DrawingPadAnimation.CLOSE, false, 0);
    this.state.setEmptyAnimation(0);
    this.isShowing = false;
  }

  public async newFolderUp(): Promise<void> {
    this.isShowing = true;
    await this.play(DrawingPadAnimation.NEW_FOLDER_UP, false, 0);
    return this.play(DrawingPadAnimation.OPEN, false, 0);
  }

  public override update(_dt: number): void {
    if (!this.isShowing) return;

    super.update(_dt);
  }

  public mountBoard(board: Container): void {
    this.spine.addSlotObject(DRAWING_SLOT, board);
  }

  protected override onAnimationComplete(_animName: DrawingPadAnimation, _entry: TrackEntry): void {}
}
