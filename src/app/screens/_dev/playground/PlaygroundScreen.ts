import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import type { AppScreen } from '@/engine/navigation/navigation';
import { MAX_DT, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/main';
import gsap from 'gsap';
import { Container, type FederatedPointerEvent, type Ticker } from 'pixi.js';
import { BoyController } from './BoyController';

/** The screen that holds the app */
export class PlaygroundScreen extends Container implements AppScreen {
  /** Assets bundles required by this screen */
  public static assetBundles = ['main'];
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerDown = this.onPointerDown.bind(this);

  public mainContainer: Container;
  private paused = false;

  /// /////////// Objects
  private boy: BoyController;

  constructor() {
    super();

    this.mainContainer = new Container();

    this.boy = new BoyController();
    this.boy.position.set(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    this.mainContainer.addChild(this.boy);

    this.addChild(this.mainContainer);
  }

  /** Prepare the screen just before showing */
  public prepare() {
    this.mainContainer.alpha = 0;

    this.setupEventHandlers();
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    await gsap.to(this.mainContainer, { alpha: 1, duration: 0.5 });
  }

  /** Hide screen with animations */
  public async hide() {
    await gsap.to(this.mainContainer, { alpha: 0, scale: 5, duration: 0.5 });
  }

  /** Update the screen */
  public update(time: Ticker) {
    if (this.paused) return;

    const dt = Math.min(time.deltaMS, MAX_DT);

    this.boy.update(dt);
  }

  /** Resize the screen, fired whenever window size changes */
  public resize(_width: number, _height: number) {}

  private onPointerDown(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);

    this.boy.clickTest(x, y);
  }

  private onPointerMove(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);

    this.boy.hoverTest(x, y);
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
