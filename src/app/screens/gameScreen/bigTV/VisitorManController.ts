// src/app/screens/game/controllers/DudeController.ts

import { SpineObjectController } from '@/app/objects/SpineObjectController';
import type { ValuesOf } from '@/app/utils/typesHelper';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';

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

export class VisitorManController extends SpineObjectController {
  private isShowing = false;

  /**
   * Создает контроллер для персонажа visitor
   */
  constructor() {
    super(SPINE_SETTINGS);

    this.state.data.defaultMix = 0.2;

    // Устанавливаем начальную анимацию
    this.state.setEmptyAnimation(0);
    this.spine.scale.set(1);

    this.isShowing = false;
  }

  public showCharacter(): void {
    this.isShowing = true;

    // FIXME: нужно принимать скин, чтобы сконфигурировать персонажа.
    this.spine.skeleton.setSkinByName('body/body_1');
    this.spine.skeleton.setSlotsToSetupPose();

    this.play(VisitorManAnimation.LONG_1, true, 0);
  }

  public async playHideCharacterAnimation(): Promise<void> {
    return this.play(VisitorManAnimation.OUT, false, 0);
  }

  public hideCharacterInstance() {
    this.isShowing = false;
    this.state.setEmptyAnimation(0);
  }

  public override update(_dt: number): void {
    if (!this.isShowing) return;

    super.update(_dt);
  }

  /**
   * Обрабатывает завершение анимации персонажа
   */
  protected override onAnimationComplete(animName: VisitorManAnimation, _entry: TrackEntry): void {
    // После анимации прогона переходим к out_idle
    if (animName === VisitorManAnimation.OUT) {
      this.state.setEmptyAnimation(0);
      this.isShowing = false;
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
