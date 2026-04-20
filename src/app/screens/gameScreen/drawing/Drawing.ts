export const CANVAS_W = 500;
export const CANVAS_H = 720;
export const BOARD_BG = 0xe8dcc8;
export const ERASER_LIVE_FILL = 0xd4c9b8;
export const ERASER_LIVE_FILL_ALPHA = 0.72;

import { engine } from '@/app/getEngine';
import type { PartIds } from '@/shared/serverTypes';
import { Rectangle, type Ticker } from 'pixi.js';
import { DrawingPadController } from './DrawingPadController';
import { GameDrawingBoard } from './GameDrawingBoard';
import { StampController } from './StampController';
import { encodeInkLayer } from './drawingEncoder';

export class Drawing {
  private drawingPadSpine: DrawingPadController;
  private stampSpine: StampController;
  private board: GameDrawingBoard;

  // Ожидание первого взаимодействие с рисованием
  private cameraButtonPressPromise: Promise<void> | null = null;
  private resolveCameraButtonPress: (() => void) | null = null;

  // Ожидание нажатия на кнопку штампа
  private stampButtonPressPromise: Promise<void> | null = null;
  private resolveStampButtonPress: (() => void) | null = null;

  constructor() {
    this.drawingPadSpine = new DrawingPadController();

    this.stampSpine = new StampController(() => this.onStampButtonPressed());
    this.board = new GameDrawingBoard();

    this.drawingPadSpine.mountBoard(this.board);

    // Позиционирование доски внутри планшета.
    this.setBoardNudge(-210, -345);
  }

  public update(dt: number): void {
    this.drawingPadSpine.update(dt);
    this.stampSpine.update(dt);
    this.board.tick({ deltaMS: dt * 1000 } as Ticker);
  }

  public getDrawingPadSpine(): DrawingPadController {
    return this.drawingPadSpine;
  }

  public getStampSpine(): StampController {
    return this.stampSpine;
  }

  // --- Делегирование публичного API GameDrawingBoard ---

  public async getDrawingData(): Promise<string> {
    const container = this.board.getDrawingContainer();

    const srcCanvas = engine().renderer.extract.canvas({
      target: container,
      frame: new Rectangle(0, 0, CANVAS_W, CANVAS_H),
      resolution: 1,
    }) as HTMLCanvasElement;

    return encodeInkLayer(srcCanvas, BOARD_BG);
  }

  public resetForNewDay() {
    this.drawingPadSpine.resetForNewDay();
    // FIXME: ОТКЛЮЧИТЬ РАБОТУ ПЛАНШЕТА! ОН СТАНОВИТСЯ НЕ АКТИВНЫМ!
  }

  public async newDrawingPadUpAnimation(): Promise<void> {
    await this.drawingPadSpine.newFolderUp();
  }

  public async closeDrawingPad(): Promise<void> {
    await this.drawingPadSpine.close();
  }

  public async readyToDraw() {
    console.log('Drawing is ready to be drawn on');
    // FIXME: ВКЛЮЧАЕМ ВОЗМОЖНОСТЬ РИСОВАТЬ!
    // ПРИВЯЗЫВАЕМ КАМЕРУ К ПЛАНШЕТУ!!!!
  }

  public deactivateDrawing(): void {
    // FIXME: ОТКЛЮЧАЕМ ВОЗМОЖНОСТЬ РИСОВАТЬ!
    // камера от планшета пока не отвязывается (если это возможно)
  }

  public disableCameraLock(): void {
    // FIXME: ОТВЯЗЫВАЕМ КАМЕРУ ОТ ПЛАНШЕТА
    // если сложно, то отключаем привязку в deactivateDrawing, а тут просто кидаем консоль лог.
  }

  public enableStamp(): void {
    this.stampSpine.readyToApply();
    this.stampSpine.buttonOn();
  }

  public async toPutStamp(): Promise<void> {
    await this.stampSpine.stamp(() => {
      // FIXME: РЕАЛИЗОВАТЬ
      console.log('Добавить спрайт штампа на доску!!!');
    });
  }

  public activate(): void {
    this.board.activate();
  }

  public reset(): void {
    this.board.reset();
  }

  public async pause(): Promise<void> {
    return this.board.pause();
  }

  public async resume(): Promise<void> {
    return this.board.resume();
  }

  public beginNewSheet(skins: PartIds): void {
    this.board.beginNewSheet(skins);
  }

  public getHolstCenterVirtual(): { x: number; y: number } {
    return this.board.getHolstCenterVirtual();
  }

  // Этот метод дожидается, пока игрок не провзаимодействует с рисованием.
  // Вызывается из стейтмашины.
  public waitForUserFirstInteractWithDrawing(): Promise<void> {
    if (!this.cameraButtonPressPromise) {
      this.cameraButtonPressPromise = new Promise<void>((resolve) => {
        this.resolveCameraButtonPress = resolve;
      });
    }

    return this.cameraButtonPressPromise;
  }

  // FIXME: Временная заглушка для будущего вызова функции взаимодействия.
  public onDrawingFirstInteraction(): void {
    if (!this.resolveCameraButtonPress) return;

    this.resolveCameraButtonPress();
    this.resolveCameraButtonPress = null;
    this.cameraButtonPressPromise = null;
  }

  // Этот метод дожидается, пока игрок не нажмёт на кнопку подтверждения рисования.
  // Вызывается из стейтмашины.
  public waitForStampButtonPress(): Promise<void> {
    if (!this.stampButtonPressPromise) {
      this.stampButtonPressPromise = new Promise<void>((resolve) => {
        this.resolveStampButtonPress = resolve;
      });
    }
    return this.stampButtonPressPromise;
  }

  // FIXME: Временная заглушка для будущего вызова функции взаимодействия.
  public onStampButtonPressed(): void {
    if (!this.resolveStampButtonPress) return;

    this.resolveStampButtonPress();
    this.resolveStampButtonPress = null;
    this.stampButtonPressPromise = null;
  }

  public set onSubmitted(cb: (data: string, skins: PartIds) => void) {
    this.board.onSubmitted = cb;
  }

  public hideUiDockInstant(): void {
    this.board.hideUiDockInstant();
  }

  public setBoardNudge(offsetX: number, offsetY: number, scale = 1): void {
    this.board.setSpineSlotBoardNudge(offsetX, offsetY, scale);
  }
}
