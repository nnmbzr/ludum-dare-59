// screens/game/HintPanel.ts

import { Container, Text } from 'pixi.js';
import { HINTS_TEXTS } from './Texts';
import { type GameState } from './types';

/**
 * Плашка с текущей подсказкой. Тупая — ей говорят, что показать, она показывает. Только перенести тексты отсюда в конст
 */
export class HintPanel extends Container {
  private hintText: Text;
  private pointsLabel: Text;
  private pointsValue: Text;

  private pointsContainer: Container;

  constructor() {
    super();

    this.hintText = new Text({
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
    this.hintText.anchor.set(0.5, 0.35);

    this.pointsLabel = new Text({
      text: 'POINTS:',
      style: { fill: 0xcc9b56, fontSize: 54, fontFamily: 'VT323-Regular', align: 'right' },
    });
    this.pointsLabel.anchor.set(1, 0);

    this.pointsValue = new Text({
      text: '0',
      style: { fill: 0xcc9b56, fontSize: 46, fontFamily: 'DigitalNumbers-Regular' },
    });
    this.pointsValue.anchor.set(0, 0);

    const pointsY = this.hintText.y + 110;
    this.pointsLabel.y = pointsY;
    this.pointsLabel.x = 0;
    this.pointsValue.y = pointsY + (this.pointsLabel.height - this.pointsValue.height) / 2;
    this.pointsValue.x = 10;

    this.pointsContainer = new Container();
    this.pointsContainer.addChild(this.pointsLabel, this.pointsValue);
    this.pointsContainer.x = 0;
    this.pointsContainer.y = 0;

    this.label = 'hint_panel';
  }

  public getHintContainer(): Container {
    return this.hintText;
  }

  public getPointsContainer(): Container {
    return this.pointsContainer;
  }

  public setHintForState(state: GameState): void {
    const hint = HINTS_TEXTS[state];

    console.log('Setting hint for state', state, ':', hint);

    this.hintText.text = hint;
  }

  public setPoints(points: number): void {
    this.pointsValue.text = String(points);
  }
}
