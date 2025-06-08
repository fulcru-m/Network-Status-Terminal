import { NextResponse } from "next/server"

export async function GET() {
  try {
    const startTime = Date.now()

    // Use Cloudflare's speed test endpoint which automatically routes to nearest edge location
    // This provides more accurate latency measurements to Cloudflare's network
    const response = await fetch("https://speed.cloudflare.com/__down?bytes=100", {
      method: "GET",
      cache: "no-cache",
      headers: {
        'User-Agent': 'NetworkChecker/1.0'
      }
    })

    const endTime = Date.now()
    const pingTime = endTime - startTime

    if (response.ok) {
      return NextResponse.json({
        success: true,
        ping: pingTime,
        timestamp: new Date().toISOString(),
      })
    } else {
      throw new Error("Ping failed")
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        ping: null,
        error: "Cloudflare ping timeout or failed",
      },
      { status: 500 },
    )
  }
}
