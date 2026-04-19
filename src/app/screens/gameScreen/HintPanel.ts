// screens/game/HintPanel.ts

import { Container, type Text } from 'pixi.js';
import { HINTS_TEXTS } from './Texts';
import { type GameState } from './types';

/**
 * Плашка с текущей подсказкой. Тупая — ей говорят, что показать, она показывает. Только перенести тексты отсюда в конст
 */
export class HintPanel extends Container {
  private text!: Text;

  constructor() {
    super();
    // TODO: создать фон плашки и Text-объект
  }

  public setHintForState(state: GameState): void {
    const hint = HINTS_TEXTS[state];

    console.log('Setting hint for state', state, ':', hint);

    // TODO: возможно нужно будет как-то по-особому работать с текстом для разных стейтов.
    /* switch (state) {
      case 'waitingForVisitor':
        break;
      case 'alarmOn':
        break;
    } */

    // TODO: this.text.text = hint + gsap fade-in
  }
}
