"use client"

import { useState, useEffect, useRef } from "react"
import { RefreshCw, Clock, Globe, Zap } from "lucide-react"

interface ConnectionLog {
  ip: string
  timestamp: string
  status: "online" | "offline" | "ping"
  pingTime?: number
}

export default function InternetChecker() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [currentIP, setCurrentIP] = useState<string>("")
  const [pingTime, setPingTime] = useState<number | null>(null)
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([])
  const [lastChecked, setLastChecked] = useState<string>("")
  const [animationEnabled, setAnimationEnabled] = useState(true)
  const [statusText, setStatusText] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const [currentStatusType, setCurrentStatusType] = useState<"connection" | "ping">("connection")
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

      // Use Cloudflare's speed test endpoint which automatically routes to nearest location
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

  const logConnection = (ip: string, status: "online" | "offline" | "ping", pingMs?: number | null) => {
    const newLog: ConnectionLog = {
      ip,
      timestamp: new Date().toLocaleString(),
      status,
      pingTime: pingMs || undefined,
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
    if (currentStatusType === "ping" && pingTime !== null) {
      if (pingTime < 100) return "text-[#00ff41]" // Green - Excellent
      if (pingTime < 150) return "text-orange-300" // Light orange
      if (pingTime < 200) return "text-orange-400" // Orange
      if (pingTime < 300) return "text-orange-500" // Darker orange
      if (pingTime < 500) return "text-red-400" // Light red
      return "text-red-500" // Red - Very High
    }
    return isOnline ? "text-[#00ff41]" : "text-red-500"
  }

  const getLogStatusDisplay = (log: ConnectionLog) => {
    if (log.status === "ping") {
      return log.pingTime ? `${log.pingTime}ms` : "PING FAIL"
    }
    return log.status === "online" ? "ONLINE" : "OFFLINE"
  }

  const getLogStatusColor = (log: ConnectionLog) => {
    if (log.status === "ping") {
      if (!log.pingTime) return "text-red-500"
      if (log.pingTime < 100) return "text-[#00ff41]" // Green - Excellent
      if (log.pingTime < 150) return "text-orange-300" // Light orange
      if (log.pingTime < 200) return "text-orange-400" // Orange
      if (log.pingTime < 300) return "text-orange-500" // Darker orange
      if (log.pingTime < 500) return "text-red-400" // Light red
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
            <div className="flex justify-center items-center gap-4 mb-6">
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
            </div>

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
                        <th className="text-left w-32">IP ADDRESS</th>
                        <th className="text-left">TIMESTAMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connectionLogs.map((log, index) => (
                        <tr key={index} className={getLogStatusColor(log)}>
                          <td className="w-20">{getLogStatusDisplay(log)}</td>
                          <td className="w-32">{log.ip}</td>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
