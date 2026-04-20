import { FancyButton } from '@pixi/ui';
import type { Sprite } from 'pixi.js';

/**
 * Кнопка без текста, поддерживающая установку спрайтов.
 * При клике отключается (enabled = false) и вызывает callback.
 * buttonOn() возвращает enabled = true.
 */
export class SpriteButton extends FancyButton {
  private readonly onClick: () => void;

  constructor(defaultView: Sprite | string, disabledView: Sprite | string, onClickCallback: () => void) {
    super({
      defaultView,
      disabledView,
      anchor: 0.5,
    });

    this.onClick = onClickCallback;
    this.onPress.connect(this.handlePress.bind(this));
  }

  public buttonOn(): void {
    this.enabled = true;
  }

  private handlePress(): void {
    this.enabled = false;
    this.onClick();
  }
}
