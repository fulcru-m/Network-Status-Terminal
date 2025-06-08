"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { RefreshCw, Clock, Globe, Zap, Activity } from "lucide-react"

interface ConnectionLog {
  ip: string
  timestamp: string
  status: "online" | "offline" | "ping" | "speed"
  pingTime?: number
  downloadSpeed?: number
}

interface SpeedTestSample {
  time: number
  speed: number
}

export default function InternetChecker() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [isSpeedTesting, setIsSpeedTesting] = useState(false)
  const [currentIP, setCurrentIP] = useState<string>("")
  const [pingTime, setPingTime] = useState<number | null>(null)
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null)
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([])
  const [lastChecked, setLastChecked] = useState<string>("")
  const [animationEnabled, setAnimationEnabled] = useState(true)
  const [statusText, setStatusText] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const [currentStatusType, setCurrentStatusType] = useState<"connection" | "ping" | "speed">("connection")
  const [speedTestProgress, setSpeedTestProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speedGraphRef = useRef<HTMLDivElement>(null)
  const [speedTestSamples, setSpeedTestSamples] = useState<SpeedTestSample[]>([])
  const [totalBytesDownloaded, setTotalBytesDownloaded] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [lastSpeedTestResult, setLastSpeedTestResult] = useState<number | null>(null)

  // Speed test parameters
  const DOWNLOAD_FILE_SIZE_BYTES = 1000 * 1024 * 1024 // 1000 MB for faster testing
  const DOWNLOAD_TEST_URL_BASE = "https://speed.cloudflare.com/__down"
  const NUM_PARALLEL_CONNECTIONS = 10
  const GRAPH_SAMPLE_INTERVAL_MS = 200
  const TEST_TIMEOUT_SECONDS = 10 // Increased timeout to 10 seconds

  const checkConnection = async () => {
    setIsChecking(true)
    setCurrentStatusType("connection")

    try {
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
      const endpoint = "https://speed.cloudflare.com/__down?bytes=1"

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
    if (!isOnline) {
      typeText("NO CONNECTION")
      return
    }

    setIsSpeedTesting(true)
    setCurrentStatusType("speed")
    setDownloadSpeed(null)
    setSpeedTestProgress(0)
    setSpeedTestSamples([])
    
    let totalBytes = 0
    setTotalBytesDownloaded(0)

    const overallStartTime = performance.now()

    // Setup abort controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    // Test timeout
    const testTimeoutId = setTimeout(() => {
      if (!signal.aborted) {
        console.log("Speed test timed out after", TEST_TIMEOUT_SECONDS, "seconds")
        abortControllerRef.current?.abort()
      }
    }, TEST_TIMEOUT_SECONDS * 1000)

    // UI update function
    const updateUI = () => {
      const currentTime = performance.now()
      const elapsedTime = (currentTime - overallStartTime) / 1000

      if (elapsedTime > 0) {
        const currentSpeed = (totalBytes * 8) / elapsedTime / (1024 * 1024)
        setDownloadSpeed(currentSpeed)
        setTotalBytesDownloaded(totalBytes)
        
        // Update verbose status message
        const progressPercent = Math.min(Math.max((totalBytes / DOWNLOAD_FILE_SIZE_BYTES) * 100, 0), 100)
        const mbDownloaded = (totalBytes / (1024 * 1024)).toFixed(1)
        const mbTotal = (DOWNLOAD_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)
        
        // Set verbose status based on test phase
        if (elapsedTime < 1) {
          setStatusText("INITIALIZING SPEED TEST...")
        } else if (progressPercent < 90) {
          setStatusText(`DOWNLOADING ${mbDownloaded}MB AT ${currentSpeed.toFixed(1)} MBPS`)
        } else {
          setStatusText(`FINALIZING TEST... ${currentSpeed.toFixed(1)} MBPS`)
        }

        // Update graph data
        const newSample = { time: elapsedTime, speed: currentSpeed }
        setSpeedTestSamples(prev => [...prev, newSample])
        
        // Save samples to localStorage in real-time
        const updatedSamples = [...speedTestSamples, newSample]
        localStorage.setItem("speedTestSamples", JSON.stringify(updatedSamples))
      }

      if (totalBytes < DOWNLOAD_FILE_SIZE_BYTES && !signal.aborted) {
        animationFrameRef.current = requestAnimationFrame(updateUI)
      } else {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        if (!signal.aborted) {
          clearTimeout(testTimeoutId)
        }
      }
    }

    // Start UI updates
    animationFrameRef.current = requestAnimationFrame(updateUI)

    try {
      const downloadPromises = []
      const bytesPerConnection = Math.floor(DOWNLOAD_FILE_SIZE_BYTES / NUM_PARALLEL_CONNECTIONS)
      let remainingBytes = DOWNLOAD_FILE_SIZE_BYTES % NUM_PARALLEL_CONNECTIONS

      for (let i = 0; i < NUM_PARALLEL_CONNECTIONS; i++) {
        const currentConnectionBytes = bytesPerConnection + (remainingBytes-- > 0 ? 1 : 0)
        const url = `${DOWNLOAD_TEST_URL_BASE}?bytes=${currentConnectionBytes}&_t=${Date.now()}_${i}`

        console.log(`Starting connection ${i + 1} with ${currentConnectionBytes} bytes`)
        downloadPromises.push(
          (async () => {
            try {
              const response = await fetch(url, { cache: "no-store", signal })
              if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`)
              }

              const reader = response.body?.getReader()
              if (!reader) throw new Error("No reader available")

              let connectionBytesDownloaded = 0
              while (true) {
                if (signal.aborted) {
                  console.log(`Connection ${i + 1} aborted after downloading ${connectionBytesDownloaded} bytes`)
                  reader.cancel()
                  break
                }
                const { done, value } = await reader.read()
                if (done) break

                connectionBytesDownloaded += value.length
                totalBytes += value.length
              }
              console.log(`Connection ${i + 1} completed, downloaded ${connectionBytesDownloaded} bytes`)
            } catch (error) {
              if (error.name !== "AbortError") {
                console.error(`Connection ${i + 1} failed:`, error)
                throw error
              }
            }
          })()
        )
      }

      console.log("Waiting for all download connections to complete...")
      await Promise.all(downloadPromises)
      clearTimeout(testTimeoutId)

      const finalTime = (performance.now() - overallStartTime) / 1000
      const finalSpeed = (totalBytes * 8) / finalTime / (1024 * 1024)
      
      console.log(`Speed test completed: ${finalSpeed.toFixed(2)} MBPS, ${totalBytes} bytes in ${finalTime.toFixed(2)} seconds`)
      setDownloadSpeed(finalSpeed)
      setTotalBytesDownloaded(totalBytes)
      setLastSpeedTestResult(finalSpeed)
      logConnection(currentIP, "speed", undefined, finalSpeed)
      setStatusText(`TEST COMPLETE: ${finalSpeed.toFixed(1)} MBPS AVERAGE`)
      
      // Save final result and samples to localStorage
      localStorage.setItem("lastSpeedTestResult", finalSpeed.toString())
      localStorage.setItem("speedTestSamples", JSON.stringify(speedTestSamples))

    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Speed test failed:", error)
        setStatusText("SPEED TEST FAILED - CHECK CONNECTION")
      } else {
        // Handle timeout as normal completion
        const finalTime = (performance.now() - overallStartTime) / 1000
        const finalSpeed = totalBytes > 0 ? (totalBytes * 8) / finalTime / (1024 * 1024) : 0
        
        console.log(`Speed test completed (timeout): ${finalSpeed.toFixed(2)} MBPS, ${totalBytes} bytes in ${finalTime.toFixed(2)} seconds`)
        setDownloadSpeed(finalSpeed)
        setTotalBytesDownloaded(totalBytes)
        setLastSpeedTestResult(finalSpeed)
        logConnection(currentIP, "speed", undefined, finalSpeed)
        setStatusText(`TEST COMPLETE: ${finalSpeed.toFixed(1)} MBPS AVERAGE`)
        
        // Save final result and samples to localStorage
        localStorage.setItem("lastSpeedTestResult", finalSpeed.toString())
        localStorage.setItem("speedTestSamples", JSON.stringify(speedTestSamples))
      }
      clearTimeout(testTimeoutId)
    } finally {
      setIsSpeedTesting(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }

  // Simple canvas-based graph drawing
  const drawSpeedGraph = useCallback((data: SpeedTestSample[]) => {
    if (!speedGraphRef.current) return

    const canvas = speedGraphRef.current.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)
    
    // If no data, show empty graph with axes
    if (data.length === 0) {
      // Set up margins
      const margin = { top: 20, right: 30, bottom: 40, left: 60 }
      const graphWidth = width - margin.left - margin.right
      const graphHeight = height - margin.top - margin.bottom
      
      // Draw grid
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.1)'
      ctx.lineWidth = 1
      
      // Vertical grid lines
      for (let i = 0; i <= 5; i++) {
        const x = margin.left + (i / 5) * graphWidth
        ctx.beginPath()
        ctx.moveTo(x, margin.top)
        ctx.lineTo(x, margin.top + graphHeight)
        ctx.stroke()
      }
      
      // Horizontal grid lines
      for (let i = 0; i <= 5; i++) {
        const y = margin.top + (i / 5) * graphHeight
        ctx.beginPath()
        ctx.moveTo(margin.left, y)
        ctx.lineTo(margin.left + graphWidth, y)
        ctx.stroke()
      }
      
      // Draw axes
      ctx.strokeStyle = '#00ff41'
      ctx.lineWidth = 2
      ctx.beginPath()
      // X axis
      ctx.moveTo(margin.left, margin.top + graphHeight)
      ctx.lineTo(margin.left + graphWidth, margin.top + graphHeight)
      // Y axis
      ctx.moveTo(margin.left, margin.top)
      ctx.lineTo(margin.left, margin.top + graphHeight)
      ctx.stroke()
      
      // Draw labels
      ctx.fillStyle = '#00ff41'
      ctx.font = '12px "Courier New", Monaco, "Lucida Console", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('TIME (SECONDS)', margin.left + graphWidth / 2, height - 10)
      
      ctx.save()
      ctx.translate(15, margin.top + graphHeight / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText('SPEED (MBPS)', 0, 0)
      ctx.restore()
      
      // Show "NO DATA" message
      ctx.fillStyle = 'rgba(0, 255, 65, 0.5)'
      ctx.font = '16px "Courier New", Monaco, "Lucida Console", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('NO DATA - RUN SPEED TEST', margin.left + graphWidth / 2, margin.top + graphHeight / 2)
      
      return
    }
    
    // Set up margins
    const margin = { top: 20, right: 30, bottom: 40, left: 60 }
    const graphWidth = width - margin.left - margin.right
    const graphHeight = height - margin.top - margin.bottom
    
    if (data.length < 2) return
    
    // Calculate scales
    const maxTime = Math.max(...data.map(d => d.time))
    const maxSpeed = Math.max(...data.map(d => d.speed))
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.1)'
    ctx.lineWidth = 1
    
    // Vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * graphWidth
      ctx.beginPath()
      ctx.moveTo(x, margin.top)
      ctx.lineTo(x, margin.top + graphHeight)
      ctx.stroke()
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * graphHeight
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + graphWidth, y)
      ctx.stroke()
    }
    
    // Draw axes
    ctx.strokeStyle = '#00ff41'
    ctx.lineWidth = 2
    ctx.beginPath()
    // X axis
    ctx.moveTo(margin.left, margin.top + graphHeight)
    ctx.lineTo(margin.left + graphWidth, margin.top + graphHeight)
    // Y axis
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + graphHeight)
    ctx.stroke()
    
    // Draw labels
    ctx.fillStyle = '#00ff41'
    ctx.font = '12px "Courier New", Monaco, "Lucida Console", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('TIME (SECONDS)', margin.left + graphWidth / 2, height - 10)
    
    ctx.save()
    ctx.translate(15, margin.top + graphHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('SPEED (MBPS)', 0, 0)
    ctx.restore()
    
    // Draw speed line
    ctx.strokeStyle = '#00ff41'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    
    // Create ultra-smooth curve using Bezier curves
    if (data.length >= 2) {
      const firstPoint = data[0]
      const firstX = margin.left + (firstPoint.time / maxTime) * graphWidth
      const firstY = margin.top + graphHeight - (firstPoint.speed / (maxSpeed * 1.1)) * graphHeight
      ctx.moveTo(firstX, firstY)
      
      if (data.length === 2) {
        // For just two points, draw a simple line
        const secondPoint = data[1]
        const secondX = margin.left + (secondPoint.time / maxTime) * graphWidth
        const secondY = margin.top + graphHeight - (secondPoint.speed / (maxSpeed * 1.1)) * graphHeight
        ctx.lineTo(secondX, secondY)
      } else {
        // For multiple points, use smooth Bezier curves
        for (let i = 1; i < data.length; i++) {
          const currentPoint = data[i]
          const currentX = margin.left + (currentPoint.time / maxTime) * graphWidth
          const currentY = margin.top + graphHeight - (currentPoint.speed / (maxSpeed * 1.1)) * graphHeight
          
          if (i === 1) {
            // First curve segment
            const nextPoint = data[i + 1] || currentPoint
            const nextX = margin.left + (nextPoint.time / maxTime) * graphWidth
            const nextY = margin.top + graphHeight - (nextPoint.speed / (maxSpeed * 1.1)) * graphHeight
            
            const cp1x = firstX + (currentX - firstX) * 0.5
            const cp1y = firstY
            const cp2x = currentX - (nextX - currentX) * 0.3
            const cp2y = currentY
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, currentX, currentY)
          } else if (i === data.length - 1) {
            // Last curve segment
            const prevPoint = data[i - 1]
            const prevX = margin.left + (prevPoint.time / maxTime) * graphWidth
            const prevY = margin.top + graphHeight - (prevPoint.speed / (maxSpeed * 1.1)) * graphHeight
            
            const cp1x = prevX + (currentX - prevX) * 0.7
            const cp1y = prevY
            const cp2x = currentX - (currentX - prevX) * 0.5
            const cp2y = currentY
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, currentX, currentY)
          } else {
            // Middle curve segments
            const prevPoint = data[i - 1]
            const nextPoint = data[i + 1]
            const prevX = margin.left + (prevPoint.time / maxTime) * graphWidth
            const prevY = margin.top + graphHeight - (prevPoint.speed / (maxSpeed * 1.1)) * graphHeight
            const nextX = margin.left + (nextPoint.time / maxTime) * graphWidth
            const nextY = margin.top + graphHeight - (nextPoint.speed / (maxSpeed * 1.1)) * graphHeight
            
            const cp1x = prevX + (currentX - prevX) * 0.7
            const cp1y = prevY + (currentY - prevY) * 0.3
            const cp2x = currentX - (nextX - currentX) * 0.3
            const cp2y = currentY - (nextY - currentY) * 0.3
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, currentX, currentY)
          }
        }
      }
    }
    
    // Add glow effect
    ctx.shadowColor = '#00ff41'
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // Draw axis labels
    ctx.fillStyle = '#00cc00'
    ctx.font = '10px "Courier New", Monaco, "Lucida Console", monospace'
    ctx.textAlign = 'center'
    
    // X-axis labels
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * graphWidth
      const time = (i / 5) * maxTime
      ctx.fillText(`${time.toFixed(1)}s`, x, margin.top + graphHeight + 20)
    }
    
    // Y-axis labels
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + graphHeight - (i / 5) * graphHeight
      const speed = (i / 5) * maxSpeed * 1.1
      ctx.fillText(`${speed.toFixed(0)}`, margin.left - 10, y + 4)
    }
  }, [])

  // Update graph when samples change
  useEffect(() => {
    drawSpeedGraph(speedTestSamples)
  }, [speedTestSamples, drawSpeedGraph])
  
  // Draw graph on component mount (for empty state)
  useEffect(() => {
    drawSpeedGraph(speedTestSamples)
  }, [drawSpeedGraph])

  const typeText = (text: string) => {
    // For speed test, update immediately to avoid fast blinking
    if (currentStatusType === "speed" && isSpeedTesting) {
      setStatusText(text)
    } else {
      // Use typing effect for other status updates
      setStatusText("")
      let i = 0
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          setStatusText(text.slice(0, i + 1))
          i++
        } else {
          clearInterval(typeInterval)
        }
      }, 80) // Slightly faster typing for better UX
    }
  }

  const logConnection = (ip: string, status: "online" | "offline" | "ping" | "speed", pingMs?: number | null, speedMbps?: number) => {
    const newLog: ConnectionLog = {
      ip,
      timestamp: new Date().toLocaleString(),
      status,
      pingTime: pingMs || undefined,
      downloadSpeed: speedMbps || undefined,
    }

    setConnectionLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 20)
      localStorage.setItem("connectionLogs", JSON.stringify(updated))
      return updated
    })
  }

  const toggleAnimation = () => {
    const newState = !animationEnabled
    setAnimationEnabled(newState)
    localStorage.setItem("animationEnabled", JSON.stringify(newState))
  }

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 800) // Slower blink rate for better readability

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

    // Load logs from localStorage
    const savedLogs = localStorage.getItem("connectionLogs")
    if (savedLogs) {
      setConnectionLogs(JSON.parse(savedLogs))
    }
    
    // Load speed test data from localStorage
    const savedSpeedTestSamples = localStorage.getItem("speedTestSamples")
    if (savedSpeedTestSamples) {
      try {
        const samples = JSON.parse(savedSpeedTestSamples)
        setSpeedTestSamples(samples)
      } catch (error) {
        console.error("Failed to load speed test samples:", error)
      }
    }
    
    const savedLastSpeedTestResult = localStorage.getItem("lastSpeedTestResult")
    if (savedLastSpeedTestResult) {
      try {
        const result = parseFloat(savedLastSpeedTestResult)
        setLastSpeedTestResult(result)
        setDownloadSpeed(result)
      } catch (error) {
        console.error("Failed to load last speed test result:", error)
      }
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
    const dateStr = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return `${dateStr} ${timeStr}`
  }

  const getStatusColor = () => {
    if (currentStatusType === "ping" && pingTime !== null) {
      if (pingTime < 100) return "text-[#00ff41]"
      if (pingTime < 150) return "text-orange-300"
      if (pingTime < 200) return "text-orange-400"
      if (pingTime < 300) return "text-orange-500"
      if (pingTime < 500) return "text-red-400"
      return "text-red-500"
    }
    if (currentStatusType === "speed" && downloadSpeed !== null) {
      if (downloadSpeed > 100) return "text-[#00ff41]"
      if (downloadSpeed > 50) return "text-orange-300"
      if (downloadSpeed > 25) return "text-orange-400"
      if (downloadSpeed > 10) return "text-orange-500"
      if (downloadSpeed > 1) return "text-red-400"
      return "text-red-500"
    }
    return isOnline ? "text-[#00ff41]" : "text-red-500"
  }

  const getLogStatusDisplay = (log: ConnectionLog) => {
    if (log.status === "ping") {
      return log.pingTime ? `${log.pingTime}ms` : "PING FAIL"
    }
    if (log.status === "speed") {
      return log.downloadSpeed ? `${log.downloadSpeed.toFixed(2)} MBPS` : "SPEED FAIL"
    }
    return log.status === "online" ? "ONLINE" : "OFFLINE"
  }

  const getLogStatusColor = (log: ConnectionLog) => {
    if (log.status === "ping") {
      if (!log.pingTime) return "text-red-500"
      if (log.pingTime < 100) return "text-[#00ff41]"
      if (log.pingTime < 150) return "text-orange-300"
      if (log.pingTime < 200) return "text-orange-400"
      if (log.pingTime < 300) return "text-orange-500"
      if (log.pingTime < 500) return "text-red-400"
      return "text-red-500"
    }
    if (log.status === "speed") {
      if (!log.downloadSpeed) return "text-red-500"
      if (log.downloadSpeed > 100) return "text-[#00ff41]"
      if (log.downloadSpeed > 50) return "text-orange-300"
      if (log.downloadSpeed > 25) return "text-orange-400"
      if (log.downloadSpeed > 10) return "text-orange-500"
      if (log.downloadSpeed > 1) return "text-red-400"
      return "text-red-500"
    }
    return log.status === "online" ? "text-[#00ff41]" : "text-red-500"
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff41] font-mono relative overflow-hidden">
      {/* Matrix Background */}
      {animationEnabled && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none opacity-20"
          style={{ zIndex: 0 }}
        />
      )}

      {/* Main Content */}
      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 tracking-wider">
            INTERNET CONNECTION MONITOR
          </h1>
          <div className="text-sm opacity-70">
            SYSTEM STATUS: {isOnline === null ? "INITIALIZING" : isOnline ? "OPERATIONAL" : "OFFLINE"}
          </div>
        </div>

        {/* Main Status Display */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-black border border-[#00ff41] p-6 rounded-lg shadow-lg shadow-[#00ff41]/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Connection Status */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Globe className="w-6 h-6 mr-2" />
                  <span className="text-lg font-semibold">CONNECTION</span>
                </div>
                <div className={`text-2xl font-bold ${getStatusColor()}`}>
                  {isOnline === null ? "CHECKING..." : isOnline ? "ONLINE" : "OFFLINE"}
                </div>
                <div className="text-sm opacity-70 mt-1">
                  IP: {currentIP || "Unknown"}
                </div>
              </div>

              {/* Ping Status */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-6 h-6 mr-2" />
                  <span className="text-lg font-semibold">PING</span>
                </div>
                <div className={`text-2xl font-bold ${getStatusColor()}`}>
                  {isPinging ? "TESTING..." : pingTime !== null ? `${pingTime}ms` : "NOT TESTED"}
                </div>
                <div className="text-sm opacity-70 mt-1">
                  Latency to Cloudflare
                </div>
              </div>

              {/* Speed Status */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="w-6 h-6 mr-2" />
                  <span className="text-lg font-semibold">SPEED</span>
                </div>
                <div className={`text-2xl font-bold ${getStatusColor()}`}>
                  {isSpeedTesting ? "TESTING..." : downloadSpeed !== null ? `${downloadSpeed.toFixed(1)} MBPS` : "NOT TESTED"}
                </div>
                <div className="text-sm opacity-70 mt-1">
                  Download Speed
                </div>
              </div>
            </div>

            {/* Status Text with Cursor */}
            <div className="mt-6 text-center">
              <div className="text-lg font-mono">
                <span className={getStatusColor()}>
                  {statusText}
                  {showCursor && <span className="animate-pulse">_</span>}
                </span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <button
                onClick={checkConnection}
                disabled={isChecking}
                className="flex items-center px-4 py-2 bg-transparent border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "CHECKING..." : "CHECK CONNECTION"}
              </button>

              <button
                onClick={checkPing}
                disabled={isPinging || !isOnline}
                className="flex items-center px-4 py-2 bg-transparent border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition-colors disabled:opacity-50"
              >
                <Clock className={`w-4 h-4 mr-2 ${isPinging ? "animate-spin" : ""}`} />
                {isPinging ? "PINGING..." : "TEST PING"}
              </button>

              <button
                onClick={runSpeedTest}
                disabled={isSpeedTesting || !isOnline}
                className="flex items-center px-4 py-2 bg-transparent border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition-colors disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 mr-2 ${isSpeedTesting ? "animate-spin" : ""}`} />
                {isSpeedTesting ? "TESTING..." : "TEST SPEED"}
              </button>

              <button
                onClick={toggleAnimation}
                className="flex items-center px-4 py-2 bg-transparent border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition-colors"
              >
                <Activity className="w-4 h-4 mr-2" />
                {animationEnabled ? "DISABLE MATRIX" : "ENABLE MATRIX"}
              </button>
            </div>
          </div>
        </div>

        {/* Speed Test Graph */}
        {(isSpeedTesting || speedTestSamples.length > 0) && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-black border border-[#00ff41] p-6 rounded-lg shadow-lg shadow-[#00ff41]/20">
              <h3 className="text-xl font-bold mb-4 text-center">SPEED TEST GRAPH</h3>
              <div ref={speedGraphRef} className="w-full h-64 relative">
                <canvas className="w-full h-full" />
              </div>
              {isSpeedTesting && (
                <div className="mt-4 text-center text-sm opacity-70">
                  Downloaded: {(totalBytesDownloaded / (1024 * 1024)).toFixed(1)} MB
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connection Logs */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-black border border-[#00ff41] p-6 rounded-lg shadow-lg shadow-[#00ff41]/20">
            <h3 className="text-xl font-bold mb-4">CONNECTION LOG</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {connectionLogs.length === 0 ? (
                <div className="text-center opacity-50">No connection logs yet</div>
              ) : (
                connectionLogs.map((log, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-[#00ff41]/20">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm opacity-70">{formatDateTime(log.timestamp)}</span>
                      <span className="text-sm">{log.ip}</span>
                    </div>
                    <span className={`font-bold ${getLogStatusColor(log)}`}>
                      {getLogStatusDisplay(log)}
                    </span>
                  </div>
                ))
              )}
            </div>
            {lastChecked && (
              <div className="mt-4 text-sm opacity-70 text-center">
                Last checked: {lastChecked}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}