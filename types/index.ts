// Core types for SMGE application

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthCheckResponse {
  status: "ok" | "error";
  timestamp: string;
  services: {
    database: "connected" | "disconnected";
    api: "online" | "offline";
  };
}
