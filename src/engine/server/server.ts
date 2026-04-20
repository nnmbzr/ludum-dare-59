import type {
  GetRandomPortraitResponse,
  GuessRequest,
  GuessResponse,
  RegisterRequest,
  RegisterResponse,
  SubmitPortraitRequest,
  SubmitPortraitResponse,
} from '@/shared/serverTypes';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Low-level API client for server communication.
 * Lives in the engine and handles raw data and authentication.
 */
export class ServerClient {
  private readonly timeoutMs = 3000;
  public serverDisabled = false;

  public checkAuth(): boolean {
    return !!(localStorage.getItem('playerId') && localStorage.getItem('token'));
  }

  public getCreds() {
    const playerId = localStorage.getItem('playerId');
    const token = localStorage.getItem('token');
    return playerId && token ? { playerId, token } : null;
  }

  public async register(name: string): Promise<RegisterResponse | null> {
    try {
      const res = await this.fetchWithTimeout(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name } as RegisterRequest),
      });

      if (!res.ok) {
        console.warn('Registration failed:', res.statusText);
        this.serverDisabled = true;
        return null;
      }

      const data: RegisterResponse = await res.json();
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('token', data.token);
      return data;
    } catch (e) {
      console.warn('Registration failed with error:', e);
      this.serverDisabled = true;
      return null;
    }
  }

  public async submitPortrait(request: Omit<SubmitPortraitRequest, 'playerId' | 'token'>): Promise<SubmitPortraitResponse | null> {
    if (this.serverDisabled) return null;

    const creds = this.getCreds();
    if (!creds) return null;

    try {
      const res = await this.fetchWithTimeout(`${API_URL}/portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creds,
          ...request,
        } as SubmitPortraitRequest),
      });

      if (res.ok) {
        return await res.json();
      }
      console.warn('Submit portrait failed:', res.statusText);
      return null;
    } catch (e) {
      console.warn('Submit portrait failed with error:', e);
      return null;
    }
  }

  public async getRandomPortrait(): Promise<GetRandomPortraitResponse | null> {
    if (this.serverDisabled) return null;

    const creds = this.getCreds();
    if (!creds) return null;

    try {
      const url = new URL(`${API_URL}/portrait/random`, API_URL);
      url.searchParams.set('playerId', creds.playerId);
      url.searchParams.set('token', creds.token);

      const res = await this.fetchWithTimeout(url.toString());
      if (!res.ok) {
        console.warn('Fetch random portrait failed:', res.statusText);
        return null;
      }

      const data: GetRandomPortraitResponse | { portraitId: null } = await res.json();
      if (!data.portraitId) return null;

      return data as GetRandomPortraitResponse;
    } catch (e) {
      console.warn('Fetch random portrait failed with error:', e);
      return null;
    }
  }

  public async submitGuess(request: Omit<GuessRequest, 'playerId' | 'token'>): Promise<GuessResponse | null> {
    if (this.serverDisabled) return null;

    const creds = this.getCreds();
    if (!creds) return null;

    try {
      const res = await this.fetchWithTimeout(`${API_URL}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creds,
          ...request,
        } as GuessRequest),
      });

      if (res.ok) {
        return await res.json();
      }
      console.warn('Submit guess failed:', res.statusText);
      return null;
    } catch (e) {
      console.warn('Submit guess failed with error:', e);
      return null;
    }
  }

  public async pollMyPhotofitGuessed(): Promise<string | null> {
    // Return nickname of someone who guessed our portrait, or null
    return null;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }
}
