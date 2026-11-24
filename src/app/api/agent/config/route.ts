import { route } from "@/server/http";
import { LLM_MODELS, MODES, agentAllowed, hermesEngine, limits, serviceMode } from "@/server/agent/config";
import { ensureAgent } from "@/server/agent/loop";

/** GET /api/agent/config  The composer's choices: agent modes, assistant models, limits. */
export const GET = route(({ user }) => {
  ensureAgent();
  const engine = hermesEngine();
  return {
    modes: MODES,
    defaultMode: "ask",
    // An outside engine picks its own model, so there is one choice: the engine itself.
    models: engine ? [{ id: "auto", name: engine.name, description: "Runs on a Hermes agent.", tier: "standard" }] : LLM_MODELS,
    defaultModel: "auto",
    engine: engine ? { id: "hermes", name: engine.name } : { id: "builtin", name: "Built-in" },
    services: { llm: serviceMode("llm"), computer: serviceMode("computer"), connectors: serviceMode("connectors") },
    // False when the agent is live and this member is not on AGENT_ALLOWED_EMAILS.
    allowed: agentAllowed(user),
    limits: { maxSteps: limits.maxSteps(), turnSeconds: Math.round(limits.turnMs() / 1000), maxSchedules: limits.maxSchedules, messageMaxLength: 20_000, maxFilesPerMessage: 10 },
  };
});
