/**
 * Runs once when the server starts. It wakes the job worker and the feature loops, so work
 * that was queued or running before a restart carries on without waiting for the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureWorker } = await import("./server/worker");
  ensureWorker();

  // Each feature keeps its own loop. One that fails to start must not stop the others.
  const loops: [string, () => Promise<void>][] = [
    ["webhooks", async () => (await import("./server/developer/webhooks")).ensureDispatcher()],
    ["ads", async () => (await import("./server/ads/campaigns")).ensurePump()],
    ["cinema", async () => (await import("./server/cinema/batch")).pump()],
    ["agent", async () => (await import("./server/agent/loop")).ensureAgent()],
  ];
  for (const [name, start] of loops) {
    try {
      await start();
    } catch (err) {
      console.error(`[boot] ${name} loop did not start:`, err instanceof Error ? err.message : err);
    }
  }

  // Demo accounts and posts for a fresh install. Does nothing unless PARALLAX_DEMO_SEED=1.
  try {
    (await import("./server/demo-seed")).ensureDemoSeed();
  } catch (err) {
    console.error("[boot] the demo content was not added:", err instanceof Error ? err.message : err);
  }
}
