import { type AnimationState, Spine, type TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';
import { engine } from '../getEngine';

export type SpineSettings = {
  skeleton: string;
  atlas: string;
};

export class SpineObjectController extends Container {
  protected spine: Spine;
  protected state: AnimationState;
  protected animationCompletePromises: Map<string, { resolve: () => void }>;

  /**
   * Создает контроллер для Spine-объекта
   * @param settings Настройки Spine-объекта (skeleton и atlas)
   */
  constructor(settings: SpineSettings) {
    super();

    const { skeleton, atlas } = settings;

    this.spine = Spine.from({ skeleton, atlas, autoUpdate: false });
    this.state = this.spine.state;
    this.animationCompletePromises = new Map();

    // Настраиваем слушатель завершения анимаций
    this.setupAnimationListener();

    this.addChild(this.spine);
  }

  /**
   * Настраивает слушатель для отслеживания завершения анимаций
   */
  protected setupAnimationListener(): void {
    this.state.addListener({
      complete: (entry: TrackEntry) => {
        if (!entry.animation) return;

        const animName = entry.animation.name;
        const promise = this.animationCompletePromises.get(animName);

        if (promise) {
          promise.resolve();
          this.animationCompletePromises.delete(animName);
        }

        // Переопределяется в потомках для обработки конкретных переходов анимации
        this.onAnimationComplete(animName, entry);
      },
    });
  }

  /**
   * Метод, который переопределяется в потомках для обработки завершения анимаций
   * @param animName Имя завершившейся анимации
   * @param entry Объект трека анимации
   */

  protected onAnimationComplete(_animName: string, _entry: TrackEntry): void {
    // Переопределяется в потомках
  }

  /**
   * Воспроизводит анимацию и, по желанию, ожидает ее завершения
   * @param animName Имя анимации для воспроизведения
   * @param loop Должна ли анимация зацикливаться
   * @param trackIndex Индекс трека для анимации
   * @returns Promise, который разрешается по завершении анимации (если не зацикленная)
   */
  public play(animName: string, loop: boolean = false, trackIndex: number = 0): Promise<void> {
    return new Promise((resolve) => {
      // Если анимация зацикленная, сразу разрешаем Promise
      if (loop) {
        this.state.setAnimation(trackIndex, animName, true);
        resolve();
        return;
      }

      this.state.setAnimation(trackIndex, animName, false);

      // Сохраняем коллбэк разрешения Promise для вызова после завершения анимации
      this.animationCompletePromises.set(animName, { resolve });
    });
  }

  protected getSpine(): Spine {
    return this.spine;
  }

  protected hitTest(x: number, y: number): boolean {
    const localPoint = this.spine.toLocal({ x, y }, engine().virtualScreen.gameContainer);
    const bounds = this.spine.getLocalBounds();

    return bounds.containsPoint(localPoint.x, localPoint.y);
  }

  public currentAnimation(trackIndex: number = 0): string | null {
    const entry = this.state.getCurrent(trackIndex);
    return entry && entry.animation ? entry.animation.name : null;
  }

  public update(dt: number): void {
    this.spine.update(dt);
  }
}
