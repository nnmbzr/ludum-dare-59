import { PlaygroundScreen } from './app/screens/_dev/playground/PlaygroundScreen';
import type { AppScreenConstructor } from './engine/navigation/navigation';

export const DEBUG_START_SCREEN =
  import.meta.env.VITE_DEBUG_START_SCREEN === 'false' ? false : (import.meta.env.VITE_DEBUG_START_SCREEN as string);
export const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true';
export const DEV_MODE = import.meta.env.DEV;

// Позволяет выбирать стартовый экран из переменных окружения.
// Управляется через переменную VITE_DEBUG_START_SCREEN
export function getAppScreenByName(name: string): AppScreenConstructor {
  switch (name) {
    case 'PlaygroundScreen':
      return PlaygroundScreen;
    default:
      throw new Error(`Unknown screen name: ${name}`);
  }
}
