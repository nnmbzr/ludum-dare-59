import { sound } from '@pixi/sound';
import type { ApplicationOptions, DestroyOptions, RendererDestroyOptions } from 'pixi.js';
import { Application, Assets, extensions, ResizePlugin } from 'pixi.js';
import 'pixi.js/app';

import { CreationAudioPlugin } from './audio/AudioPlugin';
import { CreationNavigationPlugin } from './navigation/NavigationPlugin';
import { CreationResizePlugin } from './resize/ResizePlugin';
import { CreationServerPlugin } from './server/ServerPlugin';
import { getResolution } from './utils/getResolution';

extensions.remove(ResizePlugin);
extensions.add(CreationResizePlugin);
extensions.add(CreationAudioPlugin);
extensions.add(CreationNavigationPlugin);
extensions.add(CreationServerPlugin);

/**
 * The main creation engine class.
 *
 * This is a lightweight wrapper around the PixiJS Application class.
 * It provides a few additional features such as:
 * - Navigation manager
 * - Audio manager
 * - Resize handling
 * - Visibility change handling (pause/resume sounds)
 *
 * It also initializes the PixiJS application and loads any assets in the `preload` bundle.
 */
export class CreationEngine extends Application {
  /** Initialize the application */
  public async init(opts: Partial<ApplicationOptions>): Promise<void> {
    opts.resizeTo ??= window;
    opts.resolution ??= getResolution();

    await super.init(opts);

    // Append the application canvas to the document body
    document.getElementById('pixi-container')!.appendChild(this.canvas);
    // Add a visibility listener, so the app can pause sounds and screens
    document.addEventListener('visibilitychange', this.visibilityChange);

    const manifest = await fetch('./assets/manifest.json').then((r) => r.json());

    // Init PixiJS assets with this asset manifest
    await Assets.init({ manifest, basePath: 'assets' });
    await Assets.loadBundle('preload');

    // List all existing bundles names
    const allBundles = manifest.bundles.map((item: { name: string }) => item.name);
    // Start up background loading of all bundles
    Assets.backgroundLoadBundle(allBundles);

    // Установка режима обработки событий для контейнеров
    this.stage.eventMode = 'static';
    this.virtualScreen.gameContainer.eventMode = 'static';
  }

  public override destroy(
    rendererDestroyOptions: RendererDestroyOptions = false,
    options: DestroyOptions = false,
  ): void {
    document.removeEventListener('visibilitychange', this.visibilityChange);
    super.destroy(rendererDestroyOptions, options);
  }

  /** Fire when document visibility changes - lose or regain focus */
  protected visibilityChange = () => {
    if (document.hidden) {
      sound.pauseAll();
      this.navigation.blur();
    } else {
      sound.resumeAll();
      this.navigation.focus();
    }
  };
}
