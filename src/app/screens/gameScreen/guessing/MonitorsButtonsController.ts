import { SpineObjectController } from '@/app/objects/SpineObjectController';
import { SpriteButton } from '@/app/ui/SpriteButton';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Container, Sprite, Texture } from 'pixi.js';

const SPINE_SETTINGS = {
  skeleton: 'TV_Buttons.json',
  atlas: 'background.atlas',
};

const BUTTON_W = 690;
const BUTTON_H = 690;

const SLOTS = ['Container_button_TV_01', 'Container_button_TV_02', 'Container_button_TV_03'] as const;

const ON_ANIMS = ['button_TV_on', 'button_TV_on2', 'button_TV_on3'] as const;
const OFF_ANIMS = ['button_TV_off', 'button_TV_off2', 'button_TV_off3'] as const;
const GREEN_ANIMS = ['button_TV_green', 'button_TV_green2', 'button_TV_green3'] as const;

export class MonitorsButtonsController extends SpineObjectController {
  private buttons: SpriteButton[];

  constructor(onButton1Press: () => void, onButton2Press: () => void, onButton3Press: () => void) {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;
    this.spine.scale.set(1);

    const callbacks = [onButton1Press, onButton2Press, onButton3Press];

    const makeTransparent = () => {
      const s = new Sprite(Texture.WHITE);
      s.setSize(BUTTON_W, BUTTON_H);
      s.anchor.set(0.5);
      s.alpha = 0;
      return s;
    };

    this.buttons = callbacks.map((cb, i) => {
      const btn = new SpriteButton(makeTransparent(), makeTransparent(), cb);

      btn.x -= BUTTON_W / 2 - 70;
      btn.y -= BUTTON_H / 2 - 50;

      if (i === 2) {
        btn.x += BUTTON_W / 2 + 150;
      }

      btn.enabled = false;
      const btnContainer = new Container();
      btnContainer.addChild(btn);

      this.spine.addSlotObject(SLOTS[i], btnContainer);
      return btn;
    });

    this.buttonsOff();
  }

  public buttonsOff(): void {
    this.buttons.forEach((btn) => (btn.enabled = false));
    OFF_ANIMS.forEach((anim, i) => this.state.setAnimation(i, anim, false));
  }

  public buttonsOn(): void {
    this.buttons.forEach((btn) => btn.buttonOn());
    ON_ANIMS.forEach((anim, i) => this.state.setAnimation(i, anim, true));
  }

  public buttonPush(index: number): void {
    this.buttons.forEach((btn) => (btn.enabled = false));
    for (let i = 0; i < 3; i++) {
      const anim = i === index ? GREEN_ANIMS[i] : OFF_ANIMS[i];
      this.state.setAnimation(i, anim, i === index);
    }
  }

  public override update(_dt: number): void {
    super.update(_dt);
  }

  protected override onAnimationComplete(_animName: string, _entry: TrackEntry): void {}
}
