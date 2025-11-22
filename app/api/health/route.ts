import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { HealthCheckResponse } from "@/types";

export async function GET() {
  let databaseStatus: "connected" | "disconnected" = "disconnected";

  // Test database connectivity
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("_health")
      .select("status")
      .limit(1)
      .single();

    if (!error && data) {
      databaseStatus = "connected";
    }
  } catch {
    // Database connection failed, keep as disconnected
    databaseStatus = "disconnected";
  }

  const response: HealthCheckResponse = {
    status: databaseStatus === "connected" ? "ok" : "error",
    timestamp: new Date().toISOString(),
    services: {
      database: databaseStatus,
      api: "online",
    },
  };

  const statusCode = databaseStatus === "connected" ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
