import { engine } from '@/app/getEngine';
import type { PartIds } from '@/shared/serverTypes';
import gsap from 'gsap';
import {
  Container,
  type FederatedPointerEvent,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type Ticker,
} from 'pixi.js';
import { BOARD_BG, CANVAS_H, CANVAS_W, ERASER_LIVE_FILL, ERASER_LIVE_FILL_ALPHA } from './Drawing';

const ERASER_LIVE_STROKE = 0x4a4a55;
const BRUSH_GROW_SEC = 1.05;

const THICKNESS_PRESETS = [
  { r0: 2, r1: 4 },
  { r0: 4, r1: 8 },
  { r0: 8, r1: 16 },
] as const;

/** Короткие алиасы AssetPack (`createShortcuts` + `trimExtensions`). */
const DRAWING_TEX = {
  paper: 'paper_template',
  arrow: 'arrow',
  head: (i: number) => `head_template_${i}`,
} as const;

const HEAD_TEMPLATE_COUNT = 5;

const STROKE_LIVE_POINT_CAP = 340;
const STROKE_LIVE_KEEP = 40;

const MARGIN_FROM_BOTTOM = 48;

const TEMPLATE_NAV_BTN_W = 44;
const TEMPLATE_NAV_BTN_H = 52;
const TEMPLATE_TOP_PAD = 44;
const TEMPLATE_SIDE_PAD = 8;

export type DrawTool = 'brush' | 'eraser';

export class GameDrawingBoard extends Container {
  private paused = false;

  public onSubmitted: (data: string, skins: PartIds) => void = () => {};

  private board: Container;
  private bg: Sprite;
  /** Один слой: кисть и ластик в порядке рисования, чтобы после стирания снова можно было рисовать сверху. */
  private inkStrokesLayer: Container;
  private placedTemplatesLayer: Container;
  private templateSprite: Sprite;
  private templateLeftBtn!: Container;
  private templateRightBtn!: Container;
  private templateIndexLabel!: Text;
  private activeStroke: Graphics;
  private hoverDot: Graphics;
  private boardHolstMask: Graphics;

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

  private stageDragAttached = false;
  private canvasHolstPointerAttached = false;
  private pointerOverBoard = false;
  private lastHover = { x: CANVAS_W * 0.5, y: CANVAS_H * 0.5 };

  private headTemplateIndex = 0;

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
    if (this.pointerOverBoard) {
      this.pointerOverBoard = false;
      this.hideHoverDot();
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
      }
      this.moveHoverDot(c.x, c.y);
    } else {
      if (this.pointerOverBoard) {
        this.pointerOverBoard = false;
        this.hideHoverDot();
      }
    }
  }

  private readonly onBoardDown = (e: FederatedPointerEvent) => {
    if (this.isTemplateNavTarget(e.target as Container)) return;
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

    this.bg = new Sprite({ texture: Texture.from(DRAWING_TEX.paper), label: 'drawing_bg' });
    this.bg.eventMode = 'none';
    this.bg.setSize(CANVAS_W, CANVAS_H);
    this.board.addChild(this.bg);

    this.placedTemplatesLayer = new Container();
    this.placedTemplatesLayer.label = 'drawing_placed_templates';
    this.placedTemplatesLayer.eventMode = 'none';
    this.board.addChild(this.placedTemplatesLayer);

    this.templateSprite = new Sprite({ texture: Texture.from(DRAWING_TEX.head(1)), label: 'drawing_head_template' });
    this.templateSprite.eventMode = 'none';
    this.templateSprite.anchor.set(0.5);
    this.placedTemplatesLayer.addChild(this.templateSprite);

    this.inkStrokesLayer = new Container();
    this.inkStrokesLayer.label = 'drawing_ink_strokes';
    this.inkStrokesLayer.eventMode = 'none';
    this.board.addChild(this.inkStrokesLayer);

    this.activeStroke = new Graphics();
    this.activeStroke.label = 'drawing_stroke_active';
    this.activeStroke.eventMode = 'none';
    this.inkStrokesLayer.addChild(this.activeStroke);

    this.setupTemplateControls();

    this.hoverDot = new Graphics();
    this.hoverDot.label = 'drawing_hover_dot';
    this.hoverDot.eventMode = 'none';
    this.hoverDot.visible = false;
    this.board.addChild(this.hoverDot);

    this.boardHolstMask = new Graphics();
    this.boardHolstMask.label = 'drawing_board_mask';
    this.boardHolstMask.eventMode = 'none';
    this.boardHolstMask.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: 0xffffff, alpha: 1 });
    this.board.addChild(this.boardHolstMask);
    this.board.mask = this.boardHolstMask;

    this.layoutHeadTemplate();
    this.refreshTemplateIndexLabel();

    this.addChild(this.board);
  }

  private setupTemplateControls() {
    const mkArrow = (dir: -1 | 1) => {
      const c = new Container();
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.hitArea = new Rectangle(0, 0, TEMPLATE_NAV_BTN_W, TEMPLATE_NAV_BTN_H);
      const s = new Sprite({ texture: Texture.from(DRAWING_TEX.arrow) });
      s.anchor.set(0.5);
      s.position.set(TEMPLATE_NAV_BTN_W * 0.5, TEMPLATE_NAV_BTN_H * 0.5);
      if (dir < 0) {
        s.scale.x = -1;
      }
      c.addChild(s);
      return c;
    };

    /* Текстура стрелки смотрит влево: слева без зеркала — наружу, справа с зеркалом — наружу. */
    /* Справа — следующий шаблон (1→2→…), слева — предыдущий. */
    this.templateRightBtn = mkArrow(-1);
    this.templateRightBtn.label = 'drawing_template_next';
    this.templateRightBtn.position.set(
      CANVAS_W - TEMPLATE_SIDE_PAD - TEMPLATE_NAV_BTN_W,
      (CANVAS_H - TEMPLATE_NAV_BTN_H) * 0.5,
    );
    this.templateRightBtn.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.cycleHeadTemplate(1);
    });
    this.board.addChild(this.templateRightBtn);

    this.templateLeftBtn = mkArrow(1);
    this.templateLeftBtn.label = 'drawing_template_prev';
    this.templateLeftBtn.position.set(TEMPLATE_SIDE_PAD, (CANVAS_H - TEMPLATE_NAV_BTN_H) * 0.5);
    this.templateLeftBtn.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.cycleHeadTemplate(-1);
    });
    this.board.addChild(this.templateLeftBtn);

    this.templateIndexLabel = new Text({
      text: '#1',
      style: {
        fill: 0x3a3a3a,
        fontFamily: 'sans-serif',
        fontSize: 18,
        fontWeight: '600',
      },
    });
    this.templateIndexLabel.label = 'drawing_template_index';
    this.templateIndexLabel.anchor.set(1, 0);
    this.templateIndexLabel.position.set(CANVAS_W - 14, 10);
    this.templateIndexLabel.eventMode = 'none';
    this.board.addChild(this.templateIndexLabel);
  }

  private isTemplateNavTarget(target: Container | null | undefined): boolean {
    let o: Container | null = target ?? null;
    while (o) {
      if (o === this.templateLeftBtn || o === this.templateRightBtn) return true;
      o = o.parent;
    }
    return false;
  }

  private cycleHeadTemplate(delta: number) {
    if (this.isDrawing) return;
    const n = HEAD_TEMPLATE_COUNT;
    this.headTemplateIndex = (this.headTemplateIndex + delta + n * 16) % n;
    this.templateSprite.texture = Texture.from(DRAWING_TEX.head(this.headTemplateIndex + 1));
    this.layoutHeadTemplate();
    this.refreshTemplateIndexLabel();
  }

  private layoutHeadTemplate() {
    const tw = this.templateSprite.texture.width;
    const th = this.templateSprite.texture.height;
    if (tw <= 0 || th <= 0) return;

    const maxW = CANVAS_W - TEMPLATE_SIDE_PAD * 2 - TEMPLATE_NAV_BTN_W * 2 - 16;
    const maxH = CANVAS_H - TEMPLATE_TOP_PAD - 24;
    const s = Math.min(maxW / tw, maxH / th);
    this.templateSprite.scale.set(s);
    this.templateSprite.position.set(CANVAS_W * 0.5, TEMPLATE_TOP_PAD + maxH * 0.5);
  }

  private refreshTemplateIndexLabel() {
    this.templateIndexLabel.text = `#${this.headTemplateIndex + 1}`;
  }

  public setDrawTool(t: DrawTool): void {
    if (this.isDrawing) return;
    if (this.drawTool === t) return;
    this.drawTool = t;
    if (this.pointerOverBoard && !this.isDrawing) this.refreshHoverDot();
  }

  public setThicknessIx(ix: number): void {
    if (this.isDrawing) return;
    if (ix < 0 || ix >= THICKNESS_PRESETS.length) return;
    if (this.thicknessIx === ix) return;
    this.thicknessIx = ix;
    if (this.pointerOverBoard && !this.isDrawing) this.refreshHoverDot();
  }

  private addStrokeChunkBeforeActive(parent: Container, activeG: Graphics, chunk: Graphics) {
    const i = parent.getChildIndex(activeG);
    parent.addChildAt(chunk, i);
  }

  public hideUiDockInstant() {
    /* UI планшета вынесен в Spine слева; метод оставлен для совместимости с DrawingScreen / Drawing. */
  }

  private undoLastStroke() {
    const g = this.strokeChunks.pop();
    if (g) {
      g.destroy({ children: true });
    }
  }

  /** Вызывается из UI слева (планшет / Spine). */
  public undoLastStrokeFromUi(): void {
    if (this.isDrawing) return;
    this.undoLastStroke();
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

  public beginNewSheet(_skins: PartIds): void {
    void _skins;
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
    this.activeStroke.clear();
    this.strokePoints.length = 0;
    this.hideHoverDot();
    this.pointerOverBoard = false;
    this.drawTool = 'brush';
    this.thicknessIx = 1;
    this.eraserNextBakeIndex = 0;
    this.headTemplateIndex = 0;
    this.templateSprite.texture = Texture.from(DRAWING_TEX.head(1));
    this.layoutHeadTemplate();
    this.refreshTemplateIndexLabel();
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
    this.eraserNextBakeIndex = uptoExcl;
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
