/**
 * Shared API types. Copy this file to your frontend project
 * to get full type safety when calling the server.
 */

/** Character part IDs. Shape is flexible — you can add new fields like "beard" later. */
export type PartIds = Record<string, number>;

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
