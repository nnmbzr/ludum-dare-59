import { Container, type Sprite } from 'pixi.js';
import { type Balance } from './Balance';
import { type GuessTarget, type SkinSet } from './types';

/**
 * Факс + три верхних монитора.
 * Пришёл фоторобот → показываем на факсе, на мониторах генерим 3 варианта
 * (один правильный + два подмешанных по guessSpread).
 *
 * Возвращает результат угадывания наружу.
 */
export class Guessing extends Container {
  // TODO: не забыть при внедрении отказаться от чёртовых "!" Нужно будет явно их определить.
  private faxButton!: Sprite;
  private faxSheet!: Sprite; // куда выезжает чужой фоторобот
  private monitors: [Sprite, Sprite, Sprite] = [null!, null!, null!];
  private correctMonitorIndex = -1;
  private currentTarget: GuessTarget | null = null;
  private faxEnabled = false;
  private monitorsEnabled = false;

  private balance: Balance;

  public onFaxRequested: () => void = () => {};
  public onGuessMade: (correct: boolean, targetAuthor: string) => void = () => {};

  constructor(balance: Balance) {
    super();

    this.balance = balance;

    // TODO:
    // - создать faxButton (Sprite, interactive), привязать к handleFaxClick
    // - создать faxSheet (Sprite, скрыт)
    // - создать 3 монитора с interactive Sprite'ами, привязать к handleMonitorClick(0..2)
  }

  public enableFax(): void {
    this.faxEnabled = true;
    // TODO: визуальная подсветка факса (мигание кнопки)
  }

  private handleFaxClick(): void {
    if (!this.faxEnabled) return;
    this.faxEnabled = false;
    this.onFaxRequested(); // GameScreen сделает запрос на сервер
  }

  /**
   * GameScreen получил GuessTarget и передаёт нам.
   * Показываем картинку на факсе и рендерим варианты на мониторах.
   */
  public async presentTarget(target: GuessTarget): Promise<void> {
    this.currentTarget = target;
    // TODO: загрузить base64 в текстуру и положить на faxSheet
    // TODO: анимация выезда листа из факса

    const options = this.generateOptions(target.originalSkins);
    this.correctMonitorIndex = options.findIndex((o) => o.isCorrect);
    // TODO: для каждого монитора собрать спайн с нужным skinset и зарендерить в RenderTexture

    this.monitorsEnabled = true;
    // TODO: подсветить мониторы
  }

  private generateOptions(_correct: SkinSet): Array<{ skins: SkinSet; isCorrect: boolean }> {
    // TODO:
    // 1. Взять correct как первый вариант
    // 2. Два других — скопировать correct и "сбить":
    //    для каждого patternId с вероятностью (1 - getGuessSpread()) заменить на случайный скин
    //    (чем больше spread, тем больше расхождения → легче угадывать)
    // 3. Перемешать массив
    // 4. Вернуть три варианта с флагом, какой правильный
    throw new Error('Not implemented');
  }

  private handleMonitorClick(index: number): void {
    if (!this.monitorsEnabled || !this.currentTarget) return;
    this.monitorsEnabled = false;

    const correct = index === this.correctMonitorIndex;
    this.onGuessMade(correct, this.currentTarget.authorNickname);

    // TODO: анимация ответа на выбранном мониторе, убрать лист из факса
  }

  /** Вызывается после того, как GameScreen обработал результат */
  public async dismiss(): Promise<void> {
    // TODO: анимация ухода всего обратно в "покой", сброс currentTarget
    this.currentTarget = null;
    this.correctMonitorIndex = -1;
  }
}
