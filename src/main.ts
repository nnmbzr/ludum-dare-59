import { initDevtools } from '@pixi/devtools';
import '@pixi/sound';
import gsap from 'gsap';
import PixiPlugin from 'gsap/PixiPlugin';
import * as PIXI from 'pixi.js';
import { setEngine } from './app/getEngine';
import { GameScreen } from './app/screens/gameScreen/GameScreen';
import { LoadScreen } from './app/screens/LoadScreen';
import { userSettings } from './app/utils/userSettings';
import { DEBUG_START_SCREEN, getAppScreenByName } from './dev';
import { CreationEngine } from './engine/engine';
import { disableRightClick, initFullscreenListener } from './engine/utils/browser';

export const SCREEN_WIDTH = 1920;
export const SCREEN_HEIGHT = 1080;
export const MAX_DT = 0.032; // 30 fps cap

(async () => {
  // Create a new creation engine instance
  const engine = new CreationEngine();
  setEngine(engine);

  gsap.registerPlugin(PixiPlugin);
  PixiPlugin.registerPIXI(PIXI);

  // Initialize the creation engine instance
  await engine.init({
    background: '#1E1E1E',
    resizeOptions: {
      virtualWidth: SCREEN_WIDTH, // Фиксированное виртуальное разрешение по ширине
      virtualHeight: SCREEN_HEIGHT, // Фиксированное виртуальное разрешение по высоте
      letterbox: true, // Включаем режим letterbox
      letterboxColor: 0x000000, // Цвет заглушек по бокам (совпадает с фоном)
    },
    eventMode: 'passive',
    eventFeatures: {
      move: true,
      globalMove: false,
      click: true,
      wheel: false,
    },
  });

  // Setup tickers
  engine.ticker.stop();
  const gsapTickerCallback: GSAPCallback = () => {
    engine.ticker.update(gsap.globalTimeline.time());
  };
  gsap.ticker.add(gsapTickerCallback);

  // Initialize the user settings
  userSettings.init();
  disableRightClick();
  initFullscreenListener();

  initDevtools({ stage: engine.stage, renderer: engine.renderer });

  // Show the load screen first and then start game
  await engine.navigation.showScreen(LoadScreen);

  if (DEBUG_START_SCREEN) {
    await engine.navigation.showScreen(getAppScreenByName(DEBUG_START_SCREEN));
  } else {
    await engine.navigation.showScreen(GameScreen);
  }
})();
