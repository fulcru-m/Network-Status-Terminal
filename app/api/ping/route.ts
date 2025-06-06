import { NextResponse } from "next/server"

export async function GET() {
  try {
    const startTime = Date.now()

    // Use a more reliable endpoint for ping testing
    const response = await fetch("https://httpbin.org/status/200", {
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
