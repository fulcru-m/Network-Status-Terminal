"use client"

import { Suspense } from "react"
import { useState, useEffect, useRef } from "react"
import { RefreshCw, Clock, Globe, Zap, Gauge } from "lucide-react"

interface ConnectionLog {
  ip: string
  timestamp: string
  status: "online" | "offline" | "ping" | "speedtest"
  pingTime?: number
  downloadSpeed?: number
  uploadSpeed?: number
}

interface SpeedTestResult {
  downloadSpeed: number
  uploadSpeed: number
  latency: number
  jitter: number
  server: string
}

interface SpeedTestProgress {
  phase: 'initializing' | 'latency' | 'download' | 'upload' | 'complete'
  progress: number
  currentSpeed: number
  message: string
}

function InternetCheckerContent() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [currentIP, setCurrentIP] = useState<string>("")
  const [pingTime, setPingTime] = useState<number | null>(null)
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([])
  const [lastChecked, setLastChecked] = useState<string>("")
  const [animationEnabled, setAnimationEnabled] = useState(true)
  const [useCloudflare, setUseCloudflare] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const [currentStatusType, setCurrentStatusType] = useState<"connection" | "ping" | "speedtest">("connection")
  const [isSpeedTesting, setIsSpeedTesting] = useState(false)
  const [speedTestResult, setSpeedTestResult] = useState<SpeedTestResult | null>(null)
  const [speedTestProgress, setSpeedTestProgress] = useState<SpeedTestProgress | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Manila-based speed test servers
  const speedTestServers = [
    {
      name: "Globe Telecom Manila",
      downloadUrl: "https://speedtest.globe.com.ph/download",
      uploadUrl: "https://speedtest.globe.com.ph/upload",
      pingUrl: "https://speedtest.globe.com.ph/ping"
    },
    {
      name: "PLDT Manila",
      downloadUrl: "https://speedtest.pldthome.net/download",
      uploadUrl: "https://speedtest.pldthome.net/upload", 
      pingUrl: "https://speedtest.pldthome.net/ping"
    },
    {
      name: "Converge Manila",
      downloadUrl: "https://speedtest.convergeict.com/download",
      uploadUrl: "https://speedtest.convergeict.com/upload",
      pingUrl: "https://speedtest.convergeict.com/ping"
    }
  ]

  // ... rest of the component code ...

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* ... rest of the JSX ... */}
    </div>
  )
}

export default function InternetChecker() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InternetCheckerContent />
    </Suspense>
  )
}