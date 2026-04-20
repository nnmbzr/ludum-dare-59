import type { BGM, SFX } from './engine/audio/audio';
import type { Navigation } from './engine/navigation/navigation';
import type { CreationResizePluginOptions, DeepRequired } from './engine/resize/ResizePlugin';
import type { ServerClient } from './engine/server/server';

declare global {
  namespace PixiMixins {
    interface Application extends DeepRequired<CreationResizePluginOptions> {
      audio: {
        bgm: BGM;
        sfx: SFX;
        getMasterVolume: () => number;
        setMasterVolume: (volume: number) => void;
        toggleMuteAll: () => boolean;
      };
      navigation: Navigation;
      server: ServerClient;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ApplicationOptions extends CreationResizePluginOptions {}
  }
}

export {};
