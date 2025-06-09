// Utility functions for offline functionality

export interface OfflineData {
  timestamp: string
  data: any
  type: 'connection' | 'ping' | 'speed'
}

// Store data in localStorage for offline access
export function storeOfflineData(key: string, data: any, type: OfflineData['type']) {
  try {
    const offlineData: OfflineData = {
      timestamp: new Date().toISOString(),
      data,
      type
    }
    localStorage.setItem(`offline_${key}`, JSON.stringify(offlineData))
  } catch (error) {
    console.error('Failed to store offline data:', error)
  }
}

// Retrieve data from localStorage
export function getOfflineData(key: string): OfflineData | null {
  try {
    const stored = localStorage.getItem(`offline_${key}`)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to retrieve offline data:', error)
  }
  return null
}

// Check if we're currently offline
export function isOffline(): boolean {
  return !navigator.onLine
}

// Get cached connection logs
export function getCachedLogs() {
  try {
    const logs = localStorage.getItem('connectionLogs')
    return logs ? JSON.parse(logs) : []
  } catch (error) {
    console.error('Failed to get cached logs:', error)
    return []
  }
}

// Store connection logs
export function storeLogs(logs: any[]) {
  try {
    localStorage.setItem('connectionLogs', JSON.stringify(logs))
  } catch (error) {
    console.error('Failed to store logs:', error)
  }
}

// Check if service worker is available and active
export function isServiceWorkerActive(): Promise<boolean> {
  return new Promise((resolve) => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        resolve(!!registration.active)
      }).catch(() => {
        resolve(false)
      })
    } else {
      resolve(false)
    }
  })
}

// Request service worker to cache specific URLs
export function requestCacheUrls(urls: string[]) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      urls
    })
  }
}

// Force service worker update
export function updateServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.update()
      })
    })
  }
}

// Get offline status with additional context
export function getOfflineStatus() {
  const isCurrentlyOffline = isOffline()
  const hasServiceWorker = 'serviceWorker' in navigator
  const hasCachedData = getCachedLogs().length > 0
  
  return {
    offline: isCurrentlyOffline,
    serviceWorkerSupported: hasServiceWorker,
    hasCachedData,
    canWorkOffline: hasServiceWorker && hasCachedData
  }
}