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
  const checkConnection = async () => {
    setIsChecking(true)
    setCurrentStatusType("connection")

    try {
      // Get IP directly from client-side (your device)
      const ipResponse = await fetch("https://api.ipify.org?format=json", {
        cache: "no-cache",
      })

      if (ipResponse.ok) {
        const ipData = await ipResponse.json()
        setIsOnline(true)
        setCurrentIP(ipData.ip)
        logConnection(ipData.ip, "online")
        typeText("CONNECTED")
      } else {
        throw new Error("Connection failed")
      }
    } catch (error) {
      setIsOnline(false)
      setCurrentIP("Unable to retrieve")
      logConnection("Unable to retrieve", "offline")
      typeText("DISCONNECTED")
    }

    setIsChecking(false)
    setLastChecked(new Date().toLocaleString())
  }

  const checkPing = async () => {
    setIsPinging(true)
    setCurrentStatusType("ping")
    setPingTime(null)

    try {
      const startTime = performance.now()

      // Ping from your device, not the server
      const endpoint = useCloudflare ? "https://speed.cloudflare.com/__down?bytes=1" : "https://httpbin.org/status/200"

      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-cache",
        mode: "cors",
      })

      const endTime = performance.now()
      const pingTime = Math.round(endTime - startTime)

      if (response.ok) {
        setPingTime(pingTime)
        logConnection(currentIP, "ping", pingTime)
        typeText(`${pingTime}ms`)
      } else {
        throw new Error("Ping failed")
      }
    } catch (error) {
      logConnection(currentIP, "ping", null)
      typeText("PING FAILED")
    }

    setIsPinging(false)
  }

  const runSpeedTest = async () => {
    setIsSpeedTesting(true)
    setCurrentStatusType("speedtest")
    setSpeedTestResult(null)
    setSpeedTestProgress(null)

    try {
      // Phase 1: Initialize and select server
      setSpeedTestProgress({
        phase: 'initializing',
        progress: 0,
        currentSpeed: 0,
        message: 'INITIALIZING SPEED TEST PROTOCOL...'
      })
      typeText("SPEED TEST INIT")
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Select best server based on latency
      setSpeedTestProgress({
        phase: 'initializing',
        progress: 20,
        currentSpeed: 0,
        message: 'SCANNING MANILA DATACENTERS...'
      })
      
      let bestServer = speedTestServers[0] // Default to Globe
      let bestLatency = Infinity

      // Test latency to each server
      for (const server of speedTestServers) {
        try {
          const start = performance.now()
          await fetch(`https://httpbin.org/delay/0`, { // Fallback ping test
            method: 'GET',
            cache: 'no-cache',
            mode: 'cors'
          })
          const latency = performance.now() - start
          if (latency < bestLatency) {
            bestLatency = latency
            bestServer = server
          }
        } catch (e) {
          // Server unavailable, skip
        }
      }

      // Phase 2: Latency Test
      setSpeedTestProgress({
        phase: 'latency',
        progress: 30,
        currentSpeed: 0,
        message: `ESTABLISHING CONNECTION TO ${bestServer.name.toUpperCase()}...`
      })
      await new Promise(resolve => setTimeout(resolve, 500))

      const latencyTests = []
      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        try {
          await fetch('https://httpbin.org/status/200', {
            method: 'GET',
            cache: 'no-cache',
            mode: 'cors'
          })
          latencyTests.push(performance.now() - start)
        } catch (e) {
          latencyTests.push(1000) // Timeout fallback
        }
        
        setSpeedTestProgress({
          phase: 'latency',
          progress: 30 + (i + 1) * 2,
          currentSpeed: 0,
          message: `MEASURING NETWORK LATENCY... ${i + 1}/10`
        })
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const avgLatency = latencyTests.reduce((a, b) => a + b, 0) / latencyTests.length
      const jitter = Math.sqrt(latencyTests.reduce((sum, lat) => sum + Math.pow(lat - avgLatency, 2), 0) / latencyTests.length)

      // Phase 3: Download Test
      setSpeedTestProgress({
        phase: 'download',
        progress: 50,
        currentSpeed: 0,
        message: 'INITIATING DOWNSTREAM BANDWIDTH ANALYSIS...'
      })
      typeText("TESTING DOWNLOAD")
      
      const downloadSpeed = await performDownloadTest((progress, speed, message) => {
        setSpeedTestProgress({
          phase: 'download',
          progress: 50 + (progress * 0.25),
          currentSpeed: speed,
          message: message
        })
      })

      // Phase 4: Upload Test  
      setSpeedTestProgress({
        phase: 'upload',
        progress: 75,
        currentSpeed: 0,
        message: 'INITIATING UPSTREAM BANDWIDTH ANALYSIS...'
      })
      typeText("TESTING UPLOAD")
      
      const uploadSpeed = await performUploadTest((progress, speed, message) => {
        setSpeedTestProgress({
          phase: 'upload',
          progress: 75 + (progress * 0.25),
          currentSpeed: speed,
          message: message
        })
      })

      // Complete
      const result: SpeedTestResult = {
        downloadSpeed,
        uploadSpeed,
        latency: Math.round(avgLatency),
        jitter: Math.round(jitter),
        server: bestServer.name
      }

      setSpeedTestResult(result)
      setSpeedTestProgress({
        phase: 'complete',
        progress: 100,
        currentSpeed: 0,
        message: 'BANDWIDTH ANALYSIS COMPLETE'
      })

      logConnection(currentIP, "speedtest", undefined, downloadSpeed, uploadSpeed)
      typeText(`${downloadSpeed.toFixed(1)}/${uploadSpeed.toFixed(1)} Mbps`)

    } catch (error) {
      setSpeedTestProgress({
        phase: 'complete',
        progress: 100,
        currentSpeed: 0,
        message: 'SPEED TEST FAILED - NETWORK ERROR'
      })
      typeText("SPEED TEST FAILED")
    }

    setIsSpeedTesting(false)
  }

  const performDownloadTest = async (onProgress: (progress: number, speed: number, message: string) => void): Promise<number> => {
    const testDuration = 15000 // 15 seconds minimum
    const chunkSize = 10 * 1024 * 1024 // 10MB chunks
    const maxChunks = 100 // Up to 1GB total
    
    let totalBytes = 0
    let startTime = performance.now()
    let speeds: number[] = []
    
    for (let chunk = 0; chunk < maxChunks; chunk++) {
      const chunkStart = performance.now()
      
      try {
        // Use httpbin.org to generate random data
        const response = await fetch(`https://httpbin.org/bytes/${chunkSize}`, {
          cache: 'no-cache',
          mode: 'cors'
        })
        
        if (!response.ok) throw new Error('Download failed')
        
        const data = await response.arrayBuffer()
        totalBytes += data.byteLength
        
        const chunkTime = performance.now() - chunkStart
        const chunkSpeed = (data.byteLength * 8) / (chunkTime / 1000) / 1000000 // Mbps
        speeds.push(chunkSpeed)
        
        const elapsed = performance.now() - startTime
        const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1000000 // Mbps
        
        onProgress(
          Math.min((elapsed / testDuration) * 100, 100),
          currentSpeed,
          `DOWNLOADING CHUNK ${chunk + 1} @ ${chunkSpeed.toFixed(1)} Mbps`
        )
        
        // Stop if we've been testing for minimum duration and speed is stable
        if (elapsed > testDuration && speeds.length > 5) {
          const recentSpeeds = speeds.slice(-5)
          const avgRecent = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length
          const variance = recentSpeeds.reduce((sum, speed) => sum + Math.pow(speed - avgRecent, 2), 0) / recentSpeeds.length
          
          if (variance < avgRecent * 0.1) { // Speed is stable (variance < 10%)
            break
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)) // Small delay between chunks
        
      } catch (error) {
        console.warn('Download chunk failed, continuing...', error)
        break
      }
    }
    
    const totalTime = performance.now() - startTime
    return (totalBytes * 8) / (totalTime / 1000) / 1000000 // Mbps
  }

  const performUploadTest = async (onProgress: (progress: number, speed: number, message: string) => void): Promise<number> => {
    const testDuration = 15000 // 15 seconds minimum
    const chunkSize = 5 * 1024 * 1024 // 5MB chunks for upload
    const maxChunks = 200 // Up to 1GB total
    
    let totalBytes = 0
    let startTime = performance.now()
    let speeds: number[] = []
    
    // Generate random data for upload
    const generateRandomData = (size: number) => {
      const buffer = new ArrayBuffer(size)
      const view = new Uint8Array(buffer)
      for (let i = 0; i < size; i++) {
        view[i] = Math.floor(Math.random() * 256)
      }
      return buffer
    }
    
    for (let chunk = 0; chunk < maxChunks; chunk++) {
      const chunkStart = performance.now()
      
      try {
        const uploadData = generateRandomData(chunkSize)
        
        // Use httpbin.org for upload testing
        const response = await fetch('https://httpbin.org/post', {
          method: 'POST',
          body: uploadData,
          cache: 'no-cache',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        })
        
        if (!response.ok) throw new Error('Upload failed')
        
        await response.text() // Consume response
        totalBytes += uploadData.byteLength
        
        const chunkTime = performance.now() - chunkStart
        const chunkSpeed = (uploadData.byteLength * 8) / (chunkTime / 1000) / 1000000 // Mbps
        speeds.push(chunkSpeed)
        
        const elapsed = performance.now() - startTime
        const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1000000 // Mbps
        
        onProgress(
          Math.min((elapsed / testDuration) * 100, 100),
          currentSpeed,
          `UPLOADING CHUNK ${chunk + 1} @ ${chunkSpeed.toFixed(1)} Mbps`
        )
        
        // Stop if we've been testing for minimum duration and speed is stable
        if (elapsed > testDuration && speeds.length > 5) {
          const recentSpeeds = speeds.slice(-5)
          const avgRecent = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length
          const variance = recentSpeeds.reduce((sum, speed) => sum + Math.pow(speed - avgRecent, 2), 0) / recentSpeeds.length
          
          if (variance < avgRecent * 0.1) { // Speed is stable
            break
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.warn('Upload chunk failed, continuing...', error)
        break
      }
    }
    
    const totalTime = performance.now() - startTime
    return (totalBytes * 8) / (totalTime / 1000) / 1000000 // Mbps
  }
  const typeText = (text: string) => {
    setStatusText("")
    let i = 0
    const typeInterval = setInterval(() => {
      if (i < text.length) {
        setStatusText(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(typeInterval)
      }
    }, 100)
  }

  const logConnection = (ip: string, status: "online" | "offline" | "ping" | "speedtest", pingMs?: number | null, downloadSpeed?: number, uploadSpeed?: number) => {
    const newLog: ConnectionLog = {
      ip,
      timestamp: new Date().toLocaleString(),
      status,
      pingTime: pingMs || undefined,
      downloadSpeed: downloadSpeed || undefined,
      uploadSpeed: uploadSpeed || undefined,
    }

    setConnectionLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 5)
      localStorage.setItem("connectionLogs", JSON.stringify(updated))
      return updated
    })
  }

  const toggleAnimation = () => {
    const newState = !animationEnabled
    setAnimationEnabled(newState)
    localStorage.setItem("animationEnabled", JSON.stringify(newState))
  }

  const toggleCloudflare = () => {
    const newState = !useCloudflare
    setUseCloudflare(newState)
    localStorage.setItem("useCloudflare", JSON.stringify(newState))
  }

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)

    return () => clearInterval(cursorInterval)
  }, [])

  // Matrix digital rain effect
  useEffect(() => {
    if (!animationEnabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
    }

    window.addEventListener("resize", resizeCanvas)

    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*()_+-=[]{}|;:,.<>/?~"
    const fontSize = 14
    const columns = canvas.width / fontSize

    const drops: number[] = []
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * -100)
    }

    const drawMatrix = () => {
      if (!ctx || !canvas) return

      ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = "#00ff41"
      ctx.font = `${fontSize}px "Courier New", Monaco, "Lucida Console", monospace`

      for (let i = 0; i < drops.length; i++) {
        const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length))
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const matrixInterval = setInterval(drawMatrix, 50)

    return () => {
      clearInterval(matrixInterval)
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [animationEnabled])

  useEffect(() => {
    // Load preferences
    const savedAnimation = localStorage.getItem("animationEnabled")
    if (savedAnimation !== null) {
      setAnimationEnabled(JSON.parse(savedAnimation))
    }

    const savedCloudflare = localStorage.getItem("useCloudflare")
    if (savedCloudflare !== null) {
      setUseCloudflare(JSON.parse(savedCloudflare))
    }

    // Load logs from localStorage
    const savedLogs = localStorage.getItem("connectionLogs")
    if (savedLogs) {
      setConnectionLogs(JSON.parse(savedLogs))
    }

    checkConnection()

    const handleOnline = () => checkConnection()
    const handleOffline = () => {
      setIsOnline(false)
      setCurrentIP("")
      logConnection("Unknown", "offline")
      setLastChecked(new Date().toLocaleString())
      typeText("DISCONNECTED")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const dateStr = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    return `${dateStr} ${timeStr}`
  }

  const getStatusColor = () => {
    if (currentStatusType === "speedtest" && speedTestResult) {
      const avgSpeed = (speedTestResult.downloadSpeed + speedTestResult.uploadSpeed) / 2
      if (avgSpeed > 800) return "text-[#00ff41]" // Excellent (800+ Mbps)
      if (avgSpeed > 400) return "text-yellow-400" // Good (400-800 Mbps)
      if (avgSpeed > 100) return "text-orange-400" // Fair (100-400 Mbps)
      return "text-red-500" // Poor (<100 Mbps)
    } else if (currentStatusType === "ping" && pingTime !== null) {
      if (pingTime < 500) return "text-[#00ff41]" // Green - Good (your range)
      if (pingTime < 750) return "text-yellow-400" // Yellow - Moderate
      if (pingTime < 1000) return "text-orange-400" // Orange - High
      return "text-red-500" // Red - Very High
    }
    return isOnline ? "text-[#00ff41]" : "text-red-500"
  }

  const getLogStatusDisplay = (log: ConnectionLog) => {
    if (log.status === "speedtest") {
      return log.downloadSpeed && log.uploadSpeed 
        ? `${log.downloadSpeed.toFixed(0)}/${log.uploadSpeed.toFixed(0)} Mbps`
        : "SPEED FAIL"
    } else if (log.status === "ping") {
      return log.pingTime ? `${log.pingTime}ms` : "PING FAIL"
    }
    return log.status === "online" ? "ONLINE" : "OFFLINE"
  }

  const getLogStatusColor = (log: ConnectionLog) => {
    if (log.status === "speedtest") {
      if (!log.downloadSpeed || !log.uploadSpeed) return "text-red-500"
      const avgSpeed = (log.downloadSpeed + log.uploadSpeed) / 2
      if (avgSpeed > 800) return "text-[#00ff41]"
      if (avgSpeed > 400) return "text-yellow-400"
      if (avgSpeed > 100) return "text-orange-400"
      return "text-red-500"
    } else if (log.status === "ping") {
      if (!log.pingTime) return "text-red-500"
      if (log.pingTime < 500) return "text-[#00ff41]"
      if (log.pingTime < 750) return "text-yellow-400"
      if (log.pingTime < 1000) return "text-orange-400"
      return "text-red-500"
    }
    return log.status === "online" ? "text-[#00ff41]" : "text-red-500"
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {animationEnabled && <canvas ref={canvasRef} className="matrix-bg"></canvas>}

      <div className="w-full max-w-2xl z-10">
        <div className="terminal-container">
          <div className="terminal-header">
            <span className="typing-effect">NETWORK STATUS TERMINAL</span>
          </div>

          <div className="terminal-content p-6">
            {/* Status Display */}
            <div className="mb-8 text-center">
              {isOnline === null ? (
                <div>
                  <div className="text-lg mb-2">Checking connection...</div>
                  <div className="text-sm opacity-70">Please wait</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-2">
                    <span className={getStatusColor()}>{statusText}</span>
                    <span className={`cursor-blink ${getStatusColor()}`}>{showCursor ? "|" : "\u00A0"}</span>
                  </div>
                  {isOnline && (
                    <div className="text-lg mb-2">
                      <Globe className="inline w-4 h-4 mr-2" />
                      IP: {currentIP}
                    </div>
                  )}
                  <div className="text-sm opacity-70">
                    {isOnline ? "Network connection active" : "Viewing from offline cache"}
                  </div>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex justify-center items-center gap-3 mb-6 flex-wrap">
              <button onClick={checkConnection} disabled={isChecking} className="terminal-button flex-1 max-w-48">
                {isChecking ? (
                  <>
                    <RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />
                    SCANNING...
                  </>
                ) : (
                  <>
                    <RefreshCw className="inline w-4 h-4 mr-2" />
                    CHECK CONNECTION
                  </>
                )}
              </button>

              <button onClick={checkPing} disabled={isPinging || !isOnline} className="terminal-button flex-1 max-w-48">
                {isPinging ? (
                  <>
                    <Zap className="inline w-4 h-4 mr-2 animate-pulse" />
                    PINGING...
                  </>
                ) : (
                  <>
                    <Zap className="inline w-4 h-4 mr-2" />
                    PING TEST
                  </>
                )}
              </button>

              <button onClick={runSpeedTest} disabled={isSpeedTesting || !isOnline} className="terminal-button flex-1 max-w-48">
                {isSpeedTesting ? (
                  <>
                    <Gauge className="inline w-4 h-4 mr-2 animate-pulse" />
                    TESTING...
                  </>
                ) : (
                  <>
                    <Gauge className="inline w-4 h-4 mr-2" />
                    SPEED TEST
                  </>
                )}
              </button>
            </div>

            {/* Speed Test Progress */}
            {speedTestProgress && (
              <div className="mb-6 p-4 border border-gray-600 border-opacity-30 rounded">
                <div className="text-sm font-mono mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#00ff41]">PHASE: {speedTestProgress.phase.toUpperCase()}</span>
                    <span className="text-[#00ff41]">{speedTestProgress.progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                    <div 
                      className="bg-[#00ff41] h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${speedTestProgress.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs opacity-70 mb-1">{speedTestProgress.message}</div>
                  {speedTestProgress.currentSpeed > 0 && (
                    <div className="text-xs">
                      CURRENT THROUGHPUT: <span className="text-[#00ff41]">{speedTestProgress.currentSpeed.toFixed(1)} Mbps</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Speed Test Results */}
            {speedTestResult && (
              <div className="mb-6 p-4 border border-gray-600 border-opacity-30 rounded">
                <div className="text-lg mb-3 text-[#00ff41]">BANDWIDTH ANALYSIS RESULTS:</div>
                <div className="font-mono text-sm space-y-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs opacity-70">DOWNSTREAM</div>
                      <div className="text-lg text-[#00ff41]">{speedTestResult.downloadSpeed.toFixed(1)} Mbps</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-70">UPSTREAM</div>
                      <div className="text-lg text-[#00ff41]">{speedTestResult.uploadSpeed.toFixed(1)} Mbps</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-600 border-opacity-30">
                    <div>
                      <div className="text-xs opacity-70">LATENCY</div>
                      <div className="text-sm">{speedTestResult.latency}ms</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-70">JITTER</div>
                      <div className="text-sm">{speedTestResult.jitter}ms</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-600 border-opacity-30">
                    <div className="text-xs opacity-70">TEST SERVER</div>
                    <div className="text-sm">{speedTestResult.server}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Last Checked */}
            {lastChecked && (
              <div className="text-center text-sm opacity-70 mb-6">
                <Clock className="inline w-4 h-4 mr-1" />
                Last checked: {lastChecked}
              </div>
            )}

            {/* Connection History */}
            {connectionLogs.length > 0 && (
              <div className="mt-8">
                <div className="text-lg mb-4">Connection History:</div>
                <div className="font-mono text-sm">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="opacity-70">
                        <th className="text-left w-20">STATUS</th>
                        <th className="text-left w-32">DETAILS</th>
                        <th className="text-left">TIMESTAMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connectionLogs.map((log, index) => (
                        <tr key={index} className={getLogStatusColor(log)}>
                          <td className="w-20">{getLogStatusDisplay(log)}</td>
                          <td className="w-32">{log.status === 'speedtest' ? 'BANDWIDTH' : log.ip}</td>
                          <td>{formatDateTime(log.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings at Bottom */}
            <div className="mt-8 pt-4 border-t border-gray-600 border-opacity-30 space-y-3">
              <label className="flex items-center text-sm cursor-pointer">
                <input type="checkbox" checked={animationEnabled} onChange={toggleAnimation} className="w-4 h-4 mr-3" />
                <span>Enable VT100 graphics subsystem</span>
              </label>

              <label className="flex items-center text-sm cursor-pointer">
                <input type="checkbox" checked={useCloudflare} onChange={toggleCloudflare} className="w-4 h-4 mr-3" />
                <span>Use Cloudflare DNS resolver for latency tests</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InternetChecker() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl z-10">
          <div className="terminal-container">
            <div className="terminal-header">
              <span>NETWORK STATUS TERMINAL</span>
            </div>
            <div className="terminal-content p-6">
              <div className="text-center">
                <div className="text-lg mb-2">Loading...</div>
                <div className="text-sm opacity-70">Please wait</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <InternetCheckerContent />
    </Suspense>
  )
}
