// vite.config.mts
import { join, relative } from 'node:path';

import { AssetPack, type AssetPackConfig } from '@nnmbzr/assetpack-core';
import { pixiPipes } from '@nnmbzr/assetpack-core/pixi';
import type { Plugin, ResolvedConfig } from 'vite';

export function assetpackPlugin(): Plugin {
  let mode: ResolvedConfig['command'];
  let ap: AssetPack | undefined;
  const apConfig: AssetPackConfig = {
    entry: './assets',
    pipes: [
      ...pixiPipes({
        cacheBust: true,
        resolutions: { default: 1 },
        manifest: { includeMetaData: true, createShortcuts: true, trimExtensions: true },
        audio: {
          outputs: [
            {
              formats: ['.mp3'],
              recompress: true,
              options: {},
            },
          ],
        },
        texturePacker: {
          texturePacker: {
            padding: 5,
            removeFileExtension: true,
            nameStyle: 'short',
          },
        },
        // ...
      }),
    ],
  } as AssetPackConfig;

  return {
    name: 'vite-plugin-assetpack',
    configResolved(resolvedConfig) {
      mode = resolvedConfig.command;
      if (!resolvedConfig.publicDir) return;
      if (apConfig.output) return;

      const relativePath = relative(process.cwd(), resolvedConfig.publicDir);
      apConfig.output = join(relativePath, 'assets');
    },
    buildStart: async () => {
      if (mode === 'serve') {
        if (ap) return;
        ap = new AssetPack(apConfig);
        await ap.watch();
      } else {
        await new AssetPack(apConfig).run();
      }
    },
    buildEnd: async () => {
      if (ap) {
        await ap.stop();
        ap = undefined;
      }
    },
  };
}
