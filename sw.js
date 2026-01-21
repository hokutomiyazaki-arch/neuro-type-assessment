// Service Worker for 神経タイプ診断
const CACHE_NAME = 'neuro-type-diagnosis-v1.1.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './FNT512.png',
    './FNT512-transparent.png',
    './1.png',
    './2.png',
    './3.png',
    './4.png',
    './5.png',
    './6.png',
    './7.png',
    './8.png',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Outfit:wght@400;600;700&display=swap'
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Cache failed:', error);
            })
    );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete');
                return self.clients.claim();
            })
    );
});

// フェッチ時の処理（キャッシュファースト戦略）
self.addEventListener('fetch', (event) => {
    // 同一オリジンのリクエストのみ処理
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.startsWith('https://fonts.')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // キャッシュがある場合はキャッシュを返す
                    // バックグラウンドで更新を試みる
                    event.waitUntil(
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    const responseClone = networkResponse.clone();
                                    caches.open(CACHE_NAME)
                                        .then((cache) => {
                                            cache.put(event.request, responseClone);
                                        });
                                }
                            })
                            .catch(() => {
                                // ネットワークエラーは無視（オフラインの場合）
                            })
                    );
                    return cachedResponse;
                }

                // キャッシュがない場合はネットワークから取得
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseClone);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // オフラインでキャッシュもない場合
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

// プッシュ通知（将来の拡張用）
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || '新しいお知らせがあります',
            icon: './FNT512.png',
            badge: './FNT512.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || './'
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title || '神経タイプ診断', options)
        );
    }
});

// 通知クリック時
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});

// メッセージ受信（バージョン更新通知など）
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
