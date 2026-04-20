import { BlurFilter, Container, Sprite, Texture } from 'pixi.js';

import { FancyButton } from '@pixi/ui';
import gsap from 'gsap';
import { engine } from '../getEngine';
import { Label } from '../ui/Label';

const FONT_SETTINGS = {
  SemiBold: 'ProtestRiot-Regular',
  Medium: 'ProtestRiot-Regular',
  Regular: 'ProtestRiot-Regular',
};

/** Popup that shows up when gameplay is paused */
export class TeamPopup extends Container {
  /** The dark semi-transparent background covering current screen */
  private bg: Sprite;
  /** Container for the popup UI components */
  private names: Container;
  /** Button that closes the popup */
  private backButton: FancyButton;

  constructor() {
    super();

    this.bg = new Sprite(Texture.WHITE);
    this.bg.tint = 0x0;
    this.bg.interactive = true;
    this.addChild(this.bg);

    this.names = new Container();
    this.addChild(this.names);

    const buttonAnimations = {
      hover: {
        props: {
          scale: { x: 1.1, y: 1.1 },
        },
        duration: 100,
      },
      pressed: {
        props: {
          scale: { x: 0.9, y: 0.9 },
        },
        duration: 100,
      },
    };

    this.backButton = new FancyButton({
      defaultView: 'back_Default',
      hoverView: 'back_Hover',
      pressedView: 'back_Pressed',
      anchor: 0.5,
      animations: buttonAnimations,
    });
    this.backButton.position.set(110, 1020);
    // TODO: вызывать попап с описанием команды
    this.backButton.onPress.connect(() => engine().navigation.dismissPopup());
    this.names.addChild(this.backButton);

    this.createTeam();
  }

  private createTeam() {
    const titleStyle = { fill: 0xffffff, fontSize: 54, fontFamily: FONT_SETTINGS.SemiBold };

    const title = new Label({
      text: 'TEAM',
      style: titleStyle,
    });
    title.position.set(960, 110);
    title.anchor.set(0.5);
    this.names.addChild(title);
    const developY = this.createDepartment('PROGRAMMING', ['NNMBZR'], 230);
    const artY = this.createDepartment('ART', ['Rambyr', 'Vaksana', 'an_olena'], developY);
    const animY = this.createDepartment('ANIMATION', ['a3leksey'], artY);
    const audioY = this.createDepartment('MUSIC', ['Guo Shang'], animY);
    this.createDepartment('SUPPORT', ['AlexVaxF'], audioY);
  }

  private createDepartment(department: string, members: string[], startY: number): number {
    const departmentStyle = { fill: 0x2ac3ff, fontSize: 36, fontFamily: FONT_SETTINGS.Medium };
    const nameStyle = { fill: 0xffffff, fontSize: 32, fontFamily: FONT_SETTINGS.Regular };

    const departmentLabel = new Label({
      text: department,
      style: departmentStyle,
    });
    departmentLabel.position.set(960, startY);
    this.names.addChild(departmentLabel);

    const departmentSize = 55;
    const membersOffset = 50;
    const departmentOffset = 35;

    for (let i = 0; i < members.length; i++) {
      const nameLabel = new Label({
        text: members[i],
        style: nameStyle,
      });
      nameLabel.position.set(960, startY + departmentSize + i * membersOffset);
      this.names.addChild(nameLabel);
    }

    return startY + departmentSize + members.length * membersOffset + departmentOffset;
  }

  /** Resize the popup, fired whenever window size changes */
  public resize(width: number, height: number) {
    this.bg.width = width;
    this.bg.height = height;
  }

  /** Present the popup, animated */
  public async show() {
    const currentEngine = engine();
    if (currentEngine.navigation.currentScreen) {
      currentEngine.navigation.currentScreen.filters = [new BlurFilter({ strength: 15 })];
    }
    this.bg.alpha = 0;
    gsap.to(this.bg, { alpha: 0.8, duration: 0.2, ease: 'none' });
    await gsap.to(this.names, { alpha: 1, duration: 0.2, ease: 'none' });
  }

  /** Dismiss the popup, animated */
  public async hide() {
    const currentEngine = engine();
    if (currentEngine.navigation.currentScreen) {
      currentEngine.navigation.currentScreen.filters = [];
    }
    this.bg.alpha = 0;
    this.names.alpha = 0;
    gsap.to(this.bg, { alpha: 0, duration: 0.2, ease: 'none' });
    await gsap.to(this.names, {
      alpha: 0,
      duration: 0.2,
      ease: 'none',
    });
  }

  public reset() {
    this.destroy({ children: true });
  }
}
