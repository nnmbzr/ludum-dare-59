import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import { GameScreen } from '@/app/screens/gameScreen/GameScreen';
import type { AppScreen } from '@/engine/navigation/navigation';
import { ButtonContainer, CircularProgressBar, Input } from '@pixi/ui';
import gsap from 'gsap';
import { Container, Graphics, Text, type Ticker } from 'pixi.js';

/** Main menu screen: enter name and register, then proceed to game */
export class MainMenuScreen extends Container implements AppScreen {
  public static assetBundles = ['main'];

  public mainContainer: Container;
  private paused = false;

  private nameLabel: Text;
  private input: Input;
  private startButton: ButtonContainer;
  private spinner: CircularProgressBar;

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);

    this.nameLabel = new Text({
      text: 'NAME',
      style: { fill: 0xffffff, fontSize: 48, fontWeight: 'bold' },
    });
    this.nameLabel.anchor.set(0.5);
    this.mainContainer.addChild(this.nameLabel);

    const inputBg = new Graphics().roundRect(0, 0, 500, 80, 12).fill({ color: 0x444444 });
    this.input = new Input({
      bg: inputBg,
      placeholder: 'Enter your name...',
      maxLength: 16,
      align: 'center',
      textStyle: { fill: 0xffffff, fontSize: 36 },
      padding: { top: 16, right: 20, bottom: 16, left: 20 },
      addMask: true,
    });
    this.mainContainer.addChild(this.input);

    this.input.onChange.connect(() => {
      this.startButton.visible = this.input.value.length > 0;
    });

    const btnBg = new Graphics().roundRect(0, 0, 300, 80, 12).fill({ color: 0xe72264 });
    const btnLabel = new Text({
      text: 'START',
      style: { fill: 0xffffff, fontSize: 36, fontWeight: 'bold' },
    });
    btnLabel.anchor.set(0.5);
    btnLabel.position.set(150, 40);
    btnBg.addChild(btnLabel);

    this.startButton = new ButtonContainer(btnBg);
    this.startButton.visible = false;
    this.mainContainer.addChild(this.startButton);
    this.startButton.onPress.connect(() => this.onStartPress());

    this.spinner = new CircularProgressBar({
      backgroundColor: '#3d3d3d',
      fillColor: '#e72264',
      radius: 60,
      lineWidth: 10,
      value: 30,
      backgroundAlpha: 0.5,
      fillAlpha: 1,
      cap: 'round',
    });
    this.spinner.visible = false;
    this.mainContainer.addChild(this.spinner);
  }

  private async onStartPress() {
    const name = this.input.value.trim();
    if (!name) return;

    this.nameLabel.visible = false;
    this.input.visible = false;
    this.startButton.visible = false;
    this.spinner.visible = true;

    await engine().server.register(name);
    await engine().navigation.showScreen(GameScreen);
  }

  public prepare() {}

  public async show(): Promise<void> {
    this.alpha = 0;
    await gsap.to(this, { alpha: 1, duration: 0.3 });
  }

  public async hide() {
    await gsap.to(this, { alpha: 0, duration: 0.3 });
  }

  public update(time: Ticker) {
    if (this.paused) return;
    if (this.spinner.visible) {
      this.spinner.rotation += time.deltaMS * 0.004;
    }
  }

  public resize(width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2;

    this.nameLabel.position.set(cx, cy - 80);
    this.input.position.set(cx - this.input.width / 2, cy - this.input.height / 2);
    this.startButton.position.set(cx - 150, cy + 80);

    const spinnerSize = this.spinner.width;
    this.spinner.position.set(cx - spinnerSize / 2, cy - spinnerSize / 2);
  }

  public reset() {
    this.nameLabel.visible = true;
    this.input.visible = true;
    this.input.value = '';
    this.startButton.visible = false;
    this.spinner.visible = false;
    this.spinner.rotation = 0;
    this.alpha = 1;
  }

  public async pause() {
    this.mainContainer.interactiveChildren = false;
    this.paused = true;
  }

  public async resume() {
    this.mainContainer.interactiveChildren = true;
    this.paused = false;
  }

  public blur() {
    if (!engine().navigation.currentPopup) {
      engine().navigation.presentPopup(PausePopup);
    }
  }
}
