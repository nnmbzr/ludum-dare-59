import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/main';
import gsap from 'gsap';
import { Container, Sprite } from 'pixi.js';
import { FisheyeFilter } from './FisheyeFilter';

const CAMERA_LAG = 0.45;

export class Background extends Container {
  private sprite: Sprite;
  private fisheyeFilter: FisheyeFilter;

  constructor() {
    super();

    this.sprite = Sprite.from('TestBackground');
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(1.5);
    this.sprite.position.set(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

    this.fisheyeFilter = new FisheyeFilter(0.25);
    this.fisheyeFilter.strength = 0.1;
    this.fisheyeFilter.spotSize = 0.15;
    this.fisheyeFilter.mouseRange = 0.25;
    this.sprite.filters = [this.fisheyeFilter];

    this.addChild(this.sprite);
  }

  /** Call with virtual screen coordinates on pointer move */
  public updateMouse(x: number, y: number): void {
    const nx = (x - SCREEN_WIDTH / 2) / (SCREEN_WIDTH / 2);
    const ny = (y - SCREEN_HEIGHT / 2) / (SCREEN_HEIGHT / 2);

    const tex = this.sprite.texture;
    const spriteW = tex.width * this.sprite.scale.x;
    const spriteH = tex.height * this.sprite.scale.y;
    const maxOffsetX = Math.max(0, spriteW * this.sprite.anchor.x - SCREEN_WIDTH / 2);
    const maxOffsetY = Math.max(0, spriteH * this.sprite.anchor.y - SCREEN_HEIGHT / 2);

    gsap.to(this, {
      x: -nx * maxOffsetX,
      y: -ny * maxOffsetY,
      duration: CAMERA_LAG,
      ease: 'sine.out',
      overwrite: true,
    });

    const left = this.sprite.x - spriteW * this.sprite.anchor.x;
    const top = this.sprite.y - spriteH * this.sprite.anchor.y;

    const u = (x - this.x - left) / spriteW;
    const v = (y - this.y - top) / spriteH;

    this.fisheyeFilter.setCenter(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }
}
