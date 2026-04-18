// src/engine/interaction/VirtualInteraction.ts
import { type Application, type FederatedPointerEvent } from 'pixi.js';

/**
 * Sets up event handling for the virtual screen in Pixi.js 8
 * @param app Application instance
 */
export function setupVirtualInteraction(app: Application): void {
  // Список типов событий, которые мы хотим модифицировать
  const eventTypes = [
    // Pointer события
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointerupoutside',
    'pointertap',
    'pointerover',
    'pointerout',
    // Mouse события
    'mousedown',
    'mousemove',
    'mouseup',
    'mouseupoutside',
    'click',
    // Touch события
    'touchstart',
    'touchmove',
    'touchend',
    'touchendoutside',
    'tap',
  ];

  // Глобальные события
  const globalEventTypes = ['globalpointermove', 'globalmousemove', 'globaltouchmove'];

  // Применяем обработчик на stage для всех обычных событий
  eventTypes.forEach((eventType) => {
    // Устанавливаем перехватчик на самом верхнем уровне - на стадии захвата (capture phase)
    app.stage.on(
      eventType,
      (event: FederatedPointerEvent) => {
        // Сохраняем оригинальную позицию для отладки, если нужно
        const originalX = event.global.x;
        const originalY = event.global.y;

        // Проверяем, находится ли точка в пределах виртуального экрана
        if (app.virtualScreen.isInVirtualScreen(originalX, originalY)) {
          // Трансформируем координаты события
          const virtualCoords = app.virtualScreen.toVirtualCoordinates(originalX, originalY);

          // Устанавливаем новые координаты
          event.global.x = virtualCoords.x;
          event.global.y = virtualCoords.y;
        }

        // Не останавливаем распространение события,
        // позволяем ему продолжить нормальный путь
      },
      true,
    ); // true означает, что мы хотим обрабатывать событие на этапе захвата
  });

  // Применяем тот же подход для глобальных событий
  globalEventTypes.forEach((eventType) => {
    app.stage.on(eventType, (event: FederatedPointerEvent) => {
      if (app.virtualScreen.isInVirtualScreen(event.global.x, event.global.y)) {
        const virtualCoords = app.virtualScreen.toVirtualCoordinates(event.global.x, event.global.y);
        event.global.x = virtualCoords.x;
        event.global.y = virtualCoords.y;
      }
    });
  });

  // Когда происходит изменение размера окна, обновляем все взаимодействие
  app.renderer.on('resize', () => {
    // Никаких дополнительных действий не требуется при ресайзе
    // Так как мы обрабатываем координаты динамически
  });
}
