import type { GameState } from './types';

export const HINTS_TEXTS: Record<GameState, string> = {
  GAME_RESET: '------',
  readyToStartDay: 'GET READY',
  waitingForVisitor: 'STAND BY',
  alarmOn: 'SIGNAL DETECTED',
  visitorOnCamera: 'CHECK THE CAMERA',
  readyToDraw: 'CREATE SKETCH',
  readyToAccept: 'CONFIRM WHEN READY',
  decideWhatNext: 'CONFIRM WHEN READY',
  outOfPaper: 'OUT OF PAPER. REQUEST MORE',
  waitForServerResponse: 'WAITING FOR SERVER RESPONSE',
  showPhotophil: 'RECEIVING DATA',
  guessing: 'IDENTIFY PERSON ON TOP MONITORS',
  showGuessingResult: 'RESULT: %RESULT%',
  dayEnded: 'TIME IS UP',
  gameOver: '!!! SIGNAL LOST !!!',
  wellDone: 'WELL DONE',
};
