import type { ValuesOf } from '@/app/utils/typesHelper';
import { type PlayOptions } from '@pixi/sound';
import { engine } from '../getEngine';

export const SFX = {
  TestSound: 'bardachok-open', // тестовый звук
} as const;
export type SFX = ValuesOf<typeof SFX>;

// Собираем типы всех игровых звуков
export type GameSFX = SFX;

export class SoundManager {
  private static _instance: SoundManager | null = null;

  // При необходимости добавляем инстансы звуков (для управления ими, если это не единичный звук)

  /** Это синглтон. Обращаться как SoundManager.instance */
  private constructor() {}

  public static get instance(): SoundManager {
    if (!SoundManager._instance) {
      SoundManager._instance = new SoundManager();
    }
    return SoundManager._instance;
  }

  public async gameInit() {
    // Запуск звуков/музыки при старте игры
  }

  public async playSFX(sfx: GameSFX, volume: number = 0.5, options?: PlayOptions) {
    return await engine().audio.sfx.play(sfx, { volume, ...options });
  }
}
