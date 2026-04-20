import type { ValuesOf } from '@/app/utils/typesHelper';

export type PatternId = 'eyes' | 'nose' | 'mouth' | 'face' | 'clothes';
export type SkinId = number;

export interface SkinSet {
  eyes: SkinId;
  nose: SkinId;
  mouth: SkinId;
  face: SkinId;
  clothes: SkinId;
}

export interface VisitorData {
  id: string;
  skins: SkinSet;
  idleAnimation: string;
  staySec: number;
}

/** То, что прилетело с сервера для угадывания */
export interface GuessTarget {
  portraitId: string;
  authorNickname: string;
  canvasData: HTMLCanvasElement; // готовая картинка, не пересобираем
  originalSkins: SkinSet; // правильный ответ
}

/** Макро-состояние экрана. Управляет флоу дня. */
export const GameStates = {
  GAME_RESET: 'GAME_RESET', // ждём следующего посетителя
  readyToStartDay: 'readyToStartDay', // ждём следующего посетителя
  waitingForVisitor: 'waitingForVisitor', // ждём следующего посетителя
  alarmOn: 'alarmOn', // лампочка горит, ждём клик по кнопке камеры
  visitorOnCamera: 'visitorOnCamera', // отображаем посетителя на камере.
  readyToDraw: 'readyToDraw', // Пользователь получает возможность рисовать. Ждём когда пользователь как-то минимально провзаимодействует с планшетом для рисования.
  readyToAccept: 'readyToAccept', // Ждём когда пользователь подтвердит, что фоторобот готов.
  decideWhatNext: 'decideWhatNext', // решаем что делать дальше - перейти на waitingForVisitor или на outOfPaper
  outOfPaper: 'outOfPaper', // бумага закончилась, ждём клика по факсу
  waitForServerResponse: 'waitForServerResponse', // ждём ответа от сервера
  showPhotophil: 'showPhotophil', // показываем фоторобот
  guessing: 'guessing', // пользователь угадывает
  showGuessingResult: 'showGuessingResult', // показываем результат угадывания
  dayEnded: 'dayEnded', // можем перейти в это состояние ИЗ ЛЮБОГО СТЕЙТА! Так как игра на время.
  gameOver: 'gameOver', // не выполнили норму, проиграли
  wellDone: 'wellDone', // выполнили норму, следующий день.
} as const;

export type GameState = ValuesOf<typeof GameStates>;
