import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Network Status Terminal",
  description: "Check your internet connection status",
  manifest: "/manifest.json",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Enhanced Service Worker registration with offline caching
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(registration) {
                    console.log('Service Worker registered successfully:', registration.scope);
                    
                    // Handle service worker updates
                    registration.addEventListener('updatefound', () => {
                      const newWorker = registration.installing;
                      if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is available
                            console.log('New service worker available');
                            // Optionally notify user about update
                          }
                        });
                      }
                    });
                  })
                  .catch(function(registrationError) {
                    console.error('Service Worker registration failed:', registrationError);
                  });
                
                // Listen for service worker messages
                navigator.serviceWorker.addEventListener('message', function(event) {
                  if (event.data && event.data.type === 'CACHE_UPDATED') {
                    console.log('Cache updated:', event.data.url);
                  }
                });
                
                // Handle offline/online events
                window.addEventListener('online', function() {
                  console.log('Back online - service worker will sync data');
                });
                
                window.addEventListener('offline', function() {
                  console.log('Gone offline - service worker will serve cached content');
                });
              });
            } else {
              console.warn('Service Worker not supported in this browser');
            }
          `,
          }}
        />
      </body>
    </html>
  )
}
