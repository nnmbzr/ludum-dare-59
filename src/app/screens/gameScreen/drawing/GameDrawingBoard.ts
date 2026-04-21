import { engine } from '@/app/getEngine';
import type { PartIds } from '@/shared/serverTypes';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, Graphics, Point, Rectangle, Text, type Ticker } from 'pixi.js';
import { BOARD_BG, CANVAS_H, CANVAS_W, ERASER_LIVE_FILL, ERASER_LIVE_FILL_ALPHA } from './Drawing';
const ERASER_LIVE_STROKE = 0x4a4a55;
const BRUSH_GROW_SEC = 1.05;

const THICKNESS_PRESETS = [
  { r0: 2, r1: 4 },
  { r0: 4, r1: 8 },
  { r0: 16, r1: 16 },
] as const;

const UI_PAD = 10;
const UI_W = 168;
const TEMPLATE_CHIP = 52;
const TOOLS_Y = 52;
const TOOL_ROW_H = 38;
const THICKNESS_Y = TOOLS_Y + TOOL_ROW_H + 6;
const THICKNESS_ROW_H = 32;
const TEMPLATES_TOP = THICKNESS_Y + THICKNESS_ROW_H + 12;
const PANEL_BOTTOM_PAD = 18;
const UI_PANEL_H = TEMPLATES_TOP + PANEL_BOTTOM_PAD;
const PLACED_SCALE = 1.35;

const STROKE_LIVE_POINT_CAP = 340;
const STROKE_LIVE_KEEP = 40;

const UI_SHOW_IN_DUR = 0.34;
const UI_SHOW_RECOIL_DUR = 0.12;
const UI_SHOW_RETURN_DUR = 0.1;
const UI_SHOW_RECOIL_PX = 10;

const MARGIN_FROM_BOTTOM = 48;

type DrawTool = 'brush' | 'eraser';

export class GameDrawingBoard extends Container {
  private paused = false;

  public onSubmitted: (data: string, skins: PartIds) => void = () => {};

  private board: Container;
  private bg: Graphics;
  /** Один слой: кисть и ластик в порядке рисования, чтобы после стирания снова можно было рисовать сверху. */
  private inkStrokesLayer: Container;
  private placedTemplatesLayer: Container;
  private activeStroke: Graphics;
  private hoverDot: Graphics;
  private boardHolstMask: Graphics;
  private uiDock!: Container;

  private readonly strokeChunks: Graphics[] = [];
  private readonly strokePoints: { x: number; y: number; tSec: number }[] = [];
  private pressStartMs = 0;
  private readonly brushEase = gsap.parseEase('power2.out');
  private isDrawing = false;
  private drawTool: DrawTool = 'brush';
  private thicknessIx = 1;
  private liveStrokeR0: number = THICKNESS_PRESETS[1].r0;
  private liveStrokeR1: number = THICKNESS_PRESETS[1].r1;
  private liveStrokeIsEraser = false;
  private strokeBakeAccum: Graphics | null = null;
  /** Для ластика: до какого индекса в `strokePoints` уже запечено в `strokeBakeAccum` (не считая кончик). */
  private eraserNextBakeIndex = 0;

  private toolBrushBg!: Graphics;
  private toolEraserBg!: Graphics;
  private readonly thickBgs: Graphics[] = [];

  private stageDragAttached = false;
  private canvasHolstPointerAttached = false;
  private pointerOverBoard = false;
  private lastHover = { x: CANVAS_W * 0.5, y: CANVAS_H * 0.5 };

  private uiDockShown = false;
  private uiDockTargetX = 0;
  private uiDockHiddenX = 0;

  private stageTemplateDrag = false;

  private readonly categoryVariantIx = [0, 0, 0];
  private readonly placedByCategory: (Container | null)[] = [null, null, null];

  private readonly onDomCanvasPointerMove = (ev: PointerEvent) => {
    const app = engine();
    const rect = app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const lx = ((ev.clientX - rect.left) * app.renderer.width) / rect.width;
    const ly = ((ev.clientY - rect.top) * app.renderer.height) / rect.height;
    const vs = app.virtualScreen;
    const vx = (lx - vs.gameContainer.x) / vs.scale;
    const vy = (ly - vs.gameContainer.y) / vs.scale;
    this.syncHolstPointerFromVirtual(vx, vy);
  };

  private readonly onDomCanvasPointerLeave = () => {
    if (this.isDrawing || this.paused) return;
    if (this.stageTemplateDrag) return;
    if (this.pointerOverBoard) {
      this.pointerOverBoard = false;
      this.hideHoverDot();
      this.hideUiDock();
    }
  };

  private syncHolstPointerFromVirtual(vx: number, vy: number) {
    if (this.isDrawing || this.paused) return;
    const lp = this.board.toLocal({ x: vx, y: vy }, engine().virtualScreen.gameContainer);
    const inside = lp.x >= 0 && lp.x <= CANVAS_W && lp.y >= 0 && lp.y <= CANVAS_H;
    if (inside) {
      const c = this.clampToBoard(lp);
      this.lastHover = c;
      if (!this.pointerOverBoard) {
        this.pointerOverBoard = true;
        this.showUiDock();
      }
      this.moveHoverDot(c.x, c.y);
    } else {
      if (this.stageTemplateDrag) return;
      if (this.pointerOverBoard) {
        this.pointerOverBoard = false;
        this.hideHoverDot();
        this.hideUiDock();
      }
    }
  }
  private readonly onBoardDown = (e: FederatedPointerEvent) => {
    if (this.isUnderUiDock(e.target as Container)) return;
    const p = this.localOnBoard(e);
    this.beginStroke(p);
  };

  private readonly onStageMove = (e: FederatedPointerEvent) => {
    if (!this.isDrawing) return;
    const p = this.clampToBoard(this.localOnBoard(e));
    this.lastHover = p;
    this.appendStrokePoint(p.x, p.y);
  };
  private readonly onStageUp = (_e: FederatedPointerEvent) => {
    this.endStroke();
  };

  constructor() {
    super();

    this.board = new Container();
    this.board.label = 'drawing_board';
    this.board.eventMode = 'static';
    this.board.cursor = 'none';
    this.board.hitArea = new Rectangle(0, 0, CANVAS_W, CANVAS_H);

    this.bg = new Graphics();
    this.bg.label = 'drawing_bg';
    this.bg.eventMode = 'none';
    this.bg.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: BOARD_BG, alpha: 1 });
    this.board.addChild(this.bg);

    this.placedTemplatesLayer = new Container();
    this.placedTemplatesLayer.label = 'drawing_placed_templates';
    this.placedTemplatesLayer.eventMode = 'none';
    this.board.addChild(this.placedTemplatesLayer);

    this.inkStrokesLayer = new Container();
    this.inkStrokesLayer.label = 'drawing_ink_strokes';
    this.inkStrokesLayer.eventMode = 'none';
    this.board.addChild(this.inkStrokesLayer);

    this.activeStroke = new Graphics();
    this.activeStroke.label = 'drawing_stroke_active';
    this.activeStroke.eventMode = 'none';
    this.inkStrokesLayer.addChild(this.activeStroke);

    this.hoverDot = new Graphics();
    this.hoverDot.eventMode = 'none';
    this.hoverDot.visible = false;
    this.board.addChild(this.hoverDot);

    this.boardHolstMask = new Graphics();
    this.boardHolstMask.label = 'drawing_board_mask';
    this.boardHolstMask.eventMode = 'none';
    this.boardHolstMask.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: 0xffffff, alpha: 1 });
    this.board.addChild(this.boardHolstMask);
    this.board.mask = this.boardHolstMask;

    this.buildUiDock();

    this.addChild(this.board);
  }

  private buildUiDock() {
    this.uiDock = new Container();
    this.uiDock.label = 'drawing_ui_dock';
    this.uiDock.eventMode = 'static';
    this.uiDock.visible = false;

    const panel = new Graphics()
      .roundRect(0, 0, UI_W, UI_PANEL_H, 10)
      .fill({ color: 0x2c2c32, alpha: 0.94 })
      .stroke({ width: 1, color: 0x5a5a66, alpha: 0.9 });
    this.uiDock.addChild(panel);

    const undoBtn = new Container();
    undoBtn.label = 'drawing_undo';
    undoBtn.eventMode = 'static';
    undoBtn.cursor = 'pointer';
    undoBtn.hitArea = new Rectangle(0, 0, UI_W - 16, 36);
    const undoBg = new Graphics()
      .roundRect(0, 0, UI_W - 16, 36, 6)
      .fill({ color: 0x3d5a80, alpha: 1 })
      .stroke({ width: 1, color: 0x7aa0cc, alpha: 0.6 });
    undoBtn.addChild(undoBg);
    const undoText = new Text({
      text: 'Undo line',
      style: { fill: 0xf0f4fa, fontFamily: 'sans-serif', fontSize: 14 },
    });
    undoText.anchor.set(0.5);
    undoText.position.set((UI_W - 16) * 0.5, 18);
    undoBtn.addChild(undoText);
    undoBtn.position.set(8, 10);
    undoBtn.on('pointertap', () => {
      this.undoLastStroke();
    });
    undoBtn.on('pointerover', () => {
      undoBg
        .clear()
        .roundRect(0, 0, UI_W - 16, 36, 6)
        .fill({ color: 0x4a6fa0, alpha: 1 })
        .stroke({ width: 1, color: 0x9ab8e0, alpha: 0.7 });
    });
    undoBtn.on('pointerout', () => {
      undoBg
        .clear()
        .roundRect(0, 0, UI_W - 16, 36, 6)
        .fill({ color: 0x3d5a80, alpha: 1 })
        .stroke({ width: 1, color: 0x7aa0cc, alpha: 0.6 });
    });
    this.uiDock.addChild(undoBtn);

    const toolsTitle = new Text({
      text: 'Tool',
      style: { fill: 0xc8ccd4, fontFamily: 'sans-serif', fontSize: 12 },
    });
    toolsTitle.position.set(10, TOOLS_Y - 18);
    this.uiDock.addChild(toolsTitle);

    const brushBtn = new Container();
    brushBtn.label = 'drawing_tool_brush';
    brushBtn.eventMode = 'static';
    brushBtn.cursor = 'pointer';
    const bw = this.toolSlotW();
    brushBtn.hitArea = new Rectangle(0, 0, bw, TOOL_ROW_H);
    this.toolBrushBg = new Graphics();
    this.paintToolSlotBg(this.toolBrushBg, bw, TOOL_ROW_H, true);
    brushBtn.addChild(this.toolBrushBg);
    const brushLabel = new Text({
      text: 'Brush',
      style: { fill: 0xf0f4fa, fontFamily: 'sans-serif', fontSize: 13 },
    });
    brushLabel.anchor.set(0.5);
    brushLabel.position.set(bw * 0.5, TOOL_ROW_H * 0.5);
    brushBtn.addChild(brushLabel);
    brushBtn.position.set(8, TOOLS_Y);
    brushBtn.on('pointertap', () => this.setDrawTool('brush'));
    this.uiDock.addChild(brushBtn);

    const eraserBtn = new Container();
    eraserBtn.label = 'drawing_tool_eraser';
    eraserBtn.eventMode = 'static';
    eraserBtn.cursor = 'pointer';
    eraserBtn.hitArea = new Rectangle(0, 0, bw, TOOL_ROW_H);
    this.toolEraserBg = new Graphics();
    this.paintToolSlotBg(this.toolEraserBg, bw, TOOL_ROW_H, false);
    eraserBtn.addChild(this.toolEraserBg);
    const eraserLabel = new Text({
      text: 'Eraser',
      style: { fill: 0xf0f4fa, fontFamily: 'sans-serif', fontSize: 13 },
    });
    eraserLabel.anchor.set(0.5);
    eraserLabel.position.set(bw * 0.5, TOOL_ROW_H * 0.5);
    eraserBtn.addChild(eraserLabel);
    eraserBtn.position.set(8 + bw + 6, TOOLS_Y);
    eraserBtn.on('pointertap', () => this.setDrawTool('eraser'));
    this.uiDock.addChild(eraserBtn);

    const thickTitle = new Text({
      text: 'Line width',
      style: { fill: 0xc8ccd4, fontFamily: 'sans-serif', fontSize: 12 },
    });
    thickTitle.position.set(10, THICKNESS_Y - 18);
    this.uiDock.addChild(thickTitle);

    const thickGap = 6;
    const thickW = this.thickSlotW();
    for (let i = 0; i < 3; i++) {
      const box = new Container();
      box.label = `drawing_thickness_${i}`;
      box.eventMode = 'static';
      box.cursor = 'pointer';
      box.hitArea = new Rectangle(0, 0, thickW, THICKNESS_ROW_H);
      const bg = new Graphics();
      this.paintThickSlotBg(bg, thickW, THICKNESS_ROW_H, false);
      box.addChild(bg);
      this.thickBgs.push(bg);
      const pr = THICKNESS_PRESETS[i]!;
      const preview = new Graphics();
      const cy = THICKNESS_ROW_H * 0.5;
      const cx = thickW * 0.5;
      preview
        .circle(cx, cy, pr.r0)
        .fill({ color: 0x1a1a1a, alpha: 0.9 })
        .stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
      box.addChild(preview);
      box.position.set(8 + i * (thickW + thickGap), THICKNESS_Y);
      const ix = i;
      box.on('pointertap', () => this.setThicknessIx(ix));
      this.uiDock.addChild(box);
    }

    /* const tplTitle = new Text({
      text: 'Templates',
      style: { fill: 0xc8ccd4, fontFamily: 'sans-serif', fontSize: 12 },
    });
    tplTitle.position.set(10, TEMPLATES_TOP - 18);
    this.uiDock.addChild(tplTitle);

    let y = TEMPLATES_TOP;
    for (let cat = 0; cat < TEMPLATE_CATALOG.length; cat++) {
      const row = this.buildTemplateNavRow(cat);
      row.position.set(0, y);
      this.uiDock.addChild(row);
      y += TEMPLATE_CHIP + TEMPLATE_GAP;
    } */

    this.uiDockTargetX = CANVAS_W - UI_W - UI_PAD;
    this.uiDockHiddenX = CANVAS_W;
    this.uiDock.position.set(this.uiDockHiddenX, UI_PAD);
    this.board.addChild(this.uiDock);
    this.refreshToolChrome();
  }

  private toolSlotW() {
    return (UI_W - 24 - 6) * 0.5;
  }

  private thickSlotW() {
    return (UI_W - 16 - 6 * 2) / 3;
  }

  private paintToolSlotBg(g: Graphics, w: number, h: number, active: boolean) {
    g.clear();
    g.roundRect(0, 0, w, h, 6)
      .fill({ color: active ? 0x4a6b94 : 0x353540, alpha: 1 })
      .stroke({
        width: active ? 2 : 1,
        color: active ? 0xa8c8ec : 0x6a6a78,
        alpha: active ? 0.85 : 0.5,
      });
  }

  private paintThickSlotBg(g: Graphics, w: number, h: number, active: boolean) {
    g.clear();
    g.roundRect(0, 0, w, h, 6)
      .fill({ color: active ? 0x4a6b94 : 0x353540, alpha: 1 })
      .stroke({
        width: active ? 2 : 1,
        color: active ? 0xa8c8ec : 0x6a6a78,
        alpha: active ? 0.85 : 0.5,
      });
  }

  private refreshToolChrome() {
    const tw = this.toolSlotW();
    this.paintToolSlotBg(this.toolBrushBg, tw, TOOL_ROW_H, this.drawTool === 'brush');
    this.paintToolSlotBg(this.toolEraserBg, tw, TOOL_ROW_H, this.drawTool === 'eraser');
    const w = this.thickSlotW();
    for (let i = 0; i < this.thickBgs.length; i++) {
      this.paintThickSlotBg(this.thickBgs[i]!, w, THICKNESS_ROW_H, i === this.thicknessIx);
    }
  }

  private setDrawTool(t: DrawTool) {
    if (this.isDrawing) return;
    if (this.drawTool === t) return;
    this.drawTool = t;
    this.refreshToolChrome();
    if (this.pointerOverBoard && !this.isDrawing) this.refreshHoverDot();
  }

  private setThicknessIx(ix: number) {
    if (this.isDrawing) return;
    if (ix < 0 || ix >= THICKNESS_PRESETS.length) return;
    if (this.thicknessIx === ix) return;
    this.thicknessIx = ix;
    this.refreshToolChrome();
    if (this.pointerOverBoard && !this.isDrawing) this.refreshHoverDot();
  }

  private addStrokeChunkBeforeActive(parent: Container, activeG: Graphics, chunk: Graphics) {
    const i = parent.getChildIndex(activeG);
    parent.addChildAt(chunk, i);
  }

  private pointInUiDock(boardX: number, boardY: number): boolean {
    const b = this.uiDock.getBounds();
    return boardX >= b.x && boardX <= b.x + b.width && boardY >= b.y && boardY <= b.y + b.height;
  }

  private isUnderUiDock(target: Container | null | undefined): boolean {
    let o: Container | null = target ?? null;
    while (o) {
      if (o === this.uiDock) return true;
      o = o.parent;
    }
    return false;
  }

  private showUiDock() {
    if (this.uiDockShown) return;
    this.uiDockShown = true;
    this.uiDock.visible = true;
    gsap.killTweensOf(this.uiDock.position);
    this.uiDock.position.x = this.uiDockHiddenX;
    const tx = this.uiDockTargetX;
    const recoil = UI_SHOW_RECOIL_PX;
    gsap
      .timeline()
      .to(this.uiDock.position, { x: tx, duration: UI_SHOW_IN_DUR, ease: 'power4.out' })
      .to(this.uiDock.position, { x: tx + recoil, duration: UI_SHOW_RECOIL_DUR, ease: 'power2.out' })
      .to(this.uiDock.position, { x: tx, duration: UI_SHOW_RETURN_DUR, ease: 'sine.inOut' });
  }

  private hideUiDock() {
    const pos = this.uiDock.position;
    const hidden = this.uiDockHiddenX;
    if (!this.uiDock.visible && Math.abs(pos.x - hidden) < 0.5) return;

    this.uiDockShown = false;
    gsap.killTweensOf(pos);
    this.uiDock.visible = true;

    const tx = this.uiDockTargetX;
    const recoil = UI_SHOW_RECOIL_PX;
    if (pos.x < tx) pos.x = tx;
    if (pos.x > tx + recoil) pos.x = tx + recoil;

    gsap
      .timeline({
        onComplete: () => {
          if (this.pointerOverBoard) {
            this.showUiDock();
            return;
          }
          pos.x = hidden;
          this.uiDock.visible = false;
        },
      })
      .to(pos, { x: tx + recoil, duration: UI_SHOW_RETURN_DUR, ease: 'sine.inOut' })
      .to(pos, { x: tx, duration: UI_SHOW_RECOIL_DUR, ease: 'power2.in' })
      .to(pos, { x: hidden, duration: UI_SHOW_IN_DUR, ease: 'power4.in' });
  }

  public hideUiDockInstant() {
    this.uiDockShown = false;
    gsap.killTweensOf(this.uiDock.position);
    this.uiDock.position.set(this.uiDockHiddenX, UI_PAD);
    this.uiDock.visible = false;
  }

  private undoLastStroke() {
    const g = this.strokeChunks.pop();
    if (g) {
      g.destroy({ children: true });
    }
  }

  public getHolstCenterVirtual(): { x: number; y: number } {
    const p = this.board.getGlobalPosition(new Point(CANVAS_W * 0.5, CANVAS_H * 0.5));
    return engine().virtualScreen.toVirtualCoordinates(p.x, p.y);
  }

  public setSpineSlotBoardNudge(offsetX: number, offsetY: number, uniformScale = 1): void {
    this.board.position.set(offsetX, offsetY);
    this.board.scale.set(uniformScale, uniformScale);
  }

  public activate(): void {
    this.detachStageDrag();
    this.detachCanvasHolstPointer();
    this.board.off('pointerdown', this.onBoardDown);
    this.board.on('pointerdown', this.onBoardDown);
    this.attachCanvasHolstPointer();
  }

  public getDrawingContainer(): Container {
    return this.inkStrokesLayer;
  }

  public beginNewSheet(): void {
    this.reset();
    this.activate();
  }

  public tick(_time: Ticker): void {
    if (this.paused) return;
    if (this.isDrawing) this.redrawActiveBrush();
  }

  public layoutBottomCenter(screenW: number, screenH: number): void {
    this.board.position.set(0, 0);
    this.board.scale.set(1, 1);
    this.position.set((screenW - CANVAS_W) * 0.5, screenH - CANVAS_H - MARGIN_FROM_BOTTOM);
  }

  public layoutFullscreenCenter(screenW: number, screenH: number): void {
    this.position.set(0, 0);
    this.board.position.set((screenW - CANVAS_W) * 0.5, (screenH - CANVAS_H) * 0.5);
    this.board.scale.set(1, 1);
  }

  public reset() {
    this.detachStageDrag();
    this.detachCanvasHolstPointer();
    this.endStroke();
    this.hideUiDockInstant();
    this.board.off('pointerdown', this.onBoardDown);
    this.strokeChunks.length = 0;
    for (const ch of [...this.inkStrokesLayer.children]) {
      if (ch !== this.activeStroke) {
        (ch as Graphics).destroy({ children: true });
      }
    }
    this.placedTemplatesLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.placedByCategory.fill(null);
    this.categoryVariantIx[0] = 0;
    this.categoryVariantIx[1] = 0;
    this.categoryVariantIx[2] = 0;
    this.activeStroke.clear();
    this.strokePoints.length = 0;
    this.hideHoverDot();
    this.pointerOverBoard = false;
    this.drawTool = 'brush';
    this.thicknessIx = 1;
    this.eraserNextBakeIndex = 0;
    this.refreshToolChrome();
  }

  public async pause() {
    this.interactiveChildren = false;
    this.paused = true;
  }

  public async resume() {
    this.interactiveChildren = true;
    this.paused = false;
  }

  private localOnBoard(e: FederatedPointerEvent): { x: number; y: number } {
    return this.board.toLocal(e.global);
  }

  private clampToBoard(p: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(CANVAS_W, p.x)),
      y: Math.max(0, Math.min(CANVAS_H, p.y)),
    };
  }

  private brushRadiusAt(elapsedSec: number): number {
    if (this.liveStrokeIsEraser) return this.liveStrokeR1;
    const u = Math.min(1, elapsedSec / BRUSH_GROW_SEC);
    return this.liveStrokeR0 + (this.liveStrokeR1 - this.liveStrokeR0) * this.brushEase(u);
  }

  private beginStroke(p: { x: number; y: number }) {
    const c = this.clampToBoard(p);
    this.lastHover = c;
    const pr = THICKNESS_PRESETS[this.thicknessIx]!;
    this.liveStrokeR0 = pr.r0;
    this.liveStrokeR1 = pr.r1;
    this.liveStrokeIsEraser = this.drawTool === 'eraser';
    this.eraserNextBakeIndex = 0;
    if (this.liveStrokeIsEraser) {
      this.strokeBakeAccum = new Graphics();
      this.addStrokeChunkBeforeActive(this.inkStrokesLayer, this.activeStroke, this.strokeBakeAccum);
    } else {
      this.strokeBakeAccum = null;
    }
    this.pressStartMs = performance.now();
    this.isDrawing = true;
    this.strokePoints.length = 0;
    this.strokePoints.push({ x: c.x, y: c.y, tSec: 0 });
    this.activeStroke.clear();
    this.redrawActiveBrush();
    this.hideHoverDot();
    this.attachStageDrag();
  }

  private appendStrokePoint(x: number, y: number) {
    const last = this.strokePoints[this.strokePoints.length - 1];
    if (!last) return;

    const nowMs = performance.now();
    const tNow = (nowMs - this.pressStartMs) / 1000;
    const rNow = this.brushRadiusAt(tNow);
    const step = Math.max(1.1, rNow * 0.32);

    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < Math.max(0.28, rNow * 0.14)) return;

    const nx = dx / dist;
    const ny = dy / dist;

    if (dist <= step) {
      this.strokePoints.push({ x, y, tSec: tNow });
    } else {
      let s = step;
      let guard = 0;
      const maxInterp = 220;
      while (s < dist && guard++ < maxInterp) {
        const tSec = (performance.now() - this.pressStartMs) / 1000;
        this.strokePoints.push({
          x: last.x + nx * s,
          y: last.y + ny * s,
          tSec,
        });
        s += step;
      }
      this.strokePoints.push({ x, y, tSec: (performance.now() - this.pressStartMs) / 1000 });
    }
    this.commitEraserBakedTrail();
    this.maybeFlushStrokePointBudget();
    this.redrawActiveBrush();
  }

  private endStroke() {
    if (!this.isDrawing) return;
    this.bakeStrokeToFinished();
    this.isDrawing = false;
    this.strokePoints.length = 0;
    this.activeStroke.clear();
    this.detachStageDrag();
    if (this.pointerOverBoard) this.refreshHoverDot();
    else this.hideHoverDot();
  }

  private maybeFlushStrokePointBudget() {
    if (this.strokePoints.length <= STROKE_LIVE_POINT_CAP) return;
    const nMove = this.strokePoints.length - STROKE_LIVE_KEEP;
    if (nMove <= 0) return;
    if (!this.strokeBakeAccum) {
      this.strokeBakeAccum = new Graphics();
      this.addStrokeChunkBeforeActive(this.inkStrokesLayer, this.activeStroke, this.strokeBakeAccum);
    }
    const ink = this.liveStrokeIsEraser ? { color: BOARD_BG, alpha: 1 } : { color: 0x000000, alpha: 1 };
    if (!this.liveStrokeIsEraser) {
      for (let i = 0; i < nMove; i++) {
        const p = this.strokePoints[i]!;
        const r = this.brushRadiusAt(p.tSec);
        this.strokeBakeAccum.circle(p.x, p.y, r).fill(ink);
      }
    }
    if (this.liveStrokeIsEraser) {
      this.removePlacedTemplatesHitByStrokePoints(this.strokePoints.slice(0, nMove));
      this.eraserNextBakeIndex = Math.max(0, this.eraserNextBakeIndex - nMove);
    }
    this.strokePoints.splice(0, nMove);
  }

  /** Запекает пройденный след ластика (кроме кончика у курсора) — сразу видно стирание. */
  private commitEraserBakedTrail() {
    if (!this.liveStrokeIsEraser || !this.strokeBakeAccum) return;
    const n = this.strokePoints.length;
    const from = this.eraserNextBakeIndex;
    const uptoExcl = n - 1;
    if (from >= uptoExcl) return;
    const ink = { color: BOARD_BG, alpha: 1 };
    for (let i = from; i < uptoExcl; i++) {
      const p = this.strokePoints[i]!;
      const r = this.brushRadiusAt(p.tSec);
      this.strokeBakeAccum.circle(p.x, p.y, r).fill(ink);
    }
    this.removePlacedTemplatesHitByStrokePoints(this.strokePoints.slice(from, uptoExcl));
    this.eraserNextBakeIndex = uptoExcl;
  }

  private removePlacedTemplatesHitByStrokePoints(
    points: readonly { x: number; y: number; tSec: number }[],
    nowSecForLast?: number,
  ) {
    if (points.length === 0) return;
    const placedSize = TEMPLATE_CHIP * PLACED_SCALE;
    const layer = this.placedTemplatesLayer;
    const n = points.length;
    const victims: Container[] = [];
    outer: for (const ch of [...layer.children]) {
      const c = ch as Container;
      const rx = c.x;
      const ry = c.y;
      for (let i = 0; i < n; i++) {
        const p = points[i]!;
        let r = this.brushRadiusAt(p.tSec);
        if (i === n - 1 && nowSecForLast !== undefined) {
          r = Math.max(r, this.brushRadiusAt(nowSecForLast));
        }
        if (circleIntersectsAabb(p.x, p.y, r, rx, ry, placedSize, placedSize)) {
          victims.push(c);
          continue outer;
        }
      }
    }
    for (const c of victims) {
      for (let cat = 0; cat < this.placedByCategory.length; cat++) {
        if (this.placedByCategory[cat] === c) {
          this.placedByCategory[cat] = null;
          break;
        }
      }
      layer.removeChild(c);
      c.destroy({ children: true });
    }
  }

  private redrawActiveBrush() {
    this.activeStroke.clear();
    const n = this.strokePoints.length;
    if (n === 0) return;
    const nowSec = (performance.now() - this.pressStartMs) / 1000;
    if (this.liveStrokeIsEraser) {
      const p = this.strokePoints[n - 1]!;
      const r = this.liveStrokeR1;
      this.activeStroke
        .circle(p.x, p.y, r)
        .fill({ color: ERASER_LIVE_FILL, alpha: ERASER_LIVE_FILL_ALPHA })
        .stroke({ width: 2, color: ERASER_LIVE_STROKE, alpha: 0.92 });
      return;
    }
    for (let i = 0; i < n; i++) {
      const p = this.strokePoints[i]!;
      let r = this.brushRadiusAt(p.tSec);
      if (i === n - 1) {
        r = Math.max(r, this.brushRadiusAt(nowSec));
      }
      this.activeStroke.circle(p.x, p.y, r).fill({ color: 0x0a0a0a, alpha: 0.96 });
    }
  }

  private bakeStrokeToFinished() {
    const n = this.strokePoints.length;
    if (n === 0) return;
    const nowSec = (performance.now() - this.pressStartMs) / 1000;
    if (this.liveStrokeIsEraser) {
      const g = this.strokeBakeAccum ?? new Graphics();
      if (!this.strokeBakeAccum) {
        this.addStrokeChunkBeforeActive(this.inkStrokesLayer, this.activeStroke, g);
      }
      const ink = { color: BOARD_BG, alpha: 1 };
      for (let i = this.eraserNextBakeIndex; i < n; i++) {
        const p = this.strokePoints[i]!;
        let r = this.brushRadiusAt(p.tSec);
        if (i === n - 1) {
          r = Math.max(r, this.brushRadiusAt(nowSec));
        }
        g.circle(p.x, p.y, r).fill(ink);
      }
      this.removePlacedTemplatesHitByStrokePoints(this.strokePoints, nowSec);
      this.strokeChunks.push(g);
      this.strokeBakeAccum = null;
      this.eraserNextBakeIndex = 0;
      return;
    }
    const g = this.strokeBakeAccum ?? new Graphics();
    if (!this.strokeBakeAccum) {
      this.addStrokeChunkBeforeActive(this.inkStrokesLayer, this.activeStroke, g);
    }
    const ink = { color: 0x000000, alpha: 1 };
    for (let i = 0; i < n; i++) {
      const p = this.strokePoints[i]!;
      let r = this.brushRadiusAt(p.tSec);
      if (i === n - 1) {
        r = Math.max(r, this.brushRadiusAt(nowSec));
      }
      g.circle(p.x, p.y, r).fill(ink);
    }
    this.strokeChunks.push(g);
    this.strokeBakeAccum = null;
  }

  private moveHoverDot(x: number, y: number) {
    const c = this.clampToBoard({ x, y });
    const pr = THICKNESS_PRESETS[this.thicknessIx]!;
    this.hoverDot.clear();
    if (this.drawTool === 'eraser') {
      this.hoverDot
        .circle(c.x, c.y, pr.r1)
        .fill({ color: ERASER_LIVE_FILL, alpha: ERASER_LIVE_FILL_ALPHA })
        .stroke({ width: 2, color: ERASER_LIVE_STROKE, alpha: 0.9 });
    } else {
      this.hoverDot
        .circle(c.x, c.y, pr.r0)
        .fill({ color: 0x1a1a1a, alpha: 0.88 })
        .stroke({ width: 1, color: 0xffffff, alpha: 0.75 });
    }
    this.hoverDot.visible = true;
  }

  private refreshHoverDot() {
    if (this.pointerOverBoard && !this.isDrawing) {
      this.moveHoverDot(this.lastHover.x, this.lastHover.y);
    }
  }

  private hideHoverDot() {
    this.hoverDot.clear();
    this.hoverDot.visible = false;
  }

  private attachStageDrag() {
    if (this.stageDragAttached) return;
    const stage = engine().stage;
    stage.on('pointermove', this.onStageMove);
    stage.on('pointerup', this.onStageUp);
    stage.on('pointerupoutside', this.onStageUp);
    this.stageDragAttached = true;
  }

  private detachStageDrag() {
    if (!this.stageDragAttached) return;
    const stage = engine().stage;
    stage.off('pointermove', this.onStageMove);
    stage.off('pointerup', this.onStageUp);
    stage.off('pointerupoutside', this.onStageUp);
    this.stageDragAttached = false;
  }

  private attachCanvasHolstPointer() {
    if (this.canvasHolstPointerAttached) return;
    const canvas = engine().canvas;
    canvas.addEventListener('pointermove', this.onDomCanvasPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', this.onDomCanvasPointerLeave);
    this.canvasHolstPointerAttached = true;
  }

  private detachCanvasHolstPointer() {
    if (!this.canvasHolstPointerAttached) return;
    const canvas = engine().canvas;
    canvas.removeEventListener('pointermove', this.onDomCanvasPointerMove);
    canvas.removeEventListener('pointerleave', this.onDomCanvasPointerLeave);
    this.canvasHolstPointerAttached = false;
  }
}

function circleIntersectsAabb(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const px = Math.max(rx, Math.min(cx, rx + rw));
  const py = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy <= r * r;
}
