self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 실시간 데이터를 쓰는 앱이라 캐시하지 않고 그대로 통과시킵니다.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "N.ROUND";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // 알림에 앱 아이콘을 그대로 씁니다.
      icon: "/icon-192.png",
      // 안드로이드 상태바용 단색 실루엣
      badge: "/badge-96.png",
      // 홈 화면 아이콘과 같은 이미지를 크게 한 번 더
      image: undefined,
      tag: data.url || "nround",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // 이미 열려 있는 창이 있으면 그 창을 씁니다.
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
