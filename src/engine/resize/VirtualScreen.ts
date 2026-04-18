// src/engine/resize/VirtualScreen.ts
import { Container, Graphics } from 'pixi.js';

/**
 * Manages a fixed-size virtual screen that scales while maintaining aspect ratio
 */
export class VirtualScreen {
  /** The main container that holds all game content */
  public gameContainer: Container;

  /** Container for letterbox background areas */
  public letterboxContainer: Container;

  /** Virtual width - the design width all UI is built for */
  public virtualWidth: number;

  /** Virtual height - the design height all UI is built for */
  public virtualHeight: number;

  /** Current scale factor of the virtual screen */
  public scale: number = 1;

  /** Color used for letterbox areas */
  public letterboxColor: number = 0x000000;

  /**
   * Creates a new virtual screen manager
   * @param virtualWidth The design width
   * @param virtualHeight The design height
   */
  constructor(virtualWidth: number, virtualHeight: number) {
    this.virtualWidth = virtualWidth;
    this.virtualHeight = virtualHeight;

    this.gameContainer = new Container();
    this.letterboxContainer = new Container();
  }

  /**
   * Updates screen dimensions and recalculates positioning and scaling
   * @param screenWidth Actual screen width
   * @param screenHeight Actual screen height
   */
  public resize(screenWidth: number, screenHeight: number): void {
    // Calculate scale to maintain aspect ratio
    const scaleX = screenWidth / this.virtualWidth;
    const scaleY = screenHeight / this.virtualHeight;
    this.scale = Math.min(scaleX, scaleY);

    // Scale virtual screen
    this.gameContainer.scale.set(this.scale);

    // Center on the screen
    this.gameContainer.x = (screenWidth - this.virtualWidth * this.scale) / 2;
    this.gameContainer.y = (screenHeight - this.virtualHeight * this.scale) / 2;

    // Update letterbox areas
    this.updateLetterbox(screenWidth, screenHeight);
  }

  /**
   * Updates the letterbox background areas
   * @param screenWidth Actual screen width
   * @param screenHeight Actual screen height
   */
  private updateLetterbox(screenWidth: number, screenHeight: number): void {
    // Clear existing letterbox
    this.letterboxContainer.removeChildren();

    // Create graphics for letterbox areas
    const graphics = new Graphics();
    graphics.fill(this.letterboxColor);

    // Top area (if needed)
    if (this.gameContainer.y > 0) {
      graphics.rect(0, 0, screenWidth, this.gameContainer.y);
    }

    // Bottom area (if needed)
    if (this.gameContainer.y + this.virtualHeight * this.scale < screenHeight) {
      const y = this.gameContainer.y + this.virtualHeight * this.scale;
      graphics.rect(0, y, screenWidth, screenHeight - y);
    }

    // Left area (if needed)
    if (this.gameContainer.x > 0) {
      graphics.rect(0, this.gameContainer.y, this.gameContainer.x, this.virtualHeight * this.scale);
    }

    // Right area (if needed)
    if (this.gameContainer.x + this.virtualWidth * this.scale < screenWidth) {
      const x = this.gameContainer.x + this.virtualWidth * this.scale;
      graphics.rect(x, this.gameContainer.y, screenWidth - x, this.virtualHeight * this.scale);
    }

    graphics.fill();
    this.letterboxContainer.addChild(graphics);
  }

  /**
   * Converts screen coordinates to virtual screen coordinates
   * @param x Screen X coordinate
   * @param y Screen Y coordinate
   * @returns Virtual screen coordinates
   */
  public toVirtualCoordinates(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(0, (x - this.gameContainer.x) / this.scale),
      y: Math.max(0, (y - this.gameContainer.y) / this.scale),
    };
  }

  /**
   * Checks if a screen coordinate is within the virtual screen
   * @param x Screen X coordinate
   * @param y Screen Y coordinate
   * @returns True if inside the virtual screen
   */
  public isInVirtualScreen(x: number, y: number): boolean {
    const vCoords = this.toVirtualCoordinates(x, y);
    return vCoords.x >= 0 && vCoords.x <= this.virtualWidth && vCoords.y >= 0 && vCoords.y <= this.virtualHeight;
  }
}
