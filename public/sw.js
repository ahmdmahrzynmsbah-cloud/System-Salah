const CACHE_NAME = 'autopos-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Intentionally minimal initial payload to avoid blocking install
      return cache.addAll([
        '/',
        '/index.html',
        '/icon.svg',
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle API requests or other non-cachable assets differently if needed
  
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Optionally cache the fresh network response here
      const clonedResponse = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        // Exclude some things like chrome-extension, or unsupported protocols
        if (event.request.url.startsWith('http')) {
          cache.put(event.request, clonedResponse);
        }
      });
      return networkResponse;
    }).catch(() => {
      // If network fails, try to return from cache
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache and network fails, return root index as fallback for SPA
        return caches.match('/');
      });
    })
  );
});
