import { Container, Sprite, Texture } from 'pixi.js';
import type { DrawTool } from './GameDrawingBoard';

interface ToolButton {
  container: Container;
  onSprite: Sprite;
  offSprite: Sprite;
}

/**
 * UI инструментов для рисования планшета
 * Располагается слева от холста в слоте Container_Tools
 */
export class DrawingToolsUI extends Container {
  private cursorBtn!: ToolButton;
  private undoBtn!: ToolButton;
  private brushBtn!: ToolButton;
  private eraserBtn!: ToolButton;
  private sizeButtons: ToolButton[] = [];

  private currentTool: DrawTool = 'brush';
  private currentSize = 1;

  private onToolChange: ((tool: DrawTool) => void) | null = null;
  private onSizeChange: ((size: 0 | 1 | 2) => void) | null = null;
  private onUndo: (() => void) | null = null;
  private onCursorToggle: ((enabled: boolean) => void) | null = null;

  constructor() {
    super();
    this.label = 'drawing_tools_ui';
    this.buildUI();
  }

  private buildUI(): void {
    const PADDING = 12;
    const BTN_SPACING = 8;
    let yPos = PADDING;

    // === Cursor Button (режим выбора шаблона) ===
    this.cursorBtn = this.createButton(
      'Cursor_on',
      'Cursor_off',
      'drawing_btn_cursor',
    );
    this.cursorBtn.container.position.set(PADDING, yPos);
    this.addChild(this.cursorBtn.container);
    this.cursorBtn.container.on('pointertap', () => this.toggleCursor());
    yPos += this.getButtonHeight() + BTN_SPACING;

    // === Undo Button ===
    this.undoBtn = this.createButton(
      'Undo_on',
      'Undo_off',
      'drawing_btn_undo',
    );
    this.undoBtn.container.position.set(PADDING, yPos);
    this.addChild(this.undoBtn.container);
    this.undoBtn.container.on('pointertap', () => {
      if (this.onUndo) this.onUndo();
    });
    yPos += this.getButtonHeight() + BTN_SPACING * 2; // Extra space after undo

    // === Pencil Button (кисть) ===
    this.brushBtn = this.createButton(
      'Pencil_on',
      'Pencil_off',
      'drawing_btn_brush',
    );
    this.brushBtn.container.position.set(PADDING, yPos);
    this.addChild(this.brushBtn.container);
    this.brushBtn.container.on('pointertap', () => this.selectTool('brush'));
    yPos += this.getButtonHeight() + BTN_SPACING;

    // === Eraser Button ===
    this.eraserBtn = this.createButton(
      'Eraser_on',
      'Eraser_off',
      'drawing_btn_eraser',
    );
    this.eraserBtn.container.position.set(PADDING, yPos);
    this.addChild(this.eraserBtn.container);
    this.eraserBtn.container.on('pointertap', () => this.selectTool('eraser'));
    yPos += this.getButtonHeight() + BTN_SPACING * 2; // Extra space before sizes

    // === Size Buttons (1, 2, 3) ===
    for (let i = 0; i < 3; i++) {
      const sizeBtn = this.createButton(
        `size_selected_${i + 1}`,
        `size_${i === 1 ? '2' : i + 1}`,
        `drawing_btn_size_${i}`,
      );
      sizeBtn.container.position.set(PADDING, yPos);
      this.addChild(sizeBtn.container);
      this.sizeButtons.push(sizeBtn);

      const sizeIdx = i as 0 | 1 | 2;
      sizeBtn.container.on('pointertap', () => this.selectSize(sizeIdx));
      yPos += this.getButtonHeight() + BTN_SPACING;
    }

    this.updateState();
  }

  private createButton(
    onTexName: string,
    offTexName: string,
    label: string,
  ): ToolButton {
    const container = new Container();
    container.label = label;
    container.eventMode = 'static';
    container.cursor = 'pointer';

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

    return { container, onSprite, offSprite };
  }

  private getButtonHeight(): number {
    return this.brushBtn?.onSprite.height ?? 60;
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

  private toggleCursor(): void {
    // Cursor mode - disables drawing, enables template selection
    const cursorEnabled = this.cursorBtn.onSprite.visible;
    if (this.onCursorToggle) {
      this.onCursorToggle(!cursorEnabled);
    }
    // Toggle sprite visibility
    this.cursorBtn.onSprite.visible = !cursorEnabled;
    this.cursorBtn.offSprite.visible = cursorEnabled;
  }

  private updateState(): void {
    // Update tool buttons
    this.brushBtn.onSprite.visible = this.currentTool === 'brush';
    this.brushBtn.offSprite.visible = this.currentTool !== 'brush';

    this.eraserBtn.onSprite.visible = this.currentTool === 'eraser';
    this.eraserBtn.offSprite.visible = this.currentTool !== 'eraser';

    // Update size buttons
    for (let i = 0; i < this.sizeButtons.length; i++) {
      const btn = this.sizeButtons[i]!;
      const isActive = i === this.currentSize;
      btn.onSprite.visible = isActive;
      btn.offSprite.visible = !isActive;
    }
  }

  // Public API

  public setOnToolChange(cb: (tool: DrawTool) => void): void {
    this.onToolChange = cb;
  }

  public setOnSizeChange(cb: (size: 0 | 1 | 2) => void): void {
    this.onSizeChange = cb;
  }

  public setOnUndo(cb: () => void): void {
    this.onUndo = cb;
  }

  public setOnCursorToggle(cb: (enabled: boolean) => void): void {
    this.onCursorToggle = cb;
  }
}
