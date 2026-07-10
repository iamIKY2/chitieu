const CACHE_NAME = 'spend-manager-cache-v1.0.4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './demo.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './css/demo-mobile.css',
  './js/config.js',
  './js/api.js',
  './js/charts.js',
  './js/ui.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
];

// Event: Install (Nạp tài nguyên vào bộ nhớ đệm Cache Storage)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching all static app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Event: Activate (Xóa bỏ cache cũ khi cập nhật phiên bản mới)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Event: Fetch (Lắng nghe các request tải tài nguyên - Ưu tiên load từ Cache, fallback lên mạng)
self.addEventListener('fetch', (event) => {
  // Bỏ qua các API bên ngoài của Google Sheets (để luôn đồng bộ trực tiếp)
  if (event.request.url.includes('script.google.com') || event.request.url.includes('action=')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Nếu tài nguyên chưa lưu trong cache, tải từ mạng
        return fetch(event.request).then((networkResponse) => {
          // Chỉ lưu cache những request thành công
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Nhân bản response để lưu vào cache
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // Trả về trang offline mặc định nếu không có mạng (ở đây là index.html hoặc demo.html)
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
