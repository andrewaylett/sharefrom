import { init, track } from '@plausible-analytics/tracker'

// Initialize Plausible tracking
// Domain should match your Plausible dashboard
const DOMAIN = 'sharefrom.xyz'

// Initialize once when the module loads
init({
  domain: DOMAIN,
  captureOnLocalhost: false, // Don't track localhost in development
  autoCapturePageviews: false, // We'll manually track page views with props
})

export function trackPageView(page: 'laptop' | 'mobile') {
  track('pageview', {
    props: {
      view: page
    }
  })
}

export function trackAnalyticsEvent(eventName: string, props?: Record<string, string | number | boolean>) {
  // Convert all values to strings for Plausible
  const stringProps = props ? Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, String(value)])
  ) : undefined
  
  track(eventName, { props: stringProps })
}

// Track connection events
export function trackConnectionSuccess(role: 'laptop' | 'phone') {
  trackAnalyticsEvent('connection_success', { role })
}

export function trackConnectionError(role: 'laptop' | 'phone', error: string) {
  trackAnalyticsEvent('connection_error', { role, error })
}

// Track file transfer events
export function trackFileSent(fileSize: number, fileType: string) {
  trackAnalyticsEvent('file_sent', { 
    size_kb: Math.round(fileSize / 1024),
    file_type: fileType 
  })
}

export function trackFileReceived(fileSize: number, fileType: string) {
  trackAnalyticsEvent('file_received', { 
    size_kb: Math.round(fileSize / 1024),
    file_type: fileType 
  })
}

// Track errors
export function trackError(errorType: string, errorMessage: string) {
  trackAnalyticsEvent('error', { type: errorType, message: errorMessage })
}
