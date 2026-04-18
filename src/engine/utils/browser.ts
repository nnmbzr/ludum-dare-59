interface FullscreenElement extends HTMLElement {
  mozRequestFullScreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface FullscreenDocument extends Document {
  mozCancelFullScreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
}

/**
 * Отключает обработчик правого клика мыши на странице
 */
export function disableRightClick() {
  window.addEventListener(`contextmenu`, (e) => e.preventDefault());
}

let isFullScreen = false;

/**
 * Переключает полноэкранный режим
 * @returns {boolean} Текущее состояние полноэкранного режима после переключения
 */
export function toggleFullscreen(): boolean {
  const element = document.documentElement as FullscreenElement;
  const doc = document as FullscreenDocument;

  if (!isFullScreen) {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen(); // Firefox
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen(); // Chrome, Safari
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen(); // IE/Edge
    }
  } else {
    if (doc.exitFullscreen) {
      doc.exitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  }

  return isFullScreen;
}

/**
 * Возвращает текущий статус полноэкранного режима
 */
export function getFullscreenStatus(): boolean {
  return isFullScreen;
}

export function initFullscreenListener(): void {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

function handleFullscreenChange(): void {
  const doc = document as FullscreenDocument;
  isFullScreen = Boolean(
    doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement,
  );
}
