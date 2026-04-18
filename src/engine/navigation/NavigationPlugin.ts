import type { Application, ExtensionMetadata } from 'pixi.js';
import { ExtensionType } from 'pixi.js';

import type { CreationEngine } from '../engine';

import { Navigation } from './navigation';

/**
 * Middleware for Application's navigation functionality.
 *
 * Adds the following methods to Application:
 * * Application#navigation
 */
export class CreationNavigationPlugin {
  /** @ignore */
  public static extension: ExtensionMetadata = ExtensionType.Application;

  private static onResize: (() => void) | null;

  /**
   * Initialize the plugin with scope of application instance
   */
  public static init(): void {
    const app = this as unknown as CreationEngine;

    app.navigation = new Navigation();
    app.navigation.init(app);

    // Добавляем навигационный контейнер в виртуальный экран
    app.virtualScreen.gameContainer.addChild(app.navigation.container);

    this.onResize = () => app.navigation.resize(app.virtualScreen.virtualWidth, app.virtualScreen.virtualHeight);

    app.renderer.on('resize', this.onResize);
    app.resize();
  }

  /**
   * Clean up the navigation, scoped to application
   */
  public static destroy(): void {
    const app = this as unknown as Application;
    app.navigation = null as unknown as Navigation;
  }
}
