import { DrawingPadController } from './DrawingPadController';
import { StampController } from './StampController';

export const CANVAS_W = 560;
export const CANVAS_H = 748;
export const BOARD_BG = 0xe8dcc8;
export const ERASER_LIVE_FILL = 0xd4c9b8;
export const ERASER_LIVE_FILL_ALPHA = 0.72;

export class Drawing {
  private drawingPadSpine: DrawingPadController;
  private stampSpine: StampController;

  constructor() {
    this.drawingPadSpine = new DrawingPadController();
    this.stampSpine = new StampController();

    this.drawingPadSpine.newFolderUp();
  }

  public update(dt: number): void {
    this.drawingPadSpine.update(dt);
    this.stampSpine.update(dt);
  }

  public getDrawingPadSpine(): DrawingPadController {
    return this.drawingPadSpine;
  }

  public getStampSpine(): StampController {
    return this.stampSpine;
  }
}
