import type { Application, ExtensionMetadata } from 'pixi.js';
import { ExtensionType } from 'pixi.js';

import { ServerClient } from './server';

/**
 * Middleware for Application's server functionality.
 *
 * Adds the following methods to Application:
 * * Application#server
 */
export class CreationServerPlugin {
  /** @ignore */
  public static extension: ExtensionMetadata = ExtensionType.Application;

  /**
   * Initialize the plugin with scope of application instance
   */
  public static init(): void {
    const app = this as unknown as Application;

    app.server = new ServerClient();
  }

  /**
   * Clean up the server client, scoped to application
   */
  public static destroy(): void {
    const app = this as unknown as Application;
    app.server = null as unknown as Application['server'];
  }
}
