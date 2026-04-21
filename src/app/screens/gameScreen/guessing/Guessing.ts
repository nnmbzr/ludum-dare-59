import type { PartIds } from '@/shared/serverTypes';
import { Container, Sprite, Texture } from 'pixi.js';
import { type Balance } from '../Balance';
import { VisitorManAnimation, VisitorManController } from '../bigTV/VisitorManController';
import { type GuessTarget, type VisitorData } from '../types';
import { FaxController } from './FaxController';
import { MonitorsButtonsController } from './MonitorsButtonsController';
import { MonitorsController, MonitorSlots } from './MonitorsController';

/**
 * Факс + три верхних монитора.
 * Пришёл фоторобот → показываем на факсе, на мониторах генерим 3 варианта
 * (один правильный + два подмешанных по guessSpread).
 *
 * Возвращает результат угадывания наружу.
 */
export class Guessing extends Container {
  private correctMonitorIndex = -1;
  private currentTarget: GuessTarget | null = null;
  private monitorsEnabled = false;

  private balance: Balance;

  public onFaxRequested: () => void = () => {};

  // Ожидание нажатия на кнопку факса
  private faxButtonPressPromise: Promise<void> | null = null;
  private resolveFaxButtonPress: (() => void) | null = null;

  // Ожидание выбора подозреваемого
  private guessButtonPressPromise: Promise<void> | null = null;
  private resolveGuessButtonPress: (() => void) | null = null;

  private faxSpine: FaxController;

  private monitorsController: MonitorsController;
  private monitorsButtonsController: MonitorsButtonsController;
  private monitorsContainer: Container;

  private visitorSpine0: VisitorManController;
  private visitorSpine1: VisitorManController;
  private visitorSpine2: VisitorManController;

  private userSelectedIndex: number | null = null;

  private tempContainer = new Container();

  constructor(balance: Balance) {
    super();

    this.balance = balance;

    this.faxSpine = new FaxController(() => {
      // FIXME: СДЕЛАТЬЬ ЧТО ТО ПО КНОПЕ
      this.onFaxButtonPressed();
    });

    this.monitorsController = new MonitorsController();
    this.monitorsButtonsController = new MonitorsButtonsController(
      () => {
        this.handleMonitorClick(0);
        this.monitorsButtonsController.buttonPush(0);
      },
      () => {
        this.handleMonitorClick(1);
        this.monitorsButtonsController.buttonPush(1);
      },
      () => {
        this.handleMonitorClick(2);
        this.monitorsButtonsController.buttonPush(2);
      },
    );

    this.monitorsContainer = new Container();
    this.monitorsContainer.addChild(this.monitorsController, this.monitorsButtonsController);

    this.visitorSpine0 = new VisitorManController();
    this.visitorSpine1 = new VisitorManController();
    this.visitorSpine2 = new VisitorManController();

    // FIXME: удалить после отладки
    /* const originalSkins = this.balance.getVisitorSkin();
    const canvasData = '' as unknown as HTMLCanvasElement; // TODO: убрать заглушку, она нужна для генерации похожих посетителей, а также для передачи в GameScreen для отображения на факсе
    const portraitId = 'test_portrait';
    const authorNickname = 'test_author';

    this.showSuspects({
      portraitId,
      authorNickname,
      canvasData,
      originalSkins,
    }); */
    /// /////////
  }

  public resetForNewDay(): void {
    this.visitorSpine0.hideCharacterInstance();
    this.visitorSpine1.hideCharacterInstance();
    this.visitorSpine2.hideCharacterInstance();
    this.currentTarget = null;
    this.correctMonitorIndex = -1;
    this.monitorsEnabled = false;
  }

  public enableMonitorButtons(): void {
    this.monitorsButtonsController.buttonsOn();
  }

  /** Показываем трёх подозреваемых на мониторах */
  public async showSuspects(): Promise<void> {
    if (!this.currentTarget) {
      throw new Error('showSuspects called without currentTarget');
    }

    const options = this.generateOptions(this.currentTarget.originalSkins);
    this.correctMonitorIndex = options.findIndex((o) => o.isCorrect);

    const makeVisitor = (skins: PartIds): VisitorData => ({
      id: 'suspect_placeholder',
      skins,
      idleAnimation: VisitorManAnimation.SUSPECT,
      staySec: 0,
    });

    this.monitorsController.addToSlot(MonitorSlots.PORTRAIT_01, this.visitorSpine0);
    this.monitorsController.addToSlot(MonitorSlots.PORTRAIT_02, this.visitorSpine1);
    this.monitorsController.addToSlot(MonitorSlots.PORTRAIT_03, this.visitorSpine2);

    await this.monitorsController.screensOn();

    this.visitorSpine0.showCharacter(true, makeVisitor(options[0].skins));
    this.visitorSpine1.showCharacter(true, makeVisitor(options[1].skins));
    this.visitorSpine2.showCharacter(true, makeVisitor(options[2].skins));
  }

  /** Подсвечиваем правильный/неправильный ответ */
  public async showResults(): Promise<void> {
    // TODO: анимация результата на мониторах
    const userIndex = this.userSelectedIndex;
    const correctIndex = this.correctMonitorIndex;

    const win = userIndex === correctIndex;

    if (win) {
      if (userIndex === 0) {
        await this.visitorSpine0.showSuspectResultAnimation(true, false);
      } else if (userIndex === 1) {
        await this.visitorSpine1.showSuspectResultAnimation(true, false);
      } else {
        await this.visitorSpine2.showSuspectResultAnimation(true, false);
      }
    } else {
      if (userIndex === 0) {
        await this.visitorSpine0.showSuspectResultAnimation(false, false);
      } else if (userIndex === 1) {
        await this.visitorSpine1.showSuspectResultAnimation(false, false);
      } else {
        await this.visitorSpine2.showSuspectResultAnimation(false, false);
      }

      if (correctIndex === 0) {
        await this.visitorSpine0.showSuspectResultAnimation(true, true);
      } else if (correctIndex === 1) {
        await this.visitorSpine1.showSuspectResultAnimation(true, true);
      } else {
        await this.visitorSpine2.showSuspectResultAnimation(true, true);
      }
    }

    this.faxSpine.guessRecived(this.tempContainer);

    await this.hideSuspects();
  }

  /** Скрываем всех подозреваемых с мониторов */
  public async hideSuspects(): Promise<void> {
    // TODO: анимация ухода

    await this.monitorsController.screensOff();

    this.monitorsController.removeFromSlot(this.visitorSpine0);
    this.monitorsController.removeFromSlot(this.visitorSpine1);
    this.monitorsController.removeFromSlot(this.visitorSpine2);

    this.visitorSpine0.hideCharacterInstance();
    this.visitorSpine1.hideCharacterInstance();
    this.visitorSpine2.hideCharacterInstance();
  }

  public enableFax(): void {
    // +++ визуальная подсветка факса (мигание кнопки)
    this.faxSpine.buttonOn();
  }

  /**
   * GameScreen получил GuessTarget и передаёт нам.
   * Показываем картинку на факсе и рендерим варианты на мониторах.
   */
  public async presentTarget(target: GuessTarget): Promise<void> {
    this.currentTarget = target;

    this.tempContainer = new Container();

    this.faxSpine.setName(target.authorNickname);

    /* const backImage = Sprite.from('Paper');
    backImage.anchor.set(0.5);
    backImage.scale.set(0.47);
    container.addChild(backImage); */

    const texture = Texture.from(this.currentTarget.canvasData);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(2);
    sprite.blendMode = 'multiply';

    this.tempContainer.addChild(sprite);

    await this.faxSpine.acceptsServerResponse(this.tempContainer);

    // TODO: загрузить base64 в текстуру и положить на faxSheet
    // TODO: анимация выезда листа из факса

    // TODO: для каждого монитора собрать спайн с нужным skinset и зарендерить в RenderTexture

    this.monitorsEnabled = true;
    // TODO: подсветить мониторы
  }

  private generateOptions(correct: PartIds): Array<{ skins: PartIds; isCorrect: boolean }> {
    const spread = this.balance.getGuessSpread();
    const rand = (max: number) => Math.floor(Math.random() * max) + 1;

    const PART_MAXES: Record<keyof PartIds, number> = {
      head: 5,
      body: 6,
      nose: 9,
      ear: 9,
      mouth: 7,
      brow: 9,
      eye: 6,
      hat: 4,
      accessories: 6,
      hair: 9,
      beard: 5,
      scar: 6,
    };

    const OPTIONAL_PARTS: Array<keyof PartIds> = ['hat', 'accessories', 'hair', 'beard', 'scar'];

    const distort = (base: PartIds): PartIds => {
      const result = { ...base };
      for (const key of Object.keys(PART_MAXES) as Array<keyof PartIds>) {
        if (result[key] === undefined) continue;
        if (Math.random() < spread) {
          let newVal = rand(PART_MAXES[key]);
          if (PART_MAXES[key] > 1 && newVal === result[key]) {
            newVal = (newVal % PART_MAXES[key]) + 1;
          }
          result[key] = newVal;
        }
      }

      const missingOptionals = OPTIONAL_PARTS.filter((k) => base[k] === undefined);
      const addCount = Math.floor(Math.random() * Math.min(6, missingOptionals.length + 1));
      const shuffled = missingOptionals.sort(() => Math.random() - 0.5);
      for (let i = 0; i < addCount; i++) {
        result[shuffled[i]] = rand(PART_MAXES[shuffled[i]]);
      }

      return result;
    };

    const options = [
      { skins: correct, isCorrect: true },
      { skins: distort(correct), isCorrect: false },
      { skins: distort(correct), isCorrect: false },
    ];

    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return options;
  }

  private handleMonitorClick(index: number): void {
    if (!this.monitorsEnabled || !this.currentTarget) return;

    this.userSelectedIndex = index;

    this.onGuessButtonPressed();

    // this.onGuessMade(correct, this.currentTarget.portraitId);

    // TODO: анимация ответа на выбранном мониторе, убрать лист из факса
  }

  /** Вызывается после того, как GameScreen обработал результат */
  public async dismiss(): Promise<void> {
    // TODO: анимация ухода всего обратно в "покой", сброс currentTarget
    this.currentTarget = null;
    this.correctMonitorIndex = -1;
  }

  public async endServerResponse(): Promise<void> {
    this.faxSpine.waitServerResponse();
  }

  // Этот метод дожидается, пока игрок не нажмёт на кнопку факса.
  // Вызывается из стейтмашины.
  public waitForFaxButtonPress(): Promise<void> {
    if (!this.faxButtonPressPromise) {
      this.faxButtonPressPromise = new Promise<void>((resolve) => {
        this.resolveFaxButtonPress = resolve;
      });
    }
    return this.faxButtonPressPromise;
  }

  // FIXME: Временная заглушка для будущего вызова функции взаимодействия.
  public onFaxButtonPressed(): void {
    if (!this.resolveFaxButtonPress) return;

    this.resolveFaxButtonPress();
    this.resolveFaxButtonPress = null;
    this.faxButtonPressPromise = null;
  }

  // Этот метод дожидается, пока игрок не выберет подозреваемого.
  // Вызывается из стейтмашины.
  public waitForGuessButtonPress(): Promise<void> {
    if (!this.guessButtonPressPromise) {
      this.guessButtonPressPromise = new Promise<void>((resolve) => {
        this.resolveGuessButtonPress = resolve;
      });
    }
    return this.guessButtonPressPromise;
  }

  // FIXME: Временная заглушка для будущего вызова функции взаимодействия с мониторами.
  public onGuessButtonPressed(): void {
    if (!this.resolveGuessButtonPress) return;

    this.resolveGuessButtonPress();
    this.resolveGuessButtonPress = null;
    this.guessButtonPressPromise = null;
  }

  public update(dt: number): void {
    this.faxSpine.update(dt);
    this.monitorsController.update(dt);
    this.monitorsButtonsController.update(dt);

    this.visitorSpine0.update(dt);
    this.visitorSpine1.update(dt);
    this.visitorSpine2.update(dt);
  }

  public getFaxSpine(): FaxController {
    return this.faxSpine;
  }

  public getMonitors(): Container {
    return this.monitorsContainer;
  }

  public userIsCorrect(): boolean {
    return this.userSelectedIndex === this.correctMonitorIndex;
  }
}
