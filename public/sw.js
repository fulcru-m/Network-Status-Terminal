const CACHE_NAME = 'network-checker-v2'
const STATIC_CACHE_NAME = 'network-checker-static-v2'
const DYNAMIC_CACHE_NAME = 'network-checker-dynamic-v2'

// Essential files to pre-cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  // Add other essential static assets that might be needed
]

// Dynamic assets that should be cached as they're requested
const DYNAMIC_CACHE_PATTERNS = [
  /\/_next\/static\/.*/,
  /\/api\/.*/,
  /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/
]

// Maximum number of items in dynamic cache
const MAX_DYNAMIC_CACHE_SIZE = 50

// Install event - pre-cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Pre-caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches that don't match current version
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                (cacheName.startsWith('network-checker-') || cacheName === CACHE_NAME)) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim()
      })
  )
})

// Fetch event - implement cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return
  }
  
  // NEVER cache requests to ipify.org - always fetch fresh IP
  if (url.hostname === 'api.ipify.org') {
    console.log('Bypassing cache for IP service:', request.url)
    event.respondWith(fetch(request))
    return
  }
  
  // Handle API requests with network-first strategy (for real-time data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }
  
  // Handle static assets with cache-first strategy
  event.respondWith(handleStaticRequest(request))
})

// Cache-first strategy for static assets
async function handleStaticRequest(request) {
  try {
    // Try to get from cache first
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      console.log('Serving from cache:', request.url)
      return cachedResponse
    }
    
    // If not in cache, fetch from network
    console.log('Fetching from network:', request.url)
    const networkResponse = await fetch(request)
    
    // Cache the response if it's successful and matches our patterns
    if (networkResponse.ok && shouldCache(request.url)) {
      const responseClone = networkResponse.clone()
      cacheResponse(request, responseClone)
    }
    
    return networkResponse
    
  } catch (error) {
    console.error('Fetch failed for:', request.url, error)
    
    // Try to serve a cached fallback
    const cachedFallback = await caches.match('/')
    if (cachedFallback && request.destination === 'document') {
      return cachedFallback
    }
    
    // Return a basic offline response for failed requests
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This request failed and no cached version is available' 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Network-first strategy for API requests (with fallback to cache)
async function handleApiRequest(request) {
  try {
    // Try network first for real-time data
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const responseClone = networkResponse.clone()
      cacheResponse(request, responseClone)
      return networkResponse
    }
    
    throw new Error(`Network response not ok: ${networkResponse.status}`)
    
  } catch (error) {
    console.log('Network failed for API request, trying cache:', request.url)
    
    // Fallback to cached version
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      // Add a header to indicate this is cached data
      const response = cachedResponse.clone()
      response.headers.set('X-Served-From', 'cache')
      return response
    }
    
    // Return offline indicator for API requests
    return new Response(
      JSON.stringify({ 
        status: 'offline',
        error: 'No network connection and no cached data available',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 
          'Content-Type': 'application/json',
          'X-Served-From': 'offline-fallback'
        }
      }
    )
  }
}

// Cache a response in the appropriate cache
async function cacheResponse(request, response) {
  const url = request.url
  
  try {
    // Determine which cache to use
    const cacheName = url.includes('/_next/static/') || isStaticAsset(url) 
      ? STATIC_CACHE_NAME 
      : DYNAMIC_CACHE_NAME
    
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
    
    // Limit dynamic cache size
    if (cacheName === DYNAMIC_CACHE_NAME) {
      await limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE)
    }
    
    console.log('Cached:', url)
  } catch (error) {
    console.error('Failed to cache:', url, error)
  }
}

// Check if URL should be cached
function shouldCache(url) {
  return DYNAMIC_CACHE_PATTERNS.some(pattern => pattern.test(url))
}

// Check if URL is a static asset
function isStaticAsset(url) {
  return /\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/.test(url)
}

// Limit cache size by removing oldest entries
async function limitCacheSize(cacheName, maxSize) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    
    if (keys.length > maxSize) {
      // Remove oldest entries (FIFO)
      const keysToDelete = keys.slice(0, keys.length - maxSize)
      await Promise.all(keysToDelete.map(key => cache.delete(key)))
      console.log(`Cleaned up ${keysToDelete.length} old cache entries`)
    }
  } catch (error) {
    console.error('Failed to limit cache size:', error)
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    // Allow main thread to request caching of specific URLs
    const urls = event.data.urls
    caches.open(DYNAMIC_CACHE_NAME)
      .then(cache => cache.addAll(urls))
      .catch(error => console.error('Failed to cache requested URLs:', error))
  }
})

// Periodic cache cleanup (runs when service worker is idle)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(performCacheCleanup())
  }
})

async function performCacheCleanup() {
  try {
    // Clean up dynamic cache
    await limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE)
    
    // Remove expired entries (older than 7 days)
    const cache = await caches.open(DYNAMIC_CACHE_NAME)
    const keys = await cache.keys()
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    
    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        const dateHeader = response.headers.get('date')
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime()
          if (now - responseDate > maxAge) {
            await cache.delete(request)
            console.log('Removed expired cache entry:', request.url)
          }
        }
      }
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error)
  }
}