import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Use external service to get real public IP
    const ipResponse = await fetch("https://api.ipify.org?format=json", {
      cache: "no-cache",
    })

    if (!ipResponse.ok) {
      throw new Error("Failed to fetch IP")
    }

    const ipData = await ipResponse.json()

    return NextResponse.json({
      status: "online",
      ip: ipData.ip,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // If we can't get IP, we're likely offline or have connection issues
    return NextResponse.json(
      {
        status: "error",
        message: "Connection check failed",
        ip: "Unable to retrieve",
      },
      { status: 500 },
    )
  }
}
