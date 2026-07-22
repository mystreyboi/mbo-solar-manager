const CACHE_NAME = 'mbo-solar-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install the service worker and cache the app files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching required assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Serve cached files to allow the app to work offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Return the cached version if it exists, otherwise fetch from the network
      return response || fetch(event.request);
    })
  );
});

// Activate and clean up old caches if you ever update the CACHE_NAME version
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});
