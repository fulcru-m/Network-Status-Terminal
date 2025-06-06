const CACHE_NAME = "network-checker-v1"
const urlsToCache = ["/", "/manifest.json", "/_next/static/css/", "/_next/static/js/"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)))
})

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
      .catch(() => {
        // If both cache and network fail, return offline page
        if (event.request.destination === "document") {
          return caches.match("/")
        }
      }),
  )
})
