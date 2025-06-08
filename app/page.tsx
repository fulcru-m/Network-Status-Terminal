"use client"

import { useState, useEffect, useRef } from "react"
import { RefreshCw, Clock, Globe, Zap, Activity } from "lucide-react"
import * as d3 from "d3"

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

  // Speed test variables
  const [speedTestSamples, setSpeedTestSamples] = useState<SpeedTestSample[]>([])
  const [totalBytesDownloaded, setTotalBytesDownloaded] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Speed test parameters
  const DOWNLOAD_FILE_SIZE_BYTES = 1000 * 1024 * 1024 // 1000 MB for faster testing
  const DOWNLOAD_TEST_URL_BASE = "https://speed.cloudflare.com/__down"
  const NUM_PARALLEL_CONNECTIONS = 10
  const GRAPH_SAMPLE_INTERVAL_MS = 200
  const TEST_TIMEOUT_SECONDS = 30 // Increased timeout to 30 seconds

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
    
    // Use a ref to track bytes downloaded for immediate updates
    let totalBytes = 0
    setTotalBytesDownloaded(0)

    // Initialize graph
    initializeSpeedGraph()

    const overallStartTime = performance.now()
    let lastGraphUpdateTime = overallStartTime

    // Setup abort controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    // Test timeout
    const testTimeoutId = setTimeout(() => {
      if (!signal.aborted) {
        console.log("Speed test timed out after", TEST_TIMEOUT_SECONDS, "seconds")
        abortControllerRef.current?.abort()
        typeText("TEST TIMEOUT")
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
        } else if (progressPercent < 10) {
          setStatusText(`ESTABLISHING CONNECTIONS... ${progressPercent.toFixed(0)}%`)
        } else if (progressPercent < 90) {
          setStatusText(`DOWNLOADING ${mbDownloaded}MB/${mbTotal}MB AT ${currentSpeed.toFixed(1)} MBPS`)
        } else {
          setStatusText(`FINALIZING TEST... ${currentSpeed.toFixed(1)} MBPS`)
        }

        // Update graph data
        if (currentTime - lastGraphUpdateTime >= GRAPH_SAMPLE_INTERVAL_MS) {
          const newSample = { time: elapsedTime, speed: currentSpeed }
          setSpeedTestSamples(prev => {
            const updated = [...prev, newSample]
            // Use setTimeout to ensure state update happens before graph draw
            setTimeout(() => drawSpeedGraph(updated, elapsedTime), 0)
            return updated
          })
          lastGraphUpdateTime = currentTime
        }
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
      logConnection(currentIP, "speed", undefined, finalSpeed)
      setStatusText(`TEST COMPLETE: ${finalSpeed.toFixed(1)} MBPS AVERAGE`)
      
      // Final graph update
      const finalSample = { time: finalTime, speed: finalSpeed }
      setSpeedTestSamples(prev => {
        const updated = [...prev, finalSample]
        setTimeout(() => drawSpeedGraph(updated, finalTime), 0)
        return updated
      })

    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Speed test failed:", error)
        setStatusText("SPEED TEST FAILED - CHECK CONNECTION")
      } else {
        console.log("Speed test was aborted")
        setStatusText("SPEED TEST ABORTED")
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

  const initializeSpeedGraph = () => {
    if (!speedGraphRef.current) return

    // Clear existing graph
    d3.select(speedGraphRef.current).select("svg").remove()

    const container = speedGraphRef.current
    const containerWidth = container.clientWidth
    const containerHeight = 200
    const margin = { top: 20, right: 30, bottom: 50, left: 60 }
    const width = containerWidth - margin.left - margin.right
    const height = containerHeight - margin.top - margin.bottom

    const svg = d3.select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Add axes groups
    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)

    svg.append("g")
      .attr("class", "y-axis")

    // Add axis labels
    svg.append("text")
      .attr("class", "axis-label")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .attr("text-anchor", "middle")
      .style("fill", "#00ff41")
      .style("font-family", "Courier New, Monaco, Lucida Console, monospace")
      .style("font-size", "12px")
      .text("TIME (SECONDS)")

    svg.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#00ff41")
      .style("font-family", "Courier New, Monaco, Lucida Console, monospace")
      .style("font-size", "12px")
      .text("SPEED (MBPS)")

    // Add line path
    svg.append("path")
      .attr("class", "speed-line")
      .style("fill", "none")
      .style("stroke", "#00ff41")
      .style("stroke-width", "2px")
  }

  const drawSpeedGraph = (data: SpeedTestSample[], maxTime: number) => {
    if (!speedGraphRef.current || data.length === 0) {
      console.log("Cannot draw graph: no container or no data", { 
        hasContainer: !!speedGraphRef.current, 
        dataLength: data.length 
      })
      return
    }

    console.log("Drawing graph with", data.length, "data points")

    const container = speedGraphRef.current
    const containerWidth = container.clientWidth
    const containerHeight = 200
    const margin = { top: 20, right: 30, bottom: 50, left: 60 }
    const width = containerWidth - margin.left - margin.right
    const height = containerHeight - margin.top - margin.bottom

    // Ensure we have the SVG structure
    let svg = d3.select(container).select("svg g")
    if (svg.empty()) {
      console.log("SVG not found, reinitializing graph")
      initializeSpeedGraph()
      svg = d3.select(container).select("svg g")
    }

    if (svg.empty()) {
      console.error("Failed to create or find SVG")
      return
    }

    // Update scales
    const xScale = d3.scaleLinear()
      .domain([0, maxTime * 1.05])
      .range([0, width])

    const maxSpeed = d3.max(data, d => d.speed) || 0
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(maxSpeed * 1.2, 1)]) // Ensure minimum domain of 1
      .range([height, 0])

    console.log("Graph scales:", { 
      xDomain: [0, maxTime * 1.05], 
      yDomain: [0, maxSpeed * 1.2],
      dataPoints: data.length
    })

    // Update axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => `${d.toFixed(1)}s`)

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d.toFixed(0)}`)

    svg.select(".x-axis")
      .transition()
      .duration(200)
      .call(xAxis)
      .selectAll("text")
      .style("fill", "#00cc00")
      .style("font-family", "Courier New, Monaco, Lucida Console, monospace")
      .style("font-size", "10px")

    // Style axis lines
    svg.select(".x-axis")
      .selectAll("path, line")
      .style("stroke", "#006600")

    svg.select(".y-axis")
      .transition()
      .duration(200)
      .call(yAxis)
      .selectAll("text")
      .style("fill", "#00cc00")
      .style("font-family", "Courier New, Monaco, Lucida Console, monospace")
      .style("font-size", "10px")

    svg.select(".y-axis")
      .selectAll("path, line")
      .style("stroke", "#006600")

    // Update line
    const line = d3.line<SpeedTestSample>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.speed))
      .curve(d3.curveMonotoneX) // Smooth curve

    const linePath = svg.select(".speed-line")
      .datum(data)

    if (data.length > 1) {
      linePath
        .transition()
        .duration(200)
        .attr("d", line)
    } else {
      linePath.attr("d", line)
    }

    console.log("Graph updated successfully")
  }

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
    <div className="min-h-screen flex items-center justify-center p-4">
      {animationEnabled && <canvas ref={canvasRef} className="matrix-bg"></canvas>}

      <div className="w-full max-w-4xl z-10">
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
            <div className="flex justify-center items-center gap-4 mb-6 flex-wrap">
              <button onClick={checkConnection} disabled={isChecking} className="terminal-button w-20 h-20" title="Check Connection">
                {isChecking ? (
                  <RefreshCw className="w-12 h-12 animate-pulse-sonar" />
                ) : (
                  <RefreshCw className="w-12 h-12" />
                )}
              </button>

              <button onClick={checkPing} disabled={isPinging || !isOnline} className="terminal-button w-20 h-20" title="Ping Test">
                {isPinging ? (
                  <Zap className="w-12 h-12 animate-pulse-sonar" />
                ) : (
                  <Zap className="w-12 h-12" />
                )}
              </button>

              <button onClick={runSpeedTest} disabled={isSpeedTesting || !isOnline} className="terminal-button w-20 h-20" title="Speed Test">
                {isSpeedTesting ? (
                  <Activity className="w-12 h-12 animate-pulse-sonar" />
                ) : (
                  <Activity className="w-12 h-12" />
                )}
              </button>
            </div>

            {/* Speed Test Graph */}
            {(isSpeedTesting || speedTestSamples.length > 0) && (
              <div className="mb-6">
                <div className="text-lg mb-4">
                  {isSpeedTesting && downloadSpeed !== null 
                    ? `Current Speed: ${downloadSpeed.toFixed(1)} MBPS`
                    : downloadSpeed !== null 
                      ? `Throughput: ${downloadSpeed.toFixed(1)} MBPS`
                      : "Speed Test Graph"
                  }
                </div>
                <div 
                  ref={speedGraphRef}
                  className="w-full h-52 bg-black border border-[#00cc00] p-2"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(0, 255, 0, 0.05) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(0, 255, 0, 0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }}
                >
                  {speedTestSamples.length === 0 && !isSpeedTesting && (
                    <div className="flex items-center justify-center h-full text-[#00ff41] opacity-70">
                      NO DATA TO DISPLAY
                    </div>
                  )}
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
                <div className="text-lg mb-4">Telemetry Data:</div>
                <div className="font-mono text-sm max-h-60 overflow-y-auto scrollbar-hide border border-[#333] bg-black/50">
                  <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-[#333]">
                    <div className="flex opacity-70 p-2 text-[#00ff41] text-xs sm:text-sm">
                      <div className="w-16 sm:w-24 text-left truncate">STATUS</div>
                      <div className="w-20 sm:w-32 text-left truncate">IP</div>
                      <div className="flex-1 text-left truncate">TIME</div>
                    </div>
                  </div>
                  <div>
                    {connectionLogs.map((log, index) => (
                      <div key={index} className={`flex p-2 text-xs sm:text-sm ${getLogStatusColor(log)} hover:bg-black/30 transition-colors`}>
                        <div className="w-16 sm:w-24 truncate">{getLogStatusDisplay(log)}</div>
                        <div className="w-20 sm:w-32 truncate" title={log.ip}>{log.ip}</div>
                        <div className="flex-1 truncate" title={formatDateTime(log.timestamp)}>{formatDateTime(log.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Settings at Bottom */}
            <div className="mt-8 text-center">
              <button onClick={toggleAnimation} className="terminal-button">
                {animationEnabled ? "VT100 graphics subsystem OFF" : "VT100 graphics subsystem ON"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}