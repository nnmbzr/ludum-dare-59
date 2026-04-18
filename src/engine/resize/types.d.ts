import type { VirtualScreen } from './VirtualScreen';

declare module 'pixi.js' {
  interface Application {
    /** Virtual screen manager */
    virtualScreen: VirtualScreen;
    /** Resize options */
    resizeOptions: {
      virtualWidth: number;
      virtualHeight: number;
      letterbox: boolean;
      letterboxColor?: number;
    };
  }
}
