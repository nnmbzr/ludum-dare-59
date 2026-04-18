import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import type { AppScreen } from '@/engine/navigation/navigation';
import { Container, type Ticker } from 'pixi.js';

/** The screen that holds the app */
export class TemplateScreen extends Container implements AppScreen {
  /** Assets bundles required by this screen */
  public static assetBundles = ['main'];

  public mainContainer: Container;
  private paused = false;

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);
  }

  /** Prepare the screen just before showing */
  public prepare() {}

  /** Show screen with animations */
  public async show(): Promise<void> {}

  /** Hide screen with animations */
  public async hide() {}

  /** Update the screen */
  public update(_time: Ticker) {
    if (this.paused) return;

    // const dt = Math.min(time.deltaMS, MAX_DT);
  }

  /** Resize the screen, fired whenever window size changes */
  public resize(_width: number, _height: number) {}

  /** Fully reset */
  public reset() {}

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
