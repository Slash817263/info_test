const CACHE_NAME = 'acade-quiz-v14';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/dom.js',
  '/assets/js/math.js',
  '/assets/js/practice.js',
  '/assets/js/quiz.js',
  '/assets/js/state.js',
  '/assets/js/ui.js',
  '/assets/js/utils.js',
  '/assets/vendor/katex/katex.min.css?v=1',
  '/assets/vendor/katex/katex.min.js?v=1',
  '/assets/vendor/katex/contrib/auto-render.min.js?v=1',
  '/politica-de-confidentialitate.html',
  '/SIGLA2.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('Cache error for:', url, err)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Network-First strategy: always loads the freshest code, falls back to cache offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  if (event.request.url.includes('/.netlify/functions/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
