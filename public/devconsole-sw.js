const DB_NAME = 'ludum-dare-devconsole';
const DB_VERSION = 1;

let dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

async function getReplacement(url) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction('replacements', 'readonly');
            const store = tx.objectStore('replacements');
            const req = store.get(url);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

function normalizeUrl(inputUrl) {
    try {
        const parsed = new URL(inputUrl, self.location.origin);
        return parsed.pathname;
    } catch (e) {
        return inputUrl;
    }
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const urlStr = event.request.url;
    const normalized = normalizeUrl(urlStr);

    // Ignore non-get, internal vite, etc.
    if (
        event.request.method !== 'GET' || 
        normalized.includes('@vite') || 
        normalized.includes('.ts') || 
        normalized.includes('node_modules') ||
        normalized.includes('devconsole-sw.js')
    ) {
        return;
    }

    // Send message to all clients to record the request
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'REQUESTED_URL', url: normalized });
        });
    });

    event.respondWith((async () => {
        const replacement = await getReplacement(normalized);
        if (replacement) {
            console.log(`[DevConsole SW] Intercepted fetch for: ${normalized} (Replaced)`);
            return new Response(replacement.file);
        }
        return fetch(event.request);
    })());
});