import { type PatternId, type SkinId } from './types';

// Минимальное время, которое должно пройти с начала рисования, чтобы его можно было считать полноценным.
// Если пользователь нарисовал фоторобот быстрее, то имеет смысл добавить к задержке перед следующим посетителем
// недостающие секунды, чтобы не давать игроку слишком лёгкую игру.
const MINIMUM_DRAW_TIME_SEC = 3;

const FIRST_VISITOR_SPAWN_DELAY_SEC = 3;

/**
 * Параметры сложности + состояние сессии.
 */
export class Balance {
  public day = 1;
  public paperCount = 0;
  public dayTimeRemainingMs = 0;

  private currentDrawingTimeMs = 0;
  private firstVisitorSpawned = false;

  private currentDailyQuota = 0;

  /** Сколько фотороботов надо сдать за день */
  public getDailyQuota(): number {
    // TODO: формула от day. Или свитчём или ещё как-то
    return 3;
  }

  public getDayDurationMs(): number {
    // TODO: сколько длится
    return 120_000; // 2 минуты
  }

  public getVisitorStayMs(): number {
    // TODO: уменьшать с ростом day (через сколько времени посетитель уйдёт с камеры)
    return 10_000;
  }

  public getMinimumDrawSec(): number {
    // TODO: минимальное время, за которое пользователь должен нарисовать фоторобот. Если он сделал быстрее, имеет смысл добавлять это время к задержке перед следующими посетителем.
    return MINIMUM_DRAW_TIME_SEC;
  }

  public getVisitorSpawnDelaySec(): number {
    // TODO: задержка между появлением посетителя
    let delay = FIRST_VISITOR_SPAWN_DELAY_SEC;

    // Возможно, имеет смысл самого первого в день давать без задержки
    // а дальше уже как-то настраивать. Главное чтобы билось с квотой)
    if (!this.firstVisitorSpawned) {
      this.firstVisitorSpawned = true;
      delay = 0;
    }

    const fine = Math.max(0, this.getMinimumDrawSec() - this.currentDrawingTimeMs / 1000);

    return delay + fine;
  }

  /** Разброс для угадывания: 0 = все варианты идентичны (нерешаемо!), 1 = все разные */
  public getGuessSpread(): number {
    // TODO: растёт с day → сложнее угадывать (варианты ближе друг к другу)
    // Тут ещё нужно подумать над логикой. Возможно делать разброс по разным частям лица. Например при сложности 0.8 - всегда будут одинаковые глаза и рот.
    // И это явно нужно привязать к текущему дню.
    return 0.6;
  }

  /** Доступные на этом дне скины для каждого паттерна */
  public getAvailableSkins(): Record<PatternId, SkinId[]> {
    // TODO: на первых днях — ограниченный набор, потом расширяется.
    // Вероятно эти данные можно держать в виде констант где-то вне баланса, чтобы не засорять его.
    const eyes = [1, 3, 5];
    const nose = [2, 4];
    const mouth = [1, 5, 4, 2];
    const face = [2, 4, 5];
    const clothes = [2, 4, 5];

    return { eyes, nose, mouth, face, clothes };
  }

  public getStartingPaperCount(): number {
    // Отдаём стартовое значение бумаги. Бумага даётся только при старте игры!
    return 3;
  }

  public getRewardForGuessing(correct: boolean): number {
    // TODO: нужно подумать что именно мы даём как награду
    return correct ? 2 : 1; // TODO: формула от day. Или свитчём или ещё как-то
  }

  public startDay(): void {
    this.dayTimeRemainingMs = this.getDayDurationMs();
    this.firstVisitorSpawned = false;
    this.paperCount = this.getStartingPaperCount();
  }

  public drawAccepted(drawTimeMs: number): void {
    this.currentDrawingTimeMs = drawTimeMs;
  }

  public isDayOver(): boolean {
    return this.dayTimeRemainingMs <= 0;
  }

  public isQuotaMet(): boolean {
    return this.currentDailyQuota >= this.getDailyQuota();
  }

  public reset(): void {
    this.day = 1;
    this.dayTimeRemainingMs = 0;
    this.firstVisitorSpawned = false;
    this.currentDailyQuota = 0;
  }
}
