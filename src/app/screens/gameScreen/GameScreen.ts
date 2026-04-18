import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import type { AppScreen } from '@/engine/navigation/navigation';
import { loadTiledTileLayers } from '@/engine/tiledMap';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, type Ticker } from 'pixi.js';

/** The screen that holds the app */
export class GameScreen extends Container implements AppScreen {
  public static assetBundles = ['main', 'dev'];
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerDown = this.onPointerDown.bind(this);

  public mainContainer: Container;
  private paused = false;
  private tiledRoot?: Container;

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);
  }

  /** Prepare the screen just before showing */
  public prepare() {
    this.mainContainer.alpha = 0;

    this.setupEventHandlers();
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    if (!this.tiledRoot) {
      this.tiledRoot = await loadTiledTileLayers('demo-map', { 'tiles.png': 'dev/maps/tiles' });
      this.mainContainer.addChildAt(this.tiledRoot, 0);
    }
    await gsap.to(this.mainContainer, { alpha: 1, duration: 0.5 });
  }

  /** Hide screen with animations */
  public async hide() {
    await gsap.to(this.mainContainer, { alpha: 0, scale: 5, duration: 0.5 });
  }

  /** Update the screen */
  public update(_time: Ticker) {
    if (this.paused) return;

    // const dt = Math.min(time.deltaMS, MAX_DT);
  }

  /** Resize the screen, fired whenever window size changes */
  public resize(_width: number, _height: number) {}

  private onPointerDown(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);

    console.log(`Pointer down at (${x}, ${y})`);
  }

  private onPointerMove(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);

    console.log(`Pointer move at (${x}, ${y})`);
  }

  private setupEventHandlers() {
    this.on('pointermove', this.boundOnPointerMove);
    this.on('pointerdown', this.boundOnPointerDown);
    this.eventMode = 'static';
  }

  private cleanupEventHandlers() {
    this.off('pointermove', this.boundOnPointerMove);
    this.off('pointerdown', this.boundOnPointerDown);
  }

  /** Fully reset */
  public reset() {
    this.cleanupEventHandlers();
    this.tiledRoot?.destroy({ children: true });
    this.tiledRoot = undefined;
  }

  /** Pause gameplay - automatically fired when a popup is presented */
  public async pause() {
    this.mainContainer.interactiveChildren = false;
    this.paused = true;
  }

  /** Resume gameplay */
  public async resume() {
    this.mainContainer.interactiveChildren = true;
    this.paused = false;
  }

  /** Auto pause the app when window go out of focus */
  public blur() {
    if (!engine().navigation.currentPopup) {
      engine().navigation.presentPopup(PausePopup);
    }
  }
}
