/* // api.ts на клиенте
import type {
  GetRandomPortraitResponse,
  GuessResponse,
  PartIds,
  RegisterResponse,
  SubmitPortraitResponse,
} from './shared/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Креды в localStorage
function getCreds() {
  const playerId = localStorage.getItem('playerId');
  const token = localStorage.getItem('token');
  return playerId && token ? { playerId, token } : null;
}

export async function register(name: string): Promise<RegisterResponse> {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('register failed');
  const data: RegisterResponse = await res.json();
  localStorage.setItem('playerId', data.playerId);
  localStorage.setItem('token', data.token);
  return data;
}

export async function submitPortrait(imageBase64: string, partIds: PartIds) {
  const creds = getCreds();
  if (!creds) throw new Error('not registered');
  const res = await fetch(`${API_URL}/portrait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, imageBase64, partIds }),
  });
  if (!res.ok) throw new Error('submit failed');
  return res.json() as Promise<SubmitPortraitResponse>;
}

export async function getRandomPortrait() {
  const creds = getCreds();
  if (!creds) throw new Error('not registered');
  const url = new URL(`${API_URL}/portrait/random`);
  url.searchParams.set('playerId', creds.playerId);
  url.searchParams.set('token', creds.token);
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<GetRandomPortraitResponse | { portraitId: null }>;
}

export async function submitGuess(portraitId: string, correct: boolean) {
  const creds = getCreds();
  if (!creds) throw new Error('not registered');
  const res = await fetch(`${API_URL}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, portraitId, correct }),
  });
  if (!res.ok) throw new Error('guess failed');
  return res.json() as Promise<GuessResponse>;
}
 */
