import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

interface TiledJson {
  tilewidth: number;
  tileheight: number;
  layers: {
    type?: string;
    name?: string;
    width: number;
    height: number;
    data: number[];
    visible?: boolean;
  }[];
  tilesets: {
    firstgid: number;
    image: string;
    tilewidth: number;
    tileheight: number;
    tilecount: number;
    columns: number;
    margin?: number;
    spacing?: number;
  }[];
}

function tileFrame(base: Texture, ts: TiledJson['tilesets'][number], localId: number): Texture {
  const tw = ts.tilewidth;
  const th = ts.tileheight;
  const m = ts.margin ?? 0;
  const sp = ts.spacing ?? 0;
  const col = localId % ts.columns;
  const row = (localId / ts.columns) | 0;
  return new Texture({
    source: base.source,
    frame: new Rectangle(m + col * (tw + sp), m + row * (th + sp), tw, th),
  });
}

export async function loadTiledTileLayers(mapAlias: string, imageToAsset: Record<string, string>): Promise<Container> {
  const map = (await Assets.load(mapAlias)) as TiledJson;
  const tilesets = [...map.tilesets].sort((a, b) => a.firstgid - b.firstgid);

  const byImage = new Map<string, Texture>();
  for (const ts of tilesets) {
    const name = ts.image.includes('/') ? ts.image.split('/').pop()! : ts.image;
    const alias = imageToAsset[name];
    if (!alias) throw new Error(`tiledMap: нет алиаса для ${name}`);
    byImage.set(ts.image, Assets.get<Texture>(alias));
  }

  const root = new Container();
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer' || layer.visible === false) continue;

    const layerRoot = new Container();
    layerRoot.label = layer.name ?? '';
    const { width: w, data } = layer;

    for (let i = 0; i < data.length; i++) {
      const gid = data[i]! & 0x1fffffff;
      if (gid === 0) continue;

      let ts: TiledJson['tilesets'][number] | undefined;
      for (const t of tilesets) {
        if (t.firstgid <= gid) ts = t;
      }
      if (!ts) continue;
      const local = gid - ts.firstgid;
      if (local < 0 || local >= ts.tilecount) continue;

      const base = byImage.get(ts.image);
      if (!base) continue;

      const s = new Sprite(tileFrame(base, ts, local));
      s.x = (i % w) * map.tilewidth;
      s.y = ((i / w) | 0) * map.tileheight;
      layerRoot.addChild(s);
    }
    root.addChild(layerRoot);
  }

  return root;
}
