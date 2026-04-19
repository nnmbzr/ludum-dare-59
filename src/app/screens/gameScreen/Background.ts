import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/main';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import gsap from 'gsap';
import { Container } from 'pixi.js';
import { FisheyeFilter } from './FisheyeFilter';

const CAMERA_LAG = 0.45;
const SPINE_MAX_DT = 0.032;
const PARALLAX_OVERSCAN = 2.1;

export class Background extends Container {
  private spine: Spine;
  private fisheyeFilter: FisheyeFilter;

  constructor() {
    super();

    this.spine = Spine.from({
      skeleton: 'background.json',
      atlas: 'background.atlas',
      autoUpdate: false,
    });
    this.spine.label = 'game_background_spine';
    this.layoutBackgroundSpine();

    this.fisheyeFilter = new FisheyeFilter(0.25);
    this.fisheyeFilter.strength = 0.1;
    this.fisheyeFilter.spotSize = 0.15;
    this.fisheyeFilter.mouseRange = 0.25;
    this.spine.filters = [this.fisheyeFilter];

    this.spine.state.setAnimation(0, 'animation', true);

    this.addChild(this.spine);
  }

  private layoutBackgroundSpine() {
    this.spine.update(0);
    const lb = this.spine.getLocalBounds();
    if (lb.width <= 1e-4 || lb.height <= 1e-4) {
      this.spine.pivot.set(0, 0);
      this.spine.position.set(SCREEN_WIDTH * 0.5, SCREEN_HEIGHT * 0.5);
      this.spine.scale.set(1);
      return;
    }
    this.spine.pivot.set(lb.x + lb.width * 0.5, lb.y + lb.height * 0.5);
    this.spine.position.set(SCREEN_WIDTH * 0.5, SCREEN_HEIGHT * 0.5);
    const cover = Math.max(SCREEN_WIDTH / lb.width, SCREEN_HEIGHT / lb.height);
    this.spine.scale.set(cover * PARALLAX_OVERSCAN);
  }

  public updateFrame(deltaMs: number): void {
    const dt = Math.min(deltaMs * 0.001, SPINE_MAX_DT);
    this.spine.update(dt);
  }

  /** Call with virtual screen coordinates on pointer move */
  public updateMouse(x: number, y: number): void {
    const nx = (x - SCREEN_WIDTH / 2) / (SCREEN_WIDTH / 2);
    const ny = (y - SCREEN_HEIGHT / 2) / (SCREEN_HEIGHT / 2);

    this.spine.update(0);
    const lb = this.spine.getLocalBounds();
    const spriteW = lb.width * Math.abs(this.spine.scale.x);
    const spriteH = lb.height * Math.abs(this.spine.scale.y);
    const maxOffsetX = Math.max(0, spriteW * 0.5 - SCREEN_WIDTH / 2);
    const maxOffsetY = Math.max(0, spriteH * 0.5 - SCREEN_HEIGHT / 2);

    gsap.to(this, {
      x: -nx * maxOffsetX,
      y: -ny * maxOffsetY,
      duration: CAMERA_LAG,
      ease: 'sine.out',
      overwrite: true,
    });

    const left = this.spine.x - spriteW * 0.5;
    const top = this.spine.y - spriteH * 0.5;

    const u = (x - this.x - left) / spriteW;
    const v = (y - this.y - top) / spriteH;

    this.fisheyeFilter.setCenter(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }
}
