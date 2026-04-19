import { Container, type FederatedPointerEvent, type Graphics, type Sprite } from 'pixi.js';
import { type PatternId, type SkinSet } from './types';

type Tool = 'brush' | 'hand' | 'eraser';

interface PlacedPattern {
  patternId: PatternId;
  skinId: string;
  sprite: Sprite;
}

interface Stroke {
  graphics: Graphics;
  // сохраняем точки, чтобы потом можно было восстановить или стереть
  points: Array<{ x: number; y: number }>;
}

/**
 * Планшет с фотороботом.
 * Держит: холст, выбранные паттерны, undo-стек, кнопку Accept.
 *
 * Когда игрок жмёт Accept:
 *  - растеризуем содержимое в base64 (renderer.extract.base64)
 *  - тут ещё будет оптимизация для отправки на сервер. Но это потом.
 *  - отдаём наружу через onSubmitted
 */
export class Drawing extends Container {
  private canvas: Container; // сюда добавляются штрихи и спрайты паттернов
  private strokes: Stroke[] = [];
  private placedPatterns = new Map<PatternId, PlacedPattern>();
  private currentStroke: Stroke | null = null;
  private tool: Tool = 'brush';
  private targetSkins: SkinSet | null = null;

  /** Коллбэк при нажатии Accept.  */
  /** Этот класс должен самостоятельно его отскейлить, перевести в base64, оптимизировать и просто передать для отправки на сервер */
  public onSubmitted: (data: string, originalSkins: SkinSet) => void = () => {};

  constructor() {
    super();
    this.canvas = new Container();
    this.addChild(this.canvas);

    // TODO:
    // - создать фон листа (бумажная текстура)
    // - создать палитру инструментов (brush/hand/eraser) — нужно будет уточнить у Артов
    // - создать галерею паттернов по категориям (eyes/nose/mouth) — UI уточнить у артов
    // - создать кнопку Accept, привязать к this.submit
    // - сделать canvas интерактивным, принимать необходимые события
  }

  /** Начало новой сессии рисования под нового посетителя */
  public beginNewSheet(targetSkins: SkinSet): void {
    this.targetSkins = targetSkins;
    this.clear();
    // TODO: анимация? Устанавливаем "дефолтные" паттерны на канвасе. В зависимости от уровня, эти паттерны могут отличаться (брать из доступных)
  }

  public setTool(tool: Tool): void {
    this.tool = tool;
    // TODO: обновить визуал выбранного инструмента в палитре
  }

  /** Выбор паттерна из галереи  */
  public placePattern(_patternId: PatternId, _skinId: string): void {
    // TODO:
    // - заменить текстуру текущего паттерна
    // - сделать его draggable при tool === 'hand'
    // - запомнить в placedPatterns
    throw new Error('Not implemented');
  }

  private onPointerDown(_e: FederatedPointerEvent): void {
    if (this.tool !== 'brush') return;
    // TODO:
    // - создать новый Stroke (Graphics), добавить в canvas
    // - this.currentStroke = stroke
    // - stroke.graphics.moveTo(localX, localY)
  }

  private onPointerMove(_e: FederatedPointerEvent): void {
    if (!this.currentStroke) return;
    // TODO:
    // - возможно подумать над локальными координатами через e.getLocalPosition(this.canvas)
  }

  private onPointerUp(): void {
    if (!this.currentStroke) return;
    this.strokes.push(this.currentStroke);
    this.currentStroke = null;
    // TODO: что-то ещё?
  }

  public undo(): void {
    // TODO: отменить действие
  }

  public clear(): void {
    // TODO: очистить strokes, сбросить позиционирование паттернов на их дефолтные позиции
  }

  private submit(): void {
    if (!this.targetSkins) return;
    // Accept — отдать холст наружу. GameScreen растеризует и отправит.
    // делаем какие-то действия с this.canvas
    // Растеризуем canvas → base64
    // TODO: const base64 = await engine().renderer.extract.base64({ target: canvas });
    this.onSubmitted('FALLBACK_DATA', this.targetSkins);
  }

  /** Геттер для GameScreen, чтобы знать, можно ли сейчас рисовать */
  public getCanvas(): Container {
    return this.canvas;
  }
}
