import { type PatternId, type SkinId } from './types';

/**
 * Параметры сложности + состояние сессии.
 */
export class Balance {
  public day = 1;
  public paperCount = 0;
  public quotaCompleted = 0;
  public dayTimeRemainingMs = 0;

  private currentDrawingTimeMs = 0;

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

  public getMinimumDrawMs(): number {
    // TODO: минимальное время, за которое пользователь должен нарисовать фоторобот. Если он сделал быстрее, имеет смысл добавлять это время к задержке перед следующими посетителем.
    return 3_000;
  }

  public getVisitorSpawnDelayMs(): number {
    // TODO: задержка между появлением посетителя (возможно, имеет смысл самого первого в день давать без задержки, а дальше уже как-то настраивать. Главное чтобы билось с квотой)
    return 3_000 + Math.max(0, this.getMinimumDrawMs() - this.currentDrawingTimeMs);
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
    this.quotaCompleted = 0;
    this.dayTimeRemainingMs = this.getDayDurationMs();
  }

  public drawAccepted(drawTimeMs: number): void {
    this.currentDrawingTimeMs = drawTimeMs;
  }

  public isDayOver(): boolean {
    return this.dayTimeRemainingMs <= 0;
  }

  public isQuotaMet(): boolean {
    return this.quotaCompleted >= this.getDailyQuota();
  }

  public reset(): void {
    this.day = 1;
    this.paperCount = this.getStartingPaperCount();
    this.quotaCompleted = 0;
    this.dayTimeRemainingMs = 0;
  }
}
