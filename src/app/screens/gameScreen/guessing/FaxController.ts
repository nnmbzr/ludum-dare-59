import { SpineObjectController } from '@/app/objects/SpineObjectController';
import { SpriteButton } from '@/app/ui/SpriteButton';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Sprite, Text, type Container } from 'pixi.js';

export const FaxAnimation = {
  IDLE_EMPTY: 'idle_empty',
  IDLE_PAPER: 'idle_paper',
  NUMBERS: 'numbers',
  RECEIVE: 'receive',
  SEND: 'send',
} as const;
type FaxAnimation = ValuesOf<typeof FaxAnimation>;

export const FaxSlots = {
  BUTTON: 'Container_Button',
  PAPER: 'Container_Paper',
  NAME: 'Container_Paper_Name',
} as const;
type FaxSlots = ValuesOf<typeof FaxSlots>;

const SPINE_SETTINGS = {
  skeleton: 'Fax.json',
  atlas: 'background.atlas',
};

export class FaxController extends SpineObjectController {
  private button: SpriteButton;
  private nameText: Text;

  constructor(onFaxButtonPressed: () => void) {
    super(SPINE_SETTINGS);

    // this.state.data.defaultMix = 0.2;
    this.play(FaxAnimation.IDLE_EMPTY, true, 0);

    this.button = new SpriteButton(Sprite.from('fax_button_off'), Sprite.from('fax_button_on'), onFaxButtonPressed);
    this.button.enabled = false;
    this.spine.addSlotObject(FaxSlots.BUTTON, this.button);

    this.nameText = new Text({
      text: '',
      style: {
        fill: 0xcc9b56,
        fontSize: 54,
        fontFamily: 'VT323-Regular',
        wordWrap: true,
        wordWrapWidth: 500,
        align: 'center',
      },
    });
    this.nameText.anchor.set(0.55, 0.21);
    this.nameText.label = 'FAX USERNAME';
    this.spine.addSlotObject(FaxSlots.NAME, this.nameText);
  }

  public buttonOn(): void {
    this.button.buttonOn();
    this.play(FaxAnimation.NUMBERS, true, 0);
  }

  public setName(name: string): void {
    this.nameText.text = name.length > 21 ? name.slice(0, 19) + '...' : name;
  }

  public waitServerResponse(): void {
    // УДАЛИЛ КНОПКУ. ПОТОМ БУДЕТ КАКАЯ-ТО АНИМАЦИЯ ОЖИДАНИЯ.
    this.play(FaxAnimation.IDLE_EMPTY, true, 0);
  }

  public async acceptsServerResponse(content: Container): Promise<void> {
    this.addToSlot(FaxSlots.PAPER, content);
    await this.play(FaxAnimation.RECEIVE, false, 0);
    this.play(FaxAnimation.IDLE_PAPER, true, 0);
  }

  public async guessRecived(content: Container): Promise<void> {
    await this.play(FaxAnimation.SEND, false, 0);
    this.play(FaxAnimation.IDLE_EMPTY, true, 0);
    this.setName('');
    this.removeFromSlot(content);
  }

  public addToSlot(slot: FaxSlots, object: Container): void {
    this.spine.addSlotObject(slot, object);
  }

  public removeFromSlot(object: Container): void {
    this.spine.removeSlotObject(object);
  }

  protected override onAnimationComplete(_animName: FaxAnimation, _entry: TrackEntry): void {}
}
