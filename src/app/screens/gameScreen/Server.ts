import { decodeInkLayer } from './drawing/drawingEncoder';
import { type GuessTarget, type SkinSet } from './types';
import type {
  GetRandomPortraitResponse,
  GuessRequest,
  PartIds,
  RegisterRequest,
  RegisterResponse,
  SubmitPortraitRequest,
} from '@/shared/serverTypes';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Клиент-серверное взаимодействие.
 */
export class Server {
  private bakedPhotofits: GuessTarget[] = [];
  private readonly timeoutMs = 3000; // сколько максимум ждём ответа
  private serverDisabled = false;

  public setBakedPhotofits(baked: GuessTarget[]): void {
    this.bakedPhotofits = baked;
  }

  public checkAuth(): boolean {
    return !!(localStorage.getItem('playerId') && localStorage.getItem('token'));
  }

  public async register(name: string): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name } as RegisterRequest),
      });

      if (!res.ok) {
        console.warn('Registration failed:', res.statusText);
        this.serverDisabled = true;
        return false;
      }

      const data: RegisterResponse = await res.json();
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('token', data.token);
      return true;
    } catch (e) {
      console.warn('Registration failed with error:', e);
      this.serverDisabled = true;
      return false;
    }
  }

  public async submitPhotofit(imageBase64: string, skins: SkinSet): Promise<void> {
    if (this.serverDisabled) return;

    const creds = this.getCreds();
    if (!creds) return;

    try {
      const res = await this.fetchWithTimeout(`${API_URL}/portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creds,
          imageBase64,
          partIds: this.skinSetToPartIds(skins),
        } as SubmitPortraitRequest),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Portrait submitted successfully:', data);
      } else {
        console.warn('Submit portrait failed:', res.statusText);
      }
    } catch (e) {
      console.warn('Submit portrait failed with error:', e);
    }
  }

  public async fetchPhotofitToGuess(): Promise<GuessTarget> {
    if (this.serverDisabled) {
      return this.getRandomBaked();
    }

    const creds = this.getCreds();
    if (!creds) return this.getRandomBaked();

    try {
      const url = new URL(`${API_URL}/portrait/random`, API_URL);
      url.searchParams.set('playerId', creds.playerId);
      url.searchParams.set('token', creds.token);

      const res = await this.fetchWithTimeout(url.toString());
      if (!res.ok) {
        console.warn('Fetch random portrait failed:', res.statusText);
        return this.getRandomBaked();
      }

      const data: GetRandomPortraitResponse | { portraitId: null } = await res.json();
      if (!data.portraitId) {
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
    } catch (e) {
      console.warn('Fetch random portrait failed with error:', e);
      return this.getRandomBaked();
    }
  }

  public async reportGuess(portraitId: string, correct: boolean): Promise<void> {
    if (this.serverDisabled) return;

    const creds = this.getCreds();
    if (!creds) return;

    try {
      const res = await this.fetchWithTimeout(`${API_URL}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creds,
          portraitId,
          correct,
        } as GuessRequest),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Guess reported successfully:', data);
      } else {
        console.warn('Report guess failed:', res.statusText);
      }
    } catch (e) {
      console.warn('Report guess failed with error:', e);
    }
  }

  public async pollMyPhotofitGuessed(): Promise<string | null> {
    // Не было явно запрошено в основном флоу, но оставляем как в примере
    return null;
  }

  private getCreds() {
    const playerId = localStorage.getItem('playerId');
    const token = localStorage.getItem('token');
    return playerId && token ? { playerId, token } : null;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(id);
    }
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
