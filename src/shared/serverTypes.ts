/**
 * Shared API types. Copy this file to your frontend project
 * to get full type safety when calling the server.
 */

/** Character part IDs. */
export interface PartIds {
  head: number;
  body: number;
  nose: number;
  ear: number;
  mouth: number;
  brow: number;
  eye: number;
  hat?: number;
  accessories?: number;
  hair?: number;
  beard?: number;
  scar?: number;
}

// ===== POST /register =====

export interface RegisterRequest {
  name: string;
}

export interface RegisterResponse {
  playerId: string;
  token: string;
}

// ===== POST /portrait =====

export interface SubmitPortraitRequest {
  playerId: string;
  token: string;
  imageBase64: string;
  partIds: PartIds;
}

export interface SubmitPortraitResponse {
  portraitId: string;
}

// ===== GET /portrait/random =====
// Query: ?playerId=xxx&token=xxx

export interface GetRandomPortraitResponse {
  portraitId: string;
  authorId: string;
  authorName: string;
  imageBase64: string;
  partIds: PartIds;
}

export interface NoPortraitsAvailableResponse {
  portraitId: null;
}

// ===== POST /guess =====

export interface GuessRequest {
  playerId: string;
  token: string;
  portraitId: string;
  correct: boolean;
}

export interface GuessResponse {
  ok: true;
  authorGuessedCount: number;
}

// ===== Errors =====

export interface ErrorResponse {
  error: string;
}
