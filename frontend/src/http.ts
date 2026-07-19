/** GET returning parsed JSON, retrying briefly on network errors and 5xx —
 * dev-server restarts leave a short window of failing proxied requests. */
export async function getJson<T>(
  url: string,
  attempts = 4,
  delayMs = 700,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const response = await fetch(url);
      if (response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`request failed: HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`${url} unreachable after ${attempts} attempts: ${String(lastError)}`);
}
