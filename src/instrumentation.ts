export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureProductionStartup } = await import("@/lib/startup-checks");
    ensureProductionStartup();
  }
}
