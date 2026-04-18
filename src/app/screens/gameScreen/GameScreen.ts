import { engine } from '@/app/getEngine';
import { PausePopup } from '@/app/popups/PausePopup';
import type { AppScreen } from '@/engine/navigation/navigation';
import {
  getTiledObjectsByTag,
  loadTiledTileLayers,
  type PlacedTiledObject,
  TiledObjectTags,
  type TiledWorldLayers,
} from '@/engine/tiledMap';
import gsap from 'gsap';
import { Assets, Container, Graphics, type FederatedPointerEvent, type Ticker } from 'pixi.js';

const PLAYER_HALF = 18;
const MAX_SPEED = 520;
const VELOCITY_SMOOTH = 16;
const MAX_DT = 0.032;

/** The screen that holds the app */
export class GameScreen extends Container implements AppScreen {
  public static assetBundles = ['main', 'dev'];
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnKeyUp = this.onKeyUp.bind(this);

  public mainContainer: Container;
  private paused = false;

  private worldContainer?: Container;
  private roomW = 0;
  private roomH = 0;
  private player?: Graphics;
  private vx = 0;

  private readonly keysDown = new Set<string>();
  private readonly moveEase = gsap.parseEase('power2.out');

  private pushables: { node: Container; w: number; h: number }[] = [];

  constructor() {
    super();

    this.mainContainer = new Container();
    this.addChild(this.mainContainer);
  }

  /** Prepare the screen just before showing */
  public prepare() {
    this.mainContainer.alpha = 0;

    this.cleanupEventHandlers();
    this.setupEventHandlers();
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    this.mainContainer.scale.set(1);
    this.paused = false;

    this.worldContainer?.destroy({ children: true });
    this.worldContainer = undefined;
    this.player = undefined;
    this.pushables = [];

    try {
      await Assets.unloadBundle('dev');
    } catch {
      /* бандл мог ещё не быть в кэше */
    }
    await Assets.loadBundle('dev');

    const tiled = await loadTiledTileLayers('demo-map', {
      'tiles.png': 'dev/maps/tiles',
    });
    const { root, mapWidthPx, mapHeightPx, objectsByTag } = tiled;
    this.roomW = mapWidthPx;
    this.roomH = mapHeightPx;

    const world = new Container();

    const underlay = new Graphics();
    const stripeW = 200;
    for (let x = 0; x < mapWidthPx; x += stripeW) {
      const alt = (x / stripeW) & 1;
      underlay.rect(x, 0, stripeW, mapHeightPx).fill(alt ? 0x1a1a28 : 0x252538);
    }
    world.addChild(underlay);

    world.addChild(root);
    this.spawnMapProps(objectsByTag, world);

    const poles = new Graphics();
    for (let x = 0; x < mapWidthPx; x += 520) {
      poles.rect(x, 0, 16, mapHeightPx).fill({ color: 0xffd54a, alpha: 0.9 });
    }
    world.addChild(poles);

    const player = new Graphics()
      .roundRect(-PLAYER_HALF, -PLAYER_HALF, PLAYER_HALF * 2, PLAYER_HALF * 2, 8)
      .fill({ color: 0xec1561 })
      .stroke({ width: 3, color: 0x4a1024, alpha: 1 });
    player.position.set(this.roomW * 0.5, this.roomH * 0.5);
    world.addChild(player);

    this.worldContainer = world;
    this.player = player;
    this.mainContainer.addChildAt(world, 0);
    this.syncCamera();

    await gsap.to(this.mainContainer, { alpha: 1, duration: 0.5 });
  }

  /** Hide screen with animations */
  public async hide() {
    await gsap.to(this.mainContainer, { alpha: 0, scale: 5, duration: 0.5 });
  }

  /** Update the screen */
  public update(time: Ticker) {
    if (this.paused || !this.player || !this.worldContainer) return;

    const dt = Math.min(time.deltaMS / 1000, MAX_DT);

    const ix = this.readHorizontalInput();
    const targetVx = ix * MAX_SPEED;
    const blend = this.moveEase(Math.min(1, VELOCITY_SMOOTH * dt));
    this.vx += (targetVx - this.vx) * blend;

    const py = this.roomH * 0.5;
    this.player.y = py;
    let px = this.player.x + this.vx * dt;
    px = this.resolvePushablesHorizontal(px, py, this.vx);
    this.player.x = Math.max(PLAYER_HALF, Math.min(this.roomW - PLAYER_HALF, px));

    this.syncCamera();
  }

  /** Resize the screen, fired whenever window size changes */
  public resize(_width: number, _height: number) {
    this.syncCamera();
  }

  /** Fully reset */
  public reset() {
    this.cleanupEventHandlers();
    this.worldContainer?.destroy({ children: true });
    this.worldContainer = undefined;
    this.player = undefined;
    this.pushables = [];
    this.vx = 0;
    this.paused = false;
    this.keysDown.clear();
  }

  /** Pause gameplay - automatically fired when a popup is presented */
  public async pause() {
    this.mainContainer.interactiveChildren = false;
    this.paused = true;
  }

  /** Resume gameplay */
  public async resume() {
    this.mainContainer.interactiveChildren = true;
    this.paused = false;
  }

  /** Auto pause the app when window go out of focus */
  public blur() {
    if (!engine().navigation.currentPopup) {
      engine().navigation.presentPopup(PausePopup);
    }
  }

  private setupEventHandlers() {
    document.addEventListener('keydown', this.boundOnKeyDown, true);
    document.addEventListener('keyup', this.boundOnKeyUp, true);
    this.on('pointermove', this.boundOnPointerMove);
    this.on('pointerdown', this.boundOnPointerDown);
    this.eventMode = 'static';
  }

  private cleanupEventHandlers() {
    document.removeEventListener('keydown', this.boundOnKeyDown, true);
    document.removeEventListener('keyup', this.boundOnKeyUp, true);
    this.off('pointermove', this.boundOnPointerMove);
    this.off('pointerdown', this.boundOnPointerDown);
  }

  private onPointerDown(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);

    console.log(`Pointer down at (${x}, ${y})`);
  }

  private onPointerMove(e: FederatedPointerEvent) {
    const { x, y } = engine().virtualScreen.toVirtualCoordinates(e.global.x, e.global.y);

    console.log(`Pointer move at (${x}, ${y})`);
  }

  private readHorizontalInput(): number {
    let x = 0;
    if (this.keysDown.has('KeyA')) x -= 1;
    if (this.keysDown.has('KeyD')) x += 1;
    return x;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === 'KeyA' || e.code === 'KeyD') {
      e.preventDefault();
      this.keysDown.add(e.code);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keysDown.delete(e.code);
  }

  private spawnMapProps(objectsByTag: TiledWorldLayers['objectsByTag'], world: Container): void {
    this.pushables = [];
    const scenery = getTiledObjectsByTag(objectsByTag, TiledObjectTags.SCENERY);
    const pushableDefs = getTiledObjectsByTag(objectsByTag, TiledObjectTags.PUSHABLE);
    for (const po of scenery) {
      world.addChild(this.makeSceneryVisual(po));
    }
    for (const po of pushableDefs) {
      const node = this.makePushableVisual(po);
      world.addChild(node);
      this.pushables.push({ node, w: po.width, h: po.height });
    }
  }

  private makeSceneryVisual(po: PlacedTiledObject): Container {
    const c = new Container();
    c.label = `${po.tag}:${po.name || po.id}`;
    c.position.set(po.x, po.y);
    const g = new Graphics();
    g.rect(0, 0, po.width, po.height).fill({ color: 0x5a6d52, alpha: 0.92 }).stroke({ width: 2, color: 0x323d2e, alpha: 0.85 });
    c.addChild(g);
    return c;
  }

  private makePushableVisual(po: PlacedTiledObject): Container {
    const c = new Container();
    c.label = `${po.tag}:${po.name || po.id}`;
    c.position.set(po.x, po.y);
    const g = new Graphics()
      .roundRect(0, 0, po.width, po.height, 14)
      .fill({ color: 0xa07040, alpha: 1 })
      .stroke({ width: 4, color: 0x3d2414, alpha: 1 });
    c.addChild(g);
    return c;
  }

  private resolvePushablesHorizontal(px: number, py: number, velX: number): number {
    if (this.pushables.length === 0) return px;
    const ph = PLAYER_HALF;
    const ordered =
      velX >= 0
        ? [...this.pushables].sort((a, b) => a.node.position.x - b.node.position.x)
        : [...this.pushables].sort((a, b) => b.node.position.x - a.node.position.x);
    let x = px;
    for (const p of ordered) {
      x = this.separatePlayerFromCrate(x, py, ph, velX, p);
    }
    return x;
  }

  private separatePlayerFromCrate(
    px: number,
    py: number,
    ph: number,
    velX: number,
    p: { node: Container; w: number; h: number },
  ): number {
    let cx = p.node.position.x;
    const cy = p.node.position.y;
    const cw = p.w;
    const ch = p.h;

    if (py + ph <= cy || py - ph >= cy + ch) {
      return px;
    }

    const pl = px - ph;
    const pr = px + ph;
    if (pr <= cx || pl >= cx + cw) {
      return px;
    }

    if (Math.abs(velX) < 1e-6) {
      const penL = pr - cx;
      const penR = cx + cw - pl;
      if (penL < penR) px = cx - ph;
      else px = cx + cw + ph;
      p.node.position.x = cx;
      return px;
    }

    if (velX > 0) {
      let pen = pr - cx;
      if (pen > 0) {
        cx = Math.min(this.roomW - cw, cx + pen);
        pen = pr - cx;
        if (pen > 0) px = cx - ph;
      }
    } else {
      let pen = cx + cw - pl;
      if (pen > 0) {
        cx = Math.max(0, cx - pen);
        pen = cx + cw - pl;
        if (pen > 0) px = cx + cw + ph;
      }
    }
    p.node.position.x = cx;
    return px;
  }

  private syncCamera() {
    if (!this.worldContainer || !this.player) return;
    const vs = engine().virtualScreen;
    const vw = vs.virtualWidth;
    const vh = vs.virtualHeight;
    const halfW = vw * 0.5;
    const halfH = vh * 0.5;

    let camX = this.player.x;
    let camY = this.player.y;
    if (this.roomW > vw) {
      camX = Math.max(halfW, Math.min(this.roomW - halfW, camX));
    } else {
      camX = this.roomW * 0.5;
    }
    if (this.roomH > vh) {
      camY = Math.max(halfH, Math.min(this.roomH - halfH, camY));
    } else {
      camY = this.roomH * 0.5;
    }

    this.worldContainer.position.set(halfW - camX, halfH - camY);
  }
}
