import type { GameState } from './types';

export const HINTS_TEXTS: Record<GameState, string> = {
  GAME_RESET: '------', // этот стейт просто технический, не меняем текст
  readyToStartDay: 'ПРИГОТОВЬТЕСЬ',
  waitingForVisitor: 'ОЖИДАЙТЕ',
  alarmOn: 'ПОЯВИЛСЯ СИГНАЛ',
  visitorOnCamera: 'СМОТРИ НА КАМЕРУ',
  readyToDraw: 'СОСТАВЬ ФОТОРОБОТ',
  readyToAccept: 'ПОДТВЕРДИ ПО ГОТОВНОСТИ',
  decideWhatNext: 'ПОДТВЕРДИ ПО ГОТОВНОСТИ', // этот стейт просто технический, не меняем текст
  outOfPaper: 'БУМАГА ЗАКОНЧИЛАСЬ. ЗАПРОСИ НОВУЮ',
  waitForServerResponse: 'ЖДЁМ ОТВЕТА ОТ СЕРВЕРА',
  showPhotophil: 'ПРИЁМ ДАННЫХ', // показываем пока ждём ответа от сервера
  guessing: 'ОПОЗНАЙ ЛИЧНОСТЬ НА ВЕРХНИХ МОНИТОРАХ',
  showGuessingResult: 'РЕЗУЛЬТАТ: %RESULT%', // можно будет просто заменить поиском по строке.
  dayEnded: 'ВРЕМЯ ВЫШЛО', // можно будет просто заменить поиском по строке.
  gameOver: '!!! СИГНАЛ ПОТЕРЯН !!!',
  wellDone: 'ХОРОШАЯ РАБОТА',
};
