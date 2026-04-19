import { engine } from '@/app/getEngine';
import type { AppScreen } from '@/engine/navigation/navigation';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, Graphics, Rectangle, Text, type Ticker } from 'pixi.js';

const CANVAS_W = 960;
const CANVAS_H = 640;
const BRUSH_R0 = 4;
const BRUSH_R1 = BRUSH_R0 * 2;
const BRUSH_GROW_SEC = 1.05;

const UI_PAD = 10;
const UI_W = 168;
const TEMPLATE_CHIP = 52;
const TEMPLATE_GAP = 8;
const TEMPLATES_TOP = 78;
const PANEL_BOTTOM_PAD = 18;
const TEMPLATE_ROWS = 3;
const UI_PANEL_H =
  TEMPLATES_TOP + TEMPLATE_ROWS * TEMPLATE_CHIP + (TEMPLATE_ROWS - 1) * TEMPLATE_GAP + PANEL_BOTTOM_PAD;
const PLACED_SCALE = 1.35;

const UI_SHOW_IN_DUR = 0.34;
const UI_SHOW_RECOIL_DUR = 0.12;
const UI_SHOW_RETURN_DUR = 0.1;
const UI_SHOW_RECOIL_PX = 10;

type TemplateKind = 'heart' | 'star' | 'cloud';

export class DrawingScreen extends Container implements AppScreen {
  public static assetBundles = ['main'];

  public mainContainer: Container;
  private paused = false;

  private board: Container;
  private bg: Graphics;
  private strokesLayer: Container;
  private placedTemplatesLayer: Container;
  private activeLine: Graphics;
  private hoverDot: Graphics;
  private boardHolstMask: Graphics;
  private uiDock!: Container;

  private readonly strokeChunks: Graphics[] = [];
  private readonly strokePoints: { x: number; y: number; tSec: number }[] = [];
  private pressStartMs = 0;
  private readonly brushEase = gsap.parseEase('power2.out');
  private isDrawing = false;
  private stageDragAttached = false;
  private canvasHolstPointerAttached = false;
  private pointerOverBoard = false;
  private lastHover = { x: CANVAS_W * 0.5, y: CANVAS_H * 0.5 };

  private uiDockShown = false;
  private uiDockTargetX = 0;
  private uiDockHiddenX = 0;

  private dragKind: TemplateKind | null = null;
  private dragGhost: Container | null = null;
  private dragGrabOnChip = { x: TEMPLATE_CHIP * 0.5, y: TEMPLATE_CHIP * 0.5 };
  private stageTemplateDrag = false;
  private readonly onStageTemplateMove = (e: FederatedPointerEvent) => this.handleTemplateDragMove(e);
  private readonly onStageTemplateUp = (e: FederatedPointerEvent) => this.handleTemplateDragUp(e);

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
    const lp = {
      x: vx - this.board.position.x,
      y: vy - this.board.position.y,
    };
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
    this.appendStrokePoint(p.x, p.y);
  };
  private readonly onStageUp = (_e: FederatedPointerEvent) => {
    this.endStroke();
  };

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    this.board = new Container();
    this.board.label = 'drawing_board';
    this.board.eventMode = 'static';
    this.board.cursor = 'none';
    this.board.hitArea = new Rectangle(0, 0, CANVAS_W, CANVAS_H);

    this.bg = new Graphics();
    this.bg.label = 'drawing_bg';
    this.bg.eventMode = 'none';
    this.bg
      .rect(0, 0, CANVAS_W, CANVAS_H)
      .fill({ color: 0xf5f5f5, alpha: 1 })
      .stroke({ width: 2, color: 0x333333, alpha: 1 });
    this.board.addChild(this.bg);

    this.strokesLayer = new Container();
    this.strokesLayer.label = 'drawing_strokes';
    this.strokesLayer.eventMode = 'none';
    this.board.addChild(this.strokesLayer);

    this.placedTemplatesLayer = new Container();
    this.placedTemplatesLayer.label = 'drawing_placed_templates';
    this.placedTemplatesLayer.eventMode = 'none';
    this.board.addChild(this.placedTemplatesLayer);

    this.activeLine = new Graphics();
    this.activeLine.label = 'drawing_lines_active';
    this.activeLine.eventMode = 'none';
    this.board.addChild(this.activeLine);

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

    this.mainContainer.addChild(this.board);
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
    undoBtn.on('pointertap', () => this.undoLastStroke());
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

    const tplTitle = new Text({
      text: 'Templates',
      style: { fill: 0xc8ccd4, fontFamily: 'sans-serif', fontSize: 12 },
    });
    tplTitle.position.set(10, 56);
    this.uiDock.addChild(tplTitle);

    const kinds: TemplateKind[] = ['heart', 'star', 'cloud'];
    let y = TEMPLATES_TOP;
    for (const kind of kinds) {
      const chip = this.makeTemplateChip(kind);
      chip.position.set((UI_W - TEMPLATE_CHIP) * 0.5, y);
      this.uiDock.addChild(chip);
      y += TEMPLATE_CHIP + TEMPLATE_GAP;
    }

    this.uiDockTargetX = CANVAS_W - UI_W - UI_PAD;
    this.uiDockHiddenX = CANVAS_W;
    this.uiDock.position.set(this.uiDockHiddenX, UI_PAD);
    this.board.addChild(this.uiDock);
  }

  private makeTemplateChip(kind: TemplateKind): Container {
    const c = new Container();
    c.label = `template_chip_${kind}`;
    c.eventMode = 'static';
    c.cursor = 'grab';
    c.hitArea = new Rectangle(0, 0, TEMPLATE_CHIP, TEMPLATE_CHIP);
    const g = new Graphics();
    drawTemplateShape(g, kind, TEMPLATE_CHIP);
    c.addChild(g);
    c.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.beginTemplateDrag(kind, c, e);
    });
    return c;
  }

  private beginTemplateDrag(kind: TemplateKind, chip: Container, e: FederatedPointerEvent) {
    if (this.dragGhost) return;
    const lp = this.board.toLocal(e.global);
    const localOnChip = chip.toLocal(e.global);
    this.dragGrabOnChip = {
      x: Math.max(0, Math.min(TEMPLATE_CHIP, localOnChip.x)),
      y: Math.max(0, Math.min(TEMPLATE_CHIP, localOnChip.y)),
    };
    this.dragKind = kind;
    this.stageTemplateDrag = true;
    this.dragGhost = new Container();
    this.dragGhost.label = 'template_drag_ghost';
    this.dragGhost.eventMode = 'none';
    const g = new Graphics();
    drawTemplateShape(g, kind, TEMPLATE_CHIP);
    this.dragGhost.addChild(g);
    this.dragGhost.position.set(lp.x - this.dragGrabOnChip.x, lp.y - this.dragGrabOnChip.y);
    this.board.addChild(this.dragGhost);

    const st = engine().stage;
    st.on('pointermove', this.onStageTemplateMove);
    st.on('pointerup', this.onStageTemplateUp);
    st.on('pointerupoutside', this.onStageTemplateUp);
  }

  private handleTemplateDragMove(e: FederatedPointerEvent) {
    if (!this.dragGhost) return;
    const lp = this.board.toLocal(e.global);
    this.dragGhost.position.set(lp.x - this.dragGrabOnChip.x, lp.y - this.dragGrabOnChip.y);
  }

  private handleTemplateDragUp(e: FederatedPointerEvent) {
    if (!this.dragGhost || !this.dragKind) {
      this.cleanupTemplateDrag();
      return;
    }
    const lp = this.board.toLocal(e.global);
    const x = lp.x;
    const y = lp.y;

    const onCanvas = x >= 0 && x <= CANVAS_W && y >= 0 && y <= CANVAS_H && !this.pointInUiDock(lp.x, lp.y);

    if (onCanvas) {
      const placedSize = TEMPLATE_CHIP * PLACED_SCALE;
      const ox = (this.dragGrabOnChip.x / TEMPLATE_CHIP) * placedSize;
      const oy = (this.dragGrabOnChip.y / TEMPLATE_CHIP) * placedSize;
      const placed = new Container();
      placed.label = `placed_${this.dragKind}`;
      placed.eventMode = 'none';
      placed.position.set(x - ox, y - oy);
      const g = new Graphics();
      drawTemplateShape(g, this.dragKind, placedSize);
      placed.addChild(g);
      this.placedTemplatesLayer.addChild(placed);
    }

    this.dragGhost.destroy({ children: true });
    this.dragGhost = null;
    this.dragKind = null;
    this.cleanupTemplateDrag();

    if (!this.pointerOverBoard) this.hideUiDock();
  }

  private cleanupTemplateDrag() {
    this.stageTemplateDrag = false;
    const st = engine().stage;
    st.off('pointermove', this.onStageTemplateMove);
    st.off('pointerup', this.onStageTemplateUp);
    st.off('pointerupoutside', this.onStageTemplateUp);
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

  private hideUiDockInstant() {
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

  public prepare() {
    this.mainContainer.alpha = 0;
    this.detachStageDrag();
    this.detachCanvasHolstPointer();
    this.cleanupTemplateDrag();
    this.board.off('pointerdown', this.onBoardDown);
    this.board.on('pointerdown', this.onBoardDown);
    this.attachCanvasHolstPointer();
  }

  public async show(): Promise<void> {
    await gsap.to(this.mainContainer, { alpha: 1, duration: 0.35 });
  }

  public async hide(): Promise<void> {
    this.hideUiDockInstant();
    await gsap.to(this.mainContainer, { alpha: 0, scale: 1.02, duration: 0.35 });
    this.mainContainer.scale.set(1);
  }

  public update(_time: Ticker) {
    if (this.paused) return;
    if (this.isDrawing) this.redrawActiveBrush();
  }

  public resize(width: number, height: number) {
    this.board.position.set((width - CANVAS_W) * 0.5, (height - CANVAS_H) * 0.5);
  }

  public reset() {
    this.detachStageDrag();
    this.detachCanvasHolstPointer();
    this.cleanupTemplateDrag();
    this.endStroke();
    this.hideUiDockInstant();
    this.board.off('pointerdown', this.onBoardDown);
    for (const g of this.strokeChunks) {
      g.destroy({ children: true });
    }
    this.strokeChunks.length = 0;
    this.placedTemplatesLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.activeLine.clear();
    this.strokePoints.length = 0;
    this.hideHoverDot();
    this.pointerOverBoard = false;
  }

  public async pause() {
    this.mainContainer.interactiveChildren = false;
    this.paused = true;
  }

  public async resume() {
    this.mainContainer.interactiveChildren = true;
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
    const u = Math.min(1, elapsedSec / BRUSH_GROW_SEC);
    return BRUSH_R0 + (BRUSH_R1 - BRUSH_R0) * this.brushEase(u);
  }

  private beginStroke(p: { x: number; y: number }) {
    const c = this.clampToBoard(p);
    this.pressStartMs = performance.now();
    this.isDrawing = true;
    this.strokePoints.length = 0;
    this.strokePoints.push({ x: c.x, y: c.y, tSec: 0 });
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
    const step = Math.max(0.35, rNow * 0.1);

    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.12) return;

    const nx = dx / dist;
    const ny = dy / dist;

    if (dist <= step) {
      this.strokePoints.push({ x, y, tSec: tNow });
    } else {
      let s = step;
      let guard = 0;
      const maxInterp = 4096;
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
    this.redrawActiveBrush();
  }

  private endStroke() {
    if (!this.isDrawing) return;
    this.bakeStrokeToFinished();
    this.isDrawing = false;
    this.strokePoints.length = 0;
    this.activeLine.clear();
    this.detachStageDrag();
    if (this.pointerOverBoard) this.refreshHoverDot();
    else this.hideHoverDot();
  }

  private redrawActiveBrush() {
    this.activeLine.clear();
    const n = this.strokePoints.length;
    if (n === 0) return;
    const nowSec = (performance.now() - this.pressStartMs) / 1000;
    for (let i = 0; i < n; i++) {
      const p = this.strokePoints[i]!;
      let r = this.brushRadiusAt(p.tSec);
      if (i === n - 1) {
        r = Math.max(r, this.brushRadiusAt(nowSec));
      }
      this.activeLine.circle(p.x, p.y, r).fill({ color: 0x0a0a0a, alpha: 0.96 });
    }
  }

  private bakeStrokeToFinished() {
    const n = this.strokePoints.length;
    if (n === 0) return;
    const g = new Graphics();
    const nowSec = (performance.now() - this.pressStartMs) / 1000;
    for (let i = 0; i < n; i++) {
      const p = this.strokePoints[i]!;
      let r = this.brushRadiusAt(p.tSec);
      if (i === n - 1) {
        r = Math.max(r, this.brushRadiusAt(nowSec));
      }
      g.circle(p.x, p.y, r).fill({ color: 0x000000, alpha: 1 });
    }
    this.strokesLayer.addChild(g);
    this.strokeChunks.push(g);
  }

  private moveHoverDot(x: number, y: number) {
    const c = this.clampToBoard({ x, y });
    this.hoverDot.clear();
    this.hoverDot
      .circle(c.x, c.y, BRUSH_R0)
      .fill({ color: 0x1a1a1a, alpha: 0.88 })
      .stroke({ width: 1, color: 0xffffff, alpha: 0.75 });
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

function drawTemplateShape(g: Graphics, kind: TemplateKind, size: number) {
  g.clear();
  const cx = size * 0.5;
  const cy = size * 0.5;
  const stroke = { width: 2, color: 0x1a1a1a, alpha: 1 };
  switch (kind) {
    case 'heart': {
      const s = size * 0.22;
      g.moveTo(cx, cy + s * 1.2);
      g.bezierCurveTo(cx - s * 3, cy - s * 0.2, cx - s * 1.5, cy - s * 2.2, cx, cy - s * 0.9);
      g.bezierCurveTo(cx + s * 1.5, cy - s * 2.2, cx + s * 3, cy - s * 0.2, cx, cy + s * 1.2);
      g.closePath();
      g.fill({ color: 0xff6b8a, alpha: 0.85 });
      g.stroke(stroke);
      break;
    }
    case 'star': {
      const spikes = 5;
      const rOut = size * 0.38;
      const rIn = rOut * 0.42;
      for (let i = 0; i < spikes * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / spikes;
        const rr = i % 2 === 0 ? rOut : rIn;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill({ color: 0xffd54a, alpha: 0.9 });
      g.stroke(stroke);
      break;
    }
    case 'cloud': {
      const r0 = size * 0.14;
      g.circle(cx - size * 0.18, cy, r0 * 1.1)
        .fill({ color: 0xe3f2fd, alpha: 0.95 })
        .stroke(stroke);
      g.circle(cx, cy - r0 * 0.3, r0 * 1.25)
        .fill({ color: 0xe3f2fd, alpha: 0.95 })
        .stroke(stroke);
      g.circle(cx + size * 0.18, cy, r0 * 1.05)
        .fill({ color: 0xe3f2fd, alpha: 0.95 })
        .stroke(stroke);
      g.circle(cx - size * 0.08, cy + r0 * 0.5, r0)
        .fill({ color: 0xe3f2fd, alpha: 0.95 })
        .stroke(stroke);
      g.circle(cx + size * 0.1, cy + r0 * 0.45, r0 * 0.95)
        .fill({ color: 0xe3f2fd, alpha: 0.95 })
        .stroke(stroke);
      break;
    }
    default:
      break;
  }
}
