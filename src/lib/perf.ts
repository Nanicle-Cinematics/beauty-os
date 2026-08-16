import "server-only";

const DEFAULT_SLOW_MS = 600;

export async function timeDataLoad<T>(label: string, load: () => Promise<T>, slowMs = DEFAULT_SLOW_MS): Promise<T> {
  const start = performance.now();
  try {
    return await load();
  } finally {
    const duration = Math.round(performance.now() - start);
    if (duration >= slowMs) {
      console.warn(`[perf] ${label} loaded in ${duration}ms`);
    }
  }
}
