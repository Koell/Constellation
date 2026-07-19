export interface HealthPayload {
  status: string;
  orbitarium_version: string;
}

export function formatBackendStatus(payload: HealthPayload): string {
  return `backend ${payload.status} — orbitarium v${payload.orbitarium_version}`;
}
