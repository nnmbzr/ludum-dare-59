import { type GuessTarget } from './types';

/**
 * Клиент-серверное взаимодействие.
 */
export class Server {
  private bakedPhotofits: GuessTarget[] = [];
  private readonly baseUrl = ''; // TODO: заполнить! Пока не будет заполнено, отдаём фаллбэчные ответы.
  private readonly timeoutMs = 3000; // сколько максимум ждём ответа

  public setBakedPhotofits(baked: GuessTarget[]): void {
    this.bakedPhotofits = baked;
  }

  public async submitPhotofit(_base64Image: string, _originalSkins: unknown): Promise<void> {
    // TODO:
    // - fetch с AbortController по timeoutMs
    // - при ошибке просто console.warn и return (не роняем игру)
    // - тело: { image: base64Image, skins: originalSkins, nickname: ... }
  }

  public async fetchPhotofitToGuess(): Promise<GuessTarget> {
    // TODO:
    // - fetch получаем с сервера фоторобот для угадывания.
    // - при ошибке или таймауте — вернуть случайный из bakedPhotofits
    // - если и baked пуст — бросить ошибку (ЗАБЫЛИ ЗАПОЛНИТЬ!)
    if (this.bakedPhotofits.length === 0) {
      throw new Error('No baked photofits provided');
    }
    return this.bakedPhotofits[Math.floor(Math.random() * this.bakedPhotofits.length)];
  }

  public async reportGuess(_targetAuthor: string, _correct: boolean): Promise<void> {
    // TODO: fire-and-forget fetch. Без ответа. Чтобы сервер понимал что по этому фотороботу было успешное отгадывание.
    // Хотя конечно тут уязвимое место. Можно накрутить себе угадываний (или сбросить стату другому игроку). Как бы это прикрыть? Держать список угаданных по игроку? СЛОЖНО СЛОЖНО.
  }

  public async pollMyPhotofitGuessed(): Promise<string | null> {
    // TODO: вернуть ник того, кто угадал наш фоторобот, или null.
    // Вызывается раз в N секунд (N ~ 5-10) из GameScreen.
    return null;
  }
}
