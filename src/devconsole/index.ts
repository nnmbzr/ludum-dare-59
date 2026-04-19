/* eslint-disable @typescript-eslint/no-explicit-any */
const DB_NAME = 'ludum-dare-devconsole';
const DB_VERSION = 1;

interface Replacement {
  file: Blob;
  name: string;
}

let db: IDBDatabase;
const requestedUrls = new Set<string>();
let replacements: Record<string, Replacement> = {};

async function initDB() {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('replacements')) {
        req.result.createObjectStore('replacements');
      }
    };
    req.onsuccess = () => {
      db = req.result;
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function loadReplacements() {
  return new Promise<void>((resolve) => {
    const tx = db.transaction('replacements', 'readonly');
    const store = tx.objectStore('replacements');
    const req = store.getAll();
    const keysReq = store.getAllKeys();
    tx.oncomplete = () => {
      const keys = keysReq.result as string[];
      const values = req.result as Replacement[];
      keys.forEach((key, i) => {
        replacements[key] = values[i];
      });
      resolve();
    };
  });
}

async function saveReplacement(url: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('replacements', 'readwrite');
    tx.objectStore('replacements').put({ file, name: file.name }, url);
    tx.oncomplete = () => {
      replacements[url] = { file, name: file.name };
      renderUI();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function removeReplacement(url: string) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('replacements', 'readwrite');
    tx.objectStore('replacements').delete(url);
    tx.oncomplete = () => {
      delete replacements[url];
      renderUI();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAll() {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('replacements', 'readwrite');
    tx.objectStore('replacements').clear();
    tx.oncomplete = () => {
      replacements = {};
      renderUI();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

(window as any).USED_DEV_CONSOLE = true;

(window as any).UNREGISTER_DEV_CONSOLE_SW = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.active && registration.active.scriptURL.includes('devconsole-sw.js')) {
        await registration.unregister();
        console.log('[DevConsole] Service Worker unregistered.');
      }
    }
  }
};

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const reg = await navigator.serviceWorker.register('/devconsole-sw.js');

      // Listen for messages from SW to track requested URLs
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'REQUESTED_URL') {
          requestedUrls.add(event.data.url);
          scheduleRender();
        }
      });

      // Wait until the SW is ready to intercept requests
      await navigator.serviceWorker.ready;
      console.log('[DevConsole] Service Worker registered and ready');
    } catch (e) {
      console.error('[DevConsole] SW registration failed:', e);
    }
  } else {
    console.warn('[DevConsole] Service Worker not supported in this browser.');
  }
}

// UI Rendering

let isPanelOpen = false;
let renderTimeout: any;

function scheduleRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(renderUI, 500);
}

function renderUI() {
  const btn = document.getElementById('devconsole-toggle-btn');
  const panel = document.getElementById('devconsole-panel');
  if (!btn || !panel) return;

  const hasReplacements = Object.keys(replacements).length > 0;

  // Update button
  btn.style.display = 'block';
  if (hasReplacements) {
    btn.style.background = '#d32f2f';
    btn.innerText = "ANN'SOLE (Replacing)";
  } else {
    btn.style.background = '#333';
    btn.innerText = "ANN'SOLE";
  }

  // Update panel visibility
  panel.style.display = isPanelOpen ? 'flex' : 'none';
  if (!isPanelOpen) return;

  const urls = Array.from(requestedUrls).sort();

  panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
            <h3 style="margin:0;">Asset Replacer</h3>
            <button id="devconsole-clear" style="padding:4px 8px; cursor:pointer; background:#555; color:white; border:none; border-radius:4px;">Reset All</button>
        </div>
        
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #aaa;">Active Replacements</div>
        <div id="devconsole-active-list" style="margin-bottom: 20px;"></div>

        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #aaa;">Loaded Resources</div>
        <div id="devconsole-requested-list"></div>
    `;

  // Bind Clear All
  document.getElementById('devconsole-clear')!.onclick = async () => {
    if (confirm('Clear all replacements and reload?')) {
      await clearAll();
      window.location.reload();
    }
  };

  // Render Active
  const activeList = document.getElementById('devconsole-active-list')!;
  if (Object.keys(replacements).length === 0) {
    activeList.innerHTML = '<div style="color:#777; font-size:12px;">No active replacements.</div>';
  } else {
    Object.entries(replacements).forEach(([url, data]) => {
      const div = document.createElement('div');
      div.style.cssText =
        'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #444;';
      div.innerHTML = `
                <div style="flex:1; overflow:hidden;">
                    <div style="font-size:12px;color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${url}">${url}</div>
                    <div style="color:#4caf50; font-size:12px;">→ ${data.name}</div>
                </div>
                <button data-url="${url}" class="remove-btn" style="margin-left:10px; cursor:pointer; background:#555; color:white; border:none; border-radius:4px; padding:2px 6px;">Remove</button>
            `;
      activeList.appendChild(div);
    });
  }

  // Render Requested
  const requestedList = document.getElementById('devconsole-requested-list')!;
  let requestedHtml = '';
  urls.forEach((url) => {
    if (replacements[url]) return; // Skip already replaced
    requestedHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #444;">
                <div style="flex:1; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${url}">${url}</div>
                <label style="cursor:pointer; background:#ddd; color:black; padding:2px 6px; border-radius:3px; font-size:12px; margin-left:10px; white-space:nowrap;">
                    Replace
                    <input type="file" style="display:none;" class="replace-file" data-url="${url}">
                </label>
            </div>
        `;
  });

  if (!requestedHtml) {
    requestedList.innerHTML = '<div style="color:#777; font-size:12px;">No resources loaded yet.</div>';
  } else {
    requestedList.innerHTML = requestedHtml;
  }

  // Event Listeners
  panel.querySelectorAll('.remove-btn').forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async (e) => {
      const url = (e.currentTarget as HTMLButtonElement).getAttribute('data-url')!;
      await removeReplacement(url);
      window.location.reload();
    };
  });

  panel.querySelectorAll('.replace-file').forEach((input) => {
    (input as HTMLInputElement).onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      const url = (e.target as HTMLInputElement).getAttribute('data-url')!;
      if (file) {
        await saveReplacement(url, file);
        window.location.reload();
      }
    };
  });
}

// Init Function
async function start() {
  await initDB();
  await loadReplacements();
  await registerSW();

  // Bind toggle button
  const btn = document.getElementById('devconsole-toggle-btn');
  if (btn) {
    btn.onclick = () => {
      isPanelOpen = !isPanelOpen;
      renderUI();
    };
  }

  renderUI();
}

// Auto-start
start().catch(console.error);
