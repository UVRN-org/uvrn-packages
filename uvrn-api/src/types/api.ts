/**
 * API-specific type definitions
 */

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  version: string;
  engine: {
    available: boolean;
  };
  timestamp: string;
}

export interface VersionResponse {
  apiVersion: string;
  engineVersion: string;
  protocolVersion: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
