import type { AppScreen } from '@/engine/navigation/navigation';
import gsap from 'gsap';
import { Container, type Ticker } from 'pixi.js';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/main';
import { GameDrawingBoard } from '@/app/screens/gameScreen/GameDrawingBoard';

export class DrawingScreen extends Container implements AppScreen {
  public static assetBundles = ['main'];

  private readonly board = new GameDrawingBoard();

  constructor() {
    super();
    this.addChild(this.board);
  }

  public prepare(): void {
    this.board.layoutFullscreenCenter(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.board.activate();
    this.alpha = 0;
  }

  public async show(): Promise<void> {
    await gsap.to(this, { alpha: 1, duration: 0.35 });
  }

  public async hide(): Promise<void> {
    this.board.hideUiDockInstant();
    await gsap.to(this, { alpha: 0, scale: 1.02, duration: 0.35 });
    this.scale.set(1);
  }

  public update(time: Ticker): void {
    this.board.tick(time);
  }

  public resize(width: number, height: number): void {
    this.board.layoutFullscreenCenter(width, height);
  }

  public reset(): void {
    this.board.reset();
  }

  public async pause(): Promise<void> {
    await this.board.pause();
  }

  public async resume(): Promise<void> {
    await this.board.resume();
  }
}
