import { engine } from '@/app/getEngine';
import { decodeInkLayer } from './drawing/drawingEncoder';
import { type GuessTarget, type SkinSet } from './types';
import type { PartIds } from '@/shared/serverTypes';

/**
 * Game-specific adapter for the global engine server client.
 * Handles data mapping (SkinSet <-> PartIds) and fallbacks.
 */
export class Server {
  private bakedPhotofits: GuessTarget[] = [];

  public setBakedPhotofits(baked: GuessTarget[]): void {
    this.bakedPhotofits = baked;
  }

  public checkAuth(): boolean {
    return engine().server.checkAuth();
  }

  public async register(name: string): Promise<boolean> {
    const res = await engine().server.register(name);
    return !!res;
  }

  public async submitPhotofit(imageBase64: string, skins: SkinSet): Promise<void> {
    await engine().server.submitPortrait({
      imageBase64,
      partIds: this.skinSetToPartIds(skins),
    });
  }

  public async fetchPhotofitToGuess(): Promise<GuessTarget> {
    const data = await engine().server.getRandomPortrait();

    if (!data) {
      return this.getRandomBaked();
    }

    // Convert server data to game GuessTarget
    const canvas = await decodeInkLayer(data.imageBase64);
    return {
      portraitId: data.portraitId,
      authorNickname: data.authorName,
      canvasData: canvas,
      originalSkins: this.partIdsToSkinSet(data.partIds),
    };
  }

  public async reportGuess(portraitId: string, correct: boolean): Promise<void> {
    await engine().server.submitGuess({
      portraitId,
      correct,
    });
  }

  public async pollMyPhotofitGuessed(): Promise<string | null> {
    return engine().server.pollMyPhotofitGuessed();
  }

  private getRandomBaked(): GuessTarget {
    if (this.bakedPhotofits.length === 0) {
      throw new Error('No baked photofits provided');
    }
    return this.bakedPhotofits[Math.floor(Math.random() * this.bakedPhotofits.length)];
  }

  private skinSetToPartIds(skins: SkinSet): PartIds {
    return {
      head: skins.face,
      body: skins.clothes,
      eye: skins.eyes,
      nose: skins.nose,
      mouth: skins.mouth,
      ear: 1,
      brow: 1,
    };
  }

  private partIdsToSkinSet(partIds: PartIds): SkinSet {
    return {
      face: partIds.head,
      clothes: partIds.body,
      eyes: partIds.eye,
      nose: partIds.nose,
      mouth: partIds.mouth,
    };
  }
}
