import { NextResponse } from "next/server";
import type { HealthCheckResponse } from "@/types";

export async function GET() {
  const response: HealthCheckResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "disconnected", // Will be updated when Supabase is configured
      api: "online",
    },
  };

  return NextResponse.json(response, { status: 200 });
}
