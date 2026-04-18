import { Assets, Container, Graphics } from 'pixi.js';

/** Значения поля `type` у объектов Tiled — удобный доступ из кода по тегу. */
export const TiledObjectTags = {
  PUSHABLE: 'pushable',
  SCENERY: 'scenery',
} as const;

export type TiledObjectTag = (typeof TiledObjectTags)[keyof typeof TiledObjectTags];

const TAGGED_TYPES = new Set<string>(Object.values(TiledObjectTags));

export interface PlacedTiledObject {
  readonly tag: TiledObjectTag;
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function getTiledObjectsByTag(
  byTag: ReadonlyMap<TiledObjectTag, readonly PlacedTiledObject[]>,
  tag: TiledObjectTag,
): readonly PlacedTiledObject[] {
  return byTag.get(tag) ?? [];
}

interface TiledPropertyJson {
  name: string;
  type?: string;
  value: unknown;
}

interface TiledObjectJson {
  id: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  name?: string;
  visible?: boolean;
  point?: boolean;
  type?: string;
  properties?: TiledPropertyJson[];
}

interface TiledJson {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: {
    type?: string;
    name?: string;
    width?: number;
    height?: number;
    data?: number[];
    objects?: TiledObjectJson[];
    visible?: boolean;
    x?: number;
    y?: number;
  }[];
}

function objectGameTag(obj: TiledObjectJson): TiledObjectTag | undefined {
  const fromType = (obj.type ?? '').trim();
  if (fromType && TAGGED_TYPES.has(fromType)) return fromType as TiledObjectTag;
  const tagProp = obj.properties?.find((p) => p.name === 'tag');
  const v = tagProp?.value;
  if (typeof v === 'string' && TAGGED_TYPES.has(v)) return v as TiledObjectTag;
  return undefined;
}

function collectObjectGroupLayer(
  layer: TiledJson['layers'][number],
  debugRoot: Container,
  objectsByTag: Map<TiledObjectTag, PlacedTiledObject[]>,
): void {
  if (layer.type !== 'objectgroup') return;
  const layerRoot = new Container();
  layerRoot.label = layer.name ?? '';
  const layerX = layer.x ?? 0;
  const layerY = layer.y ?? 0;

  for (const obj of layer.objects ?? []) {
    if (obj.visible === false) continue;

    const x = layerX + obj.x;
    const y = layerY + obj.y;
    const w = obj.width ?? 0;
    const h = obj.height ?? 0;
    const isPoint = obj.point === true || (w === 0 && h === 0);

    const tag = objectGameTag(obj);
    if (tag) {
      const list = objectsByTag.get(tag) ?? [];
      list.push({
        tag,
        id: obj.id,
        name: obj.name ?? '',
        x,
        y,
        width: w,
        height: h,
      });
      objectsByTag.set(tag, list);
      continue;
    }

    const g = new Graphics();
    g.label = obj.name ? `${obj.name}#${obj.id}` : `obj#${obj.id}`;

    if (isPoint) {
      g.circle(0, 0, 8).fill({ color: 0xffdd44, alpha: 1 }).stroke({ width: 2, color: 0x333333, alpha: 1 });
    } else {
      g.rect(0, 0, w, h).fill({ color: 0x4488ff, alpha: 0.28 }).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    }
    g.position.set(x, y);
    layerRoot.addChild(g);
  }

  if (layerRoot.children.length > 0) {
    debugRoot.addChild(layerRoot);
  }
}

export interface TiledMapLayout {
  mapWidthPx: number;
  mapHeightPx: number;
  debugRoot: Container;
  objectsByTag: ReadonlyMap<TiledObjectTag, readonly PlacedTiledObject[]>;
}

export async function loadTiledMapLayout(mapAlias: string): Promise<TiledMapLayout> {
  const map = (await Assets.load(mapAlias)) as TiledJson;
  const objectsByTag = new Map<TiledObjectTag, PlacedTiledObject[]>();
  const debugRoot = new Container();
  debugRoot.label = 'tiled_debug_objects';

  for (const layer of map.layers) {
    if (layer.visible === false) continue;
    if (layer.type === 'objectgroup') {
      collectObjectGroupLayer(layer, debugRoot, objectsByTag);
    }
  }

  const frozen = new Map<TiledObjectTag, readonly PlacedTiledObject[]>();
  for (const [k, v] of objectsByTag) {
    frozen.set(k, v);
  }

  return {
    mapWidthPx: map.width * map.tilewidth,
    mapHeightPx: map.height * map.tileheight,
    debugRoot,
    objectsByTag: frozen,
  };
}
