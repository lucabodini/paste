/* Service worker dedicato alle Web Push. Deve restare nello scope /paste/. */
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Compleanno 🎉", {
      body: data.body || "Oggi è un giorno speciale!",
      icon: "favicon.svg",
      badge: "favicon.svg",
      tag: data.tag || "paste-birthday",
      renotify: false,
      data: { url: data.url || self.registration.scope },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
