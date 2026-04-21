// src/app/screens/game/controllers/DudeController.ts

import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import { Skin, type TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Sprite, Texture } from 'pixi.js';
import type { VisitorData } from '../types';

/**
 * Перечисление анимаций персонажа visitor
 */
export const VisitorManAnimation = {
  LONG_1: 'long_1',
  LONG_2: 'long_2',
  LONG_3: 'long_3',
  OUT: 'out',
  SUSPECT: 'suspect',
  SUSPECT_ALIVE: 'suspect_alive',
  SUSPECT_DEAD_FALL: 'suspect_dead_fall',
  SUSPECT_DEAD_WIN: 'suspect_dead_win',
} as const;
export type VisitorManAnimation = ValuesOf<typeof VisitorManAnimation>;

const SPINE_SETTINGS = {
  skeleton: 'mans.json',
  atlas: 'character_man.atlas',
};

export const VisitorSlots = {
  BACKGROUND: 'backgroundContainer',
} as const;
type VisitorSlots = ValuesOf<typeof VisitorSlots>;

export class VisitorManController extends SpineObjectController {
  private isShowing = false;
  private visitorBackground: Sprite;

  /**
   * Создает контроллер для персонажа visitor
   */
  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;

    // BG_1, BG_2, BG_suspect
    this.visitorBackground = Sprite.from('BG_1');
    this.visitorBackground.anchor.set(0.5);

    // Устанавливаем начальную анимацию
    this.state.setEmptyAnimation(0);
    this.spine.scale.set(1);

    this.isShowing = false;
  }

  public showCharacter(suspect: boolean, visitorData: VisitorData): void {
    this.isShowing = true;

    this.visitorBackground.texture = Texture.from(suspect ? 'BG_suspect' : Math.random() > 0.5 ? 'BG_1' : 'BG_2');

    this.spine.addSlotObject(VisitorSlots.BACKGROUND, this.visitorBackground);

    const combinedSkin = new Skin('combined-skin');

    const skeletonData = this.spine.skeleton.data;
    const { skins } = visitorData;

    const skinNames: string[] = [
      `head/head_${skins.head}`,
      `body/body_${skins.body}`,
      `nose/nose_${skins.nose}`,
      `ears/ears_${skins.ear}`,
      `mouth/mouth_${skins.mouth}`,
      `brow/brow_${skins.brow}`,
      `eyes/eye_${skins.eye}`,
    ];

    if (skins.hat !== undefined) skinNames.push(`hat/hat_${skins.hat}`);
    if (skins.accessories !== undefined) skinNames.push(`accessories/accessories_${skins.accessories}`);
    if (skins.hair !== undefined) skinNames.push(`hair/hair_${skins.hair}`);
    if (skins.beard !== undefined) skinNames.push(`beard/beard_${skins.beard}`);
    if (skins.scar !== undefined) skinNames.push(`scars/scars_${skins.scar}`);

    for (const skinName of skinNames) {
      const skin = skeletonData.findSkin(skinName);
      if (skin) {
        combinedSkin.addSkin(skin);
      }
    }

    // 3. Устанавливаем комбинированный скин скелету
    this.spine.skeleton.setSkin(combinedSkin);

    this.spine.skeleton.setSlotsToSetupPose();

    if (suspect) {
      this.play(VisitorManAnimation.SUSPECT, true, 0);
    } else {
      this.play(visitorData.idleAnimation, true, 0);
    }
  }

  public async playHideCharacterAnimation(): Promise<void> {
    return this.play(VisitorManAnimation.OUT, false, 0);
  }

  public hideCharacterInstance() {
    this.characterHide();
  }

  public override update(_dt: number): void {
    if (!this.isShowing) return;

    super.update(_dt);
  }

  public async showSuspectResultAnimation(isWin: boolean, isAlive: boolean): Promise<void> {
    if (isWin && isAlive) {
      return this.play(VisitorManAnimation.SUSPECT_ALIVE, false, 0);
    } else if (isWin && !isAlive) {
      return this.play(VisitorManAnimation.SUSPECT_DEAD_WIN, false, 0);
    } else if (!isWin && !isAlive) {
      return this.play(VisitorManAnimation.SUSPECT_DEAD_FALL, false, 0);
    }
  }

  private characterHide() {
    this.isShowing = false;
    this.state.setEmptyAnimation(0);
    this.spine.skeleton.setSkin(null);
  }

  /**
   * Обрабатывает завершение анимации персонажа
   */
  protected override onAnimationComplete(animName: VisitorManAnimation, _entry: TrackEntry): void {
    // После анимации прогона переходим к out_idle
    if (animName === VisitorManAnimation.OUT) {
      this.characterHide();
    }
  }
}
