import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { DrawTool } from './GameDrawingBoard';

interface ToolButton {
  container: Container;
  onSprite: Sprite;
  offSprite: Sprite;
  plateOff?: Sprite;
  plateOn?: Sprite;
}

const HIT_PAD = 12;

/** Текстуры «кружков» по возрастанию (см. `images/drawing/size_*.png`). */
const SIZE_OFF_TEX = ['size_1', 'size_2', 'size_3'] as const;

const SIZE_ROW_CY = 24;
const SIZE_GAP_X = 10;
const SELECTION_ORANGE = 0xff8a33;
const SELECTION_PAD = 5;

/**
 * Три пресета толщины из ассетов: всегда видны `size_*`, выделение — оранжевая обводка
 * (без переключения на `size_selected_*`, чтобы кружки не «прыгали» по размеру).
 */
class ThicknessPresetAssetRow extends Container {
  private readonly wraps: Container[] = [];
  private readonly selection = new Graphics();

  constructor(onPick: (i: 0 | 1 | 2) => void) {
    super();
    this.label = 'drawing_thickness_row_assets';
    this.eventMode = 'static';
    this.addChild(this.selection);
    this.selection.eventMode = 'none';

    let x = 0;
    for (let i = 0; i < 3; i++) {
      const wrap = new Container();
      wrap.label = `drawing_preset_asset_${i}`;
      wrap.eventMode = 'static';
      wrap.cursor = 'pointer';

      const s = new Sprite({ texture: Texture.from(SIZE_OFF_TEX[i]) });
      s.anchor.set(0.5);
      s.position.set(0, 0);
      s.eventMode = 'none';
      wrap.addChild(s);

      const hw = Math.max(28, s.width * 0.5 + 14);
      const hh = Math.max(28, s.height * 0.5 + 14);
      wrap.hitArea = new Rectangle(-hw, -hh, hw * 2, hh * 2);

      wrap.position.set(x + s.width * 0.5, SIZE_ROW_CY);
      const idx = i as 0 | 1 | 2;
      wrap.on('pointertap', () => onPick(idx));

      this.addChild(wrap);
      this.wraps.push(wrap);
      x += s.width + SIZE_GAP_X;
    }
  }

  public setSelected(index: 0 | 1 | 2): void {
    this.selection.clear();
    const wrap = this.wraps[index]!;
    const s = wrap.children[0] as Sprite;
    const w = s.width + SELECTION_PAD * 2;
    const h = s.height + SELECTION_PAD * 2;
    const cx = wrap.x;
    const cy = wrap.y;
    this.selection
      .roundRect(cx - w * 0.5, cy - h * 0.5, w, h, Math.min(14, w * 0.35))
      .stroke({ width: 3, color: SELECTION_ORANGE, alpha: 1 });
  }

  public get rowWidth(): number {
    const last = this.wraps[2]!;
    const s = last.children[0] as Sprite;
    return last.x + s.width * 0.5 + 8;
  }

  public get rowHeight(): number {
    let mh = 0;
    for (const w of this.wraps) {
      const s = w.children[0] as Sprite;
      mh = Math.max(mh, s.height);
    }
    return SIZE_ROW_CY + mh * 0.5 + 12;
  }
}

/**
 * UI инструментов для рисования планшета.
 * Монтируется в слот Spine `Container_Tools` слева от холста (`Container_Drawing`).
 *
 * Верхний ряд: **Undo слева и выше**, **курсор справа и выше** (как в ТЗ).
 */
export class DrawingToolsUI extends Container {
  private cursorBtn!: ToolButton;
  private undoBtn!: ToolButton;
  private brushBtn!: ToolButton;
  private eraserBtn!: ToolButton;
  private sizeRowBrush!: ThicknessPresetAssetRow;
  private sizeRowEraser!: ThicknessPresetAssetRow;

  private currentTool: DrawTool = 'brush';
  private currentSize = 1;

  private onToolChange: ((tool: DrawTool) => void) | null = null;
  private onSizeChange: ((size: 0 | 1 | 2) => void) | null = null;
  private onUndo: (() => void) | null = null;

  constructor() {
    super();
    this.label = 'drawing_tools_ui';
    this.buildUI();
  }

  private buildUI(): void {
    const PAD = 14;
    const TOP_Y = 4;
    const STRIP_GAP = 18;
    const TOOL_GAP_X = 16;

    this.undoBtn = this.createButton('Undo_on', 'Undo_off', 'drawing_btn_undo', false);
    this.cursorBtn = this.createButton('Cursor_on', 'Cursor_off', 'drawing_btn_cursor', true);
    this.brushBtn = this.createButton('Pencil_on', 'Pencil_off', 'drawing_btn_brush', true);
    this.eraserBtn = this.createButton('Eraser_on', 'Eraser_off', 'drawing_btn_eraser', true);

    this.sizeRowBrush = new ThicknessPresetAssetRow((i) => this.selectSize(i));
    this.sizeRowEraser = new ThicknessPresetAssetRow((i) => this.selectSize(i));

    const topRowH = Math.max(this.undoBtn.offSprite.height, this.cursorBtn.offSprite.height);
    const pencilRowY = TOP_Y + topRowH + STRIP_GAP;

    const pencilW = this.brushBtn.offSprite.width;
    const pencilH = this.brushBtn.offSprite.height;
    const brushSizesX = PAD + pencilW + TOOL_GAP_X;
    const sizeRowH = this.sizeRowBrush.rowHeight;
    const sizesYBrush = pencilRowY + Math.max(0, (pencilH - sizeRowH) * 0.5);

    this.brushBtn.container.position.set(PAD, pencilRowY);
    this.addChild(this.brushBtn.container);
    this.brushBtn.container.on('pointertap', () => this.selectTool('brush'));

    this.sizeRowBrush.position.set(brushSizesX, sizesYBrush);
    this.addChild(this.sizeRowBrush);

    const eraserY = pencilRowY + Math.max(pencilH, sizeRowH) + 12;
    const eraserW = this.eraserBtn.offSprite.width;
    const eraserH = this.eraserBtn.offSprite.height;
    const sizesYEraser = eraserY + Math.max(0, (eraserH - sizeRowH) * 0.5);

    this.eraserBtn.container.position.set(PAD, eraserY);
    this.addChild(this.eraserBtn.container);
    this.eraserBtn.container.on('pointertap', () => this.selectTool('eraser'));

    this.sizeRowEraser.position.set(PAD + eraserW + TOOL_GAP_X, sizesYEraser);
    this.addChild(this.sizeRowEraser);

    const panelW = Math.max(
      brushSizesX + this.sizeRowBrush.rowWidth + PAD,
      PAD + eraserW + TOOL_GAP_X + this.sizeRowEraser.rowWidth + PAD,
      this.cursorBtn.offSprite.width + this.undoBtn.offSprite.width + PAD * 4,
    );

    /** Undo — выше и левее в полосе инструментов. */
    this.undoBtn.container.position.set(PAD * 0.5, TOP_Y);
    this.addChild(this.undoBtn.container);
    this.undoBtn.container.on('pointertap', () => {
      if (this.onUndo) this.onUndo();
    });

    /** Курсор — выше и правее. */
    const cursorW = this.cursorBtn.offSprite.width;
    this.cursorBtn.container.position.set(panelW - cursorW - PAD * 0.5, TOP_Y);
    this.addChild(this.cursorBtn.container);
    this.cursorBtn.container.on('pointertap', () => this.selectTool('cursor'));

    this.updateState();
  }

  private createButton(
    onTexName: string,
    offTexName: string,
    label: string,
    withOrangePlate: boolean,
  ): ToolButton {
    const container = new Container();
    container.label = label;
    container.eventMode = 'static';
    container.cursor = 'pointer';

    let plateOff: Sprite | undefined;
    let plateOn: Sprite | undefined;

    if (withOrangePlate) {
      plateOff = new Sprite({ texture: Texture.from('button_off') });
      plateOff.anchor.set(0, 0);
      container.addChild(plateOff);

      plateOn = new Sprite({ texture: Texture.from('button_on') });
      plateOn.anchor.set(0, 0);
      plateOn.visible = false;
      container.addChild(plateOn);
    }

    const offSprite = new Sprite({
      texture: Texture.from(offTexName),
    });
    offSprite.anchor.set(0, 0);
    container.addChild(offSprite);

    const onSprite = new Sprite({
      texture: Texture.from(onTexName),
    });
    onSprite.anchor.set(0, 0);
    onSprite.visible = false;
    container.addChild(onSprite);

    if (plateOff && plateOn && plateOff.width > 0 && plateOff.height > 0) {
      const tw = Math.max(offSprite.width, onSprite.width);
      const th = Math.max(offSprite.height, onSprite.height);
      plateOff.scale.set(tw / plateOff.width, th / plateOff.height);
      plateOn.scale.set(tw / plateOn.width, th / plateOn.height);
    }

    const btn: ToolButton = { container, onSprite, offSprite, plateOff, plateOn };
    this.applyButtonHitArea(btn);
    return btn;
  }

  private applyButtonHitArea(btn: ToolButton): void {
    let w = Math.max(btn.offSprite.width, btn.onSprite.width);
    let h = Math.max(btn.offSprite.height, btn.onSprite.height);
    if (btn.plateOff) {
      w = Math.max(w, btn.plateOff.width);
      h = Math.max(h, btn.plateOff.height);
    }
    const p = HIT_PAD;
    btn.container.hitArea = new Rectangle(-p, -p, w + p * 2, h + p * 2);
  }

  private selectTool(tool: DrawTool): void {
    if (this.currentTool === tool) return;
    this.currentTool = tool;
    this.updateState();
    if (this.onToolChange) this.onToolChange(tool);
  }

  private selectSize(size: 0 | 1 | 2): void {
    if (this.currentSize === size) return;
    this.currentSize = size;
    this.updateState();
    if (this.onSizeChange) this.onSizeChange(size);
  }

  private updateState(): void {
    const setPlated = (b: ToolButton, active: boolean) => {
      b.onSprite.visible = active;
      b.offSprite.visible = !active;
      if (b.plateOn && b.plateOff) {
        b.plateOn.visible = active;
        b.plateOff.visible = !active;
      }
    };

    setPlated(this.cursorBtn, this.currentTool === 'cursor');
    setPlated(this.brushBtn, this.currentTool === 'brush');
    setPlated(this.eraserBtn, this.currentTool === 'eraser');

    const ix = this.currentSize as 0 | 1 | 2;
    this.sizeRowBrush.setSelected(ix);
    this.sizeRowEraser.setSelected(ix);
  }

  public syncWithBoard(tool: DrawTool, size: 0 | 1 | 2): void {
    this.currentTool = tool;
    this.currentSize = size;
    this.updateState();
  }

  public setOnToolChange(cb: (tool: DrawTool) => void): void {
    this.onToolChange = cb;
  }

  public setOnSizeChange(cb: (size: 0 | 1 | 2) => void): void {
    this.onSizeChange = cb;
  }

  public setOnUndo(cb: () => void): void {
    this.onUndo = cb;
  }
}
