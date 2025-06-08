import { NextResponse } from "next/server"

export async function GET() {
  try {
    const startTime = Date.now()

    // Use Cloudflare's speed test endpoint which automatically routes to the closest server
    const response = await fetch("https://speed.cloudflare.com/__down?bytes=1", {
      method: "GET",
      cache: "no-cache",
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
        error: "Ping timeout or failed",
      },
      { status: 500 },
    )
  }
}
