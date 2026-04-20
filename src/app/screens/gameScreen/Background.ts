import type { ValuesOf } from '@/app/utils/typesHelper';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/main';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import gsap from 'gsap';
import { Container } from 'pixi.js';
import { FisheyeFilter } from './FisheyeFilter';
import { GameDrawingBoard } from './drawing/GameDrawingBoard';

const DRAWING_PAD_BOARD_OFFSET_X = 45;
const DRAWING_PAD_BOARD_OFFSET_Y = -342;
const DRAWING_PAD_BOARD_SLOT_SCALE = 0.86;

const HOLST_CAMERA_INNER_DIST = 560;
const HOLST_CAMERA_OUTER_DIST = 1600;
const HOLST_CAMERA_INNER_DIST_ABOVE = 200;
const HOLST_CAMERA_OUTER_DIST_ABOVE = 380;

const HOLST_LOCK_SCREEN_OFFSET_X = 56;
const HOLST_LOCK_SCREEN_OFFSET_Y = 240;

const CAMERA_LAG = 0.45;
const SPINE_MAX_DT = 0.032;
const PARALLAX_OVERSCAN = 2.1;

function holstFollowWeight(dist: number, inner: number, outer: number): number {
  if (dist <= inner) return 1;
  if (dist >= outer) return 0;
  const t = (outer - dist) / (outer - inner);
  return t * t * (3 - 2 * t);
}

export const BACKGROUND_SLOTS = {
  CLOCK: 'Container_Timer',
  FAX: 'Container_Fax',
  CALENDAR: 'Container_Calendar',
  LEFT_MONITOR: 'Container_TV_01',
  CENTER_MONITOR: 'Container_TV_02',
  RIGHT_MONITOR: 'Container_TV_03',
  BIG_MONITOR: 'Container_TV_04',
  STAMP: 'Container_Stamp',
  DRAWING_PAD: 'Container_Drawing_Pad',
  DRAWING_PAD_2: 'Container_Drawing_Pad2',
  HINT: 'Container_text_01',
  TARGET_QUOTA: 'Container_text_02',
} as const;
type BACKGROUND_SLOTS = ValuesOf<typeof BACKGROUND_SLOTS>;

export class Background extends Container {
  private spine: Spine;
  private fisheyeFilter: FisheyeFilter;
  private spriteSizeW = 0;
  private spriteSizeH = 0;

  constructor() {
    super();
    this.sortableChildren = true;

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

  public mountDrawingBoard(layer: Container): void {
    this.spine.removeSlotObject(layer);
    if (layer.parent) layer.removeFromParent();
    this.spine.addSlotObject(BACKGROUND_SLOTS.DRAWING_PAD_2, layer);
    if (layer instanceof GameDrawingBoard) {
      layer.setSpineSlotBoardNudge(
        DRAWING_PAD_BOARD_OFFSET_X,
        DRAWING_PAD_BOARD_OFFSET_Y,
        DRAWING_PAD_BOARD_SLOT_SCALE,
      );
    }
  }

  public addObjectToSlot(slotName: BACKGROUND_SLOTS, object: Container): void {
    this.spine.addSlotObject(slotName, object);
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
    const scale = cover * PARALLAX_OVERSCAN;
    this.spine.scale.set(scale);
    this.spriteSizeW = Math.max(1e-3, lb.width * scale);
    this.spriteSizeH = Math.max(1e-3, lb.height * scale);
  }

  public updateFrame(deltaMs: number): void {
    const dt = Math.min(deltaMs * 0.001, SPINE_MAX_DT);
    this.spine.update(dt);
  }

  public updateMouse(x: number, y: number, holstCenterVirtual: { x: number; y: number } | null = null): void {
    const nx = (x - SCREEN_WIDTH / 2) / (SCREEN_WIDTH / 2);
    const ny = (y - SCREEN_HEIGHT / 2) / (SCREEN_HEIGHT / 2);

    const spriteW = this.spriteSizeW;
    const spriteH = this.spriteSizeH;
    const maxOffsetX = Math.max(0, spriteW * 0.5 - SCREEN_WIDTH / 2);
    const maxOffsetY = Math.max(0, spriteH * 0.5 - SCREEN_HEIGHT / 2);

    const parallaxX = -nx * maxOffsetX;
    const parallaxY = -ny * maxOffsetY;

    let targetX = parallaxX;
    let targetY = parallaxY;

    if (holstCenterVirtual) {
      const cx = holstCenterVirtual.x;
      const cy = holstCenterVirtual.y;
      const dist = Math.hypot(x - cx, y - cy);
      const aboveHolst = y < cy;
      const inner = aboveHolst ? HOLST_CAMERA_INNER_DIST_ABOVE : HOLST_CAMERA_INNER_DIST;
      const outer = aboveHolst ? HOLST_CAMERA_OUTER_DIST_ABOVE : HOLST_CAMERA_OUTER_DIST;
      const w = holstFollowWeight(dist, inner, outer);
      if (w > 0) {
        const lockCx = SCREEN_WIDTH * 0.5 - HOLST_LOCK_SCREEN_OFFSET_X;
        const lockCy = SCREEN_HEIGHT * 0.5 - HOLST_LOCK_SCREEN_OFFSET_Y;
        let lockX = this.x + lockCx - cx;
        let lockY = this.y + lockCy - cy;
        lockX = Math.max(-maxOffsetX, Math.min(maxOffsetX, lockX));
        lockY = Math.max(-maxOffsetY, Math.min(maxOffsetY, lockY));
        targetX = parallaxX * (1 - w) + lockX * w;
        targetY = parallaxY * (1 - w) + lockY * w;
      }
    }

    gsap.to(this, {
      x: targetX,
      y: targetY,
      duration: CAMERA_LAG,
      ease: 'sine.out',
      overwrite: true,
    });

    const left = this.spine.x - spriteW * 0.5;
    const top = this.spine.y - spriteH * 0.5;

    let u = (x - this.x - left) / spriteW;
    let v = (y - this.y - top) / spriteH;
    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      u = 0.5;
      v = 0.5;
    }

    this.fisheyeFilter.setCenter(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }
}
