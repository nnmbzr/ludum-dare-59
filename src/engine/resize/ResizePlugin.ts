import type { Application, ApplicationOptions, ExtensionMetadata, ResizePluginOptions } from 'pixi.js';
import { ExtensionType } from 'pixi.js';

import { VirtualScreen } from './VirtualScreen';

// Custom utility type:
export type DeepRequired<T> = Required<{
  [K in keyof T]: DeepRequired<T[K]>;
}>;

/**
 * Application options for the CreationResizePlugin.
 */
export interface CreationResizePluginOptions extends ResizePluginOptions {
  /** Options for controlling the resizing of the application */
  resizeOptions?: {
    /** Virtual width - fixed design resolution */
    virtualWidth?: number;
    /** Virtual height - fixed design resolution */
    virtualHeight?: number;
    /** Background color for the letterbox areas */
    letterboxColor?: number;
    /** Whether to use letterbox mode */
    letterbox?: boolean;
  };
}

/**
 * Middleware for Application's resize functionality.
 *
 * Adds the following methods to Application:
 * * Application#resizeTo
 * * Application#resize
 * * Application#queueResize
 * * Application#cancelResize
 * * Application#resizeOptions
 */

export class CreationResizePlugin {
  /** @ignore */
  public static extension: ExtensionMetadata = ExtensionType.Application;

  private static resizeId: number | null;
  private static resizeElement: Window | HTMLElement | null;
  private static cancelResize: (() => void) | null;

  /**
   * Initialize the plugin with scope of application instance
   * @param {object} [options] - See application options
   */
  public static init(options: ApplicationOptions): void {
    const app = this as unknown as Application;

    // Create virtual screen with default or provided dimensions
    const virtualWidth = options.resizeOptions?.virtualWidth || 1920;
    const virtualHeight = options.resizeOptions?.virtualHeight || 1080;
    const letterboxColor = options.resizeOptions?.letterboxColor || 0x000000;

    // Add virtual screen to application
    app.virtualScreen = new VirtualScreen(virtualWidth, virtualHeight);
    app.virtualScreen.letterboxColor = letterboxColor;

    // Add containers to stage
    app.stage.addChild(app.virtualScreen.gameContainer);
    app.stage.addChild(app.virtualScreen.letterboxContainer);

    // Важно: используем приватную переменную для хранения значения resizeTo
    Object.defineProperty(app, 'resizeTo', {
      set(dom: Window | HTMLElement) {
        globalThis.removeEventListener('resize', app.queueResize);
        // Сохраняем в статическую переменную класса, а не в this
        CreationResizePlugin.resizeElement = dom;
        if (dom) {
          globalThis.addEventListener('resize', app.queueResize);
          app.resize();
        }
      },
      get() {
        // Возвращаем из статической переменной
        return CreationResizePlugin.resizeElement;
      },
    });

    // Queue resize with throttling
    app.queueResize = (): void => {
      if (!CreationResizePlugin.resizeElement) {
        return;
      }

      CreationResizePlugin.cancelResize?.();
      CreationResizePlugin.resizeId = requestAnimationFrame(() => app.resize());
    };

    // Resize implementation
    app.resize = (): void => {
      if (!CreationResizePlugin.resizeElement) {
        return;
      }

      CreationResizePlugin.cancelResize?.();

      let canvasWidth: number;
      let canvasHeight: number;

      // Get dimensions from window or element
      if (CreationResizePlugin.resizeElement === globalThis.window) {
        canvasWidth = globalThis.innerWidth;
        canvasHeight = globalThis.innerHeight;
      } else {
        const { clientWidth, clientHeight } = CreationResizePlugin.resizeElement as HTMLElement;
        canvasWidth = clientWidth;
        canvasHeight = clientHeight;
      }

      // Set canvas style dimensions
      app.renderer.canvas.style.width = `${canvasWidth}px`;
      app.renderer.canvas.style.height = `${canvasHeight}px`;

      // Resize renderer
      app.renderer.resize(canvasWidth, canvasHeight);

      // Update virtual screen
      app.virtualScreen.resize(canvasWidth, canvasHeight);

      // Scroll to top
      window.scrollTo(0, 0);
    };

    CreationResizePlugin.cancelResize = (): void => {
      if (CreationResizePlugin.resizeId) {
        cancelAnimationFrame(CreationResizePlugin.resizeId);
        CreationResizePlugin.resizeId = null;
      }
    };

    CreationResizePlugin.resizeId = null;
    CreationResizePlugin.resizeElement = null;

    // Initialize with provided options
    app.resizeOptions = {
      virtualWidth,
      virtualHeight,
      letterbox: options.resizeOptions?.letterbox ?? true,
      letterboxColor,
    };

    app.resizeTo = options.resizeTo || (null as unknown as Window | HTMLElement);
  }

  /**
   * Clean up the resize handler, scoped to application
   */
  public static destroy(): void {
    const app = this as unknown as Application;

    globalThis.removeEventListener('resize', app.queueResize);
    CreationResizePlugin.cancelResize?.();
    CreationResizePlugin.cancelResize = null;
    app.queueResize = null as unknown as () => void;
    app.resizeTo = null as unknown as Window | HTMLElement;
    app.resize = null as unknown as () => void;
  }
}
