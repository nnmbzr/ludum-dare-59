// src/app/screens/game/controllers/DudeController.ts

import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import { Skin, type TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Sprite, Texture } from 'pixi.js';

/**
 * Перечисление анимаций персонажа visitor
 */
export const VisitorManAnimation = {
  LONG_1: 'long_1',
  LONG_2: 'long_2',
  LONG_3: 'long_3',
  OUT: 'out',
  SUSPECT: 'suspect',
} as const;
type VisitorManAnimation = ValuesOf<typeof VisitorManAnimation>;

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

  public showCharacter(suspect: boolean): void {
    this.isShowing = true;

    this.visitorBackground.texture = Texture.from(suspect ? 'BG_suspect' : Math.random() > 0.5 ? 'BG_1' : 'BG_2');

    this.spine.addSlotObject(VisitorSlots.BACKGROUND, this.visitorBackground);

    const combinedSkin = new Skin('combined-skin');

    // 2. Добавляем в него нужные скины из данных скелета по именам
    const skeletonData = this.spine.skeleton.data;

    const skinNames = [
      'head/head_1',
      'body/body_1',
      'nose/nose_1',
      'ears/ears_1',
      'mouth/mouth_1',
      'brow/brow_1',
      'eyes/eye_1',
    ];

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
      this.play(VisitorManAnimation.LONG_1, true, 0);
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

  /* private getIdleAnimation(): VisitorManAnimation {
    if (this.haveGuitar) {
      return this.fireLit ? VisitorManAnimation.IDLE_GUITAR_FIRE : VisitorManAnimation.IDLE_GUITAR;
    }
    return this.fireLit ? VisitorManAnimation.IDLE_FIRE : VisitorManAnimation.IDLE;
  } */

  /**
   * Обновляет idle-анимацию в зависимости от текущего состояния
   * @param trackIndex Индекс трека анимации
   */
  /* private updateIdleAnimation(trackIndex: number = 0): void {
    // Выбираем анимацию на основе состояния костра
    const animation = this.getIdleAnimation();

    // Устанавливаем соответствующую idle-анимацию
    this.state.setAnimation(trackIndex, animation, true);
  } */

  /**
   * Устанавливает состояние костра и обновляет анимацию,
   * @param isLit Горит ли костер
   */
  /* public setFireState(isLit: boolean): void {
    // Если состояние не изменилось, ничего не делаем
    if (this.fireLit === isLit || this.guitarProcessed()) {
      return;
    }

    this.fireLit = isLit;
    this.updateIdleAnimation();
  }

  public toggleGuitar(): void {
    if (this.guitarProcessed()) {
      return;
    }

    this.haveGuitar = !this.haveGuitar;

    if (this.haveGuitar) {
      this.play(VisitorManAnimation.GUITAR_ON, false, 0);
    } else {
      this.updateIdleAnimation(0);
    }
  }

  private guitarProcessed(): boolean {
    if (this.currentAnimation() === VisitorManAnimation.GUITAR_ON) {
      return true;
    }
    return false;
  }

  public clickTest(x: number, y: number) {
    const hit = this.hitTest(x, y);

    if (hit) {
      this.toggleGuitar();
    }
  }

  public hoverTest(x: number, y: number) {
    const hovering = this.hitTest(x, y);

    this.setFireState(hovering);
  } */
}
