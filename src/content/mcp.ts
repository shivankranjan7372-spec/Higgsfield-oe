/**
 * Words and lists for the MCP page (/mcp) and the developer console (/developer).
 * The facts (tool names, scopes, arguments, the server address) come from
 * docs/api/developer.md. Layout comes from the design; every word here is ours.
 */
import { brand } from "@/config/brand";

/** The four ways to connect, shown as the tab bar under the nav and in the connect panel. */
export type ClientId = "config" | "terminal" | "python" | "other";

export const clients: { id: ClientId; label: string; blurb: string }[] = [
  { id: "config", label: "Config file", blurb: "For desktop assistants and editors that read an MCP server list." },
  { id: "terminal", label: "Terminal", blurb: "Talk to the server with curl to see what it answers." },
  { id: "python", label: "Python", blurb: "Call a tool from your own script with plain HTTP." },
  { id: "other", label: "Any client", blurb: "Anything that speaks MCP over Streamable HTTP and can send a header." },
];

export const hero = {
  line1: "Generate",
  line1Accent: "images & video",
  line2a: "in",
  line2b: "your agent with",
  line2c: brand.name,
  primary: `Add ${brand.name} to your agent`,
  secondary: "How to connect?",
};

export type ToolGroup = "models" | "generations" | "files" | "account";
export type Scope = "read" | "generate";

export interface ToolInfo {
  name: string;
  title: string;
  scope: Scope;
  group: ToolGroup;
  args: string;
  returns: string;
  description: string;
  /** Example arguments for the copyable tools/call body. */
  example: Record<string, unknown>;
}

/** The real tool list (`tools/list`), in the server's order. */
export const tools: ToolInfo[] = [
  {
    name: "list_models",
    title: "List models",
    scope: "read",
    group: "models",
    args: "kind?",
    returns: "{ models }",
    description: "Every model that can run right now, for images, video, speech or music. Your agent picks one from here.",
    example: { kind: "image" },
  },
  {
    name: "get_model",
    title: "Read one model",
    scope: "read",
    group: "models",
    args: "modelId",
    returns: "{ model }",
    description: "The model's prompt rules, media slots and controls, so the agent can fill in a draft that will pass.",
    example: { modelId: "flux-schnell" },
  },
  {
    name: "quote",
    title: "Price a draft",
    scope: "read",
    group: "generations",
    args: "modelId, prompt?, values?, inputs?, count?",
    returns: "the quote",
    description: "The exact price before anything runs, and whether your balance covers it. Nothing is queued.",
    example: { modelId: "flux-schnell", prompt: "a lighthouse in fog", count: 1 },
  },
  {
    name: "generate",
    title: "Start a generation",
    scope: "generate",
    group: "generations",
    args: "modelId, prompt?, values?, inputs?, count?",
    returns: "{ generations }",
    description: "Queues the work through the same path as the studio. Same prices, same limits, same results.",
    example: { modelId: "flux-schnell", prompt: "a lighthouse in fog" },
  },
  {
    name: "get_generation",
    title: "Check a generation",
    scope: "read",
    group: "generations",
    args: "id",
    returns: "{ generation }",
    description: "Its status, and the finished files once it has succeeded. The agent polls this after generate.",
    example: { id: "job_..." },
  },
  {
    name: "list_generations",
    title: "List generations",
    scope: "read",
    group: "generations",
    args: "status?, kind?, limit?, before?",
    returns: "{ generations }",
    description: "Recent work from the studio, the API and agents alike, newest first, up to 50 at a time.",
    example: { status: "active", limit: 10 },
  },
  {
    name: "list_files",
    title: "List files",
    scope: "read",
    group: "files",
    args: "kind?, source?, limit?, before?",
    returns: "{ files }",
    description: "Your generated files and uploads, so the agent can reuse one as a reference.",
    example: { kind: "image", limit: 10 },
  },
  {
    name: "get_balance",
    title: "Check the balance",
    scope: "read",
    group: "account",
    args: "none",
    returns: "{ balance, credits, plan }",
    description: "Credits left and the plan, so the agent can stop before it runs out.",
    example: {},
  },
];

export const toolGroups: { id: ToolGroup | "all"; label: string }[] = [
  { id: "all", label: "All tools" },
  { id: "models", label: "Models" },
  { id: "generations", label: "Generations" },
  { id: "files", label: "Files" },
  { id: "account", label: "Account" },
];

export const scopeFilters: { id: Scope; label: string }[] = [
  { id: "read", label: "Read scope" },
  { id: "generate", label: "Generate scope" },
];

export const toolsSection = {
  title: "Tools your agent gets",
  search: "Search tools",
  spendsBadge: "Credits",
  copy: "Copy call",
  copied: "Copied",
  more: "Reference",
  argsLabel: "Arguments",
  returnsLabel: "Returns",
  empty: "No tool matches that search.",
  clear: "Clear search",
};

export type IdeaKind = "image" | "video" | "audio" | "account";

/** Example asks to give an agent. Each card copies its prompt. */
export const ideas: { id: string; title: string; kind: IdeaKind; tools: [string, string]; prompt: string }[] = [
  {
    id: "storyboard",
    title: "Sketch a six-frame storyboard",
    kind: "image",
    tools: ["list_models", "generate"],
    prompt: `Use ${brand.name} to make six 16:9 frames that tell a short story about a lighthouse keeper.`,
  },
  {
    id: "price-first",
    title: "Price a batch before running it",
    kind: "image",
    tools: ["quote", "generate"],
    prompt: `Quote four square images of a ceramic mug on ${brand.name}, then run them only if it costs under 5 credits.`,
  },
  {
    id: "teaser",
    title: "Turn a still into a short clip",
    kind: "video",
    tools: ["list_files", "generate"],
    prompt: `Take my latest ${brand.name} image and animate it into a five-second clip with a slow push in.`,
  },
  {
    id: "voice",
    title: "Voice a product walkthrough",
    kind: "audio",
    tools: ["get_model", "generate"],
    prompt: `Read this script aloud with a ${brand.name} speech model and give me the file when it is ready.`,
  },
  {
    id: "theme",
    title: "Score a loop for a game level",
    kind: "audio",
    tools: ["list_models", "get_generation"],
    prompt: `Make a 30-second calm music loop for a forest level with ${brand.name} and wait until it is done.`,
  },
  {
    id: "budget",
    title: "Report what is left to spend",
    kind: "account",
    tools: ["get_balance", "list_generations"],
    prompt: `Tell me my ${brand.name} balance and list what is still running.`,
  },
];

export const ideaTabs: { id: IdeaKind | "all"; label: string }[] = [
  { id: "all", label: "Popular" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "account", label: "Account" },
];

export const ideasSection = {
  title: "Things to ask with",
  titleAfter: brand.name,
  copyHint: "Copy prompt",
  copied: "Prompt copied",
};

export const connect = {
  title: "Connect in two steps",
  step1: "Create an API key",
  step1Body: "Keys live in the developer console. Give the key both scopes so your agent can start work and read the results.",
  step1Cta: "Open the console",
  step2: "Add the server to your client",
  urlLabel: "Server address",
  headerLabel: "Header",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed. Select the text and copy it yourself.",
  keyPlaceholder: "YOUR_KEY",
  notes: [
    "Streamable HTTP with JSON-RPC 2.0. One JSON answer per request, no sessions, no event stream.",
    "Protocol revisions 2026-07-28, 2025-11-25, 2025-06-18 and 2025-03-26.",
    "Each key may make 120 requests a minute. Every call shows up in your usage log.",
  ],
  dialogTitle: `Add ${brand.name} to your agent`,
};

export function snippetFor(client: ClientId, url: string, key = connect.keyPlaceholder): string {
  switch (client) {
    case "config":
      return JSON.stringify(
        { mcpServers: { [brand.name.toLowerCase()]: { type: "http", url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      );
    case "terminal":
      return [
        `curl -s -X POST ${url} \\`,
        `  -H "Authorization: Bearer $PARALLAX_KEY" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -H "MCP-Protocol-Version: 2025-11-25" \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      ].join("\n");
    case "python":
      return [
        "import os, requests",
        "",
        `r = requests.post("${url}",`,
        '    headers={"Authorization": f"Bearer {os.environ[\'PARALLAX_KEY\']}",',
        '             "MCP-Protocol-Version": "2025-11-25"},',
        '    json={"jsonrpc": "2.0", "id": 1, "method": "tools/call",',
        '          "params": {"name": "get_balance", "arguments": {}}})',
        'print(r.json()["result"]["structuredContent"])',
      ].join("\n");
    case "other":
      return [`URL:        ${url}`, "Transport:  Streamable HTTP (JSON answers)", `Header:     Authorization: Bearer ${key}`].join("\n");
  }
}

export function toolCallBody(tool: ToolInfo): string {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool.name, arguments: tool.example } }, null, 2);
}

/* ------------------------------------------------------------------ developer console */

export const dev = {
  title: "Developer console",
  intro: `Keys, usage and webhooks for the ${brand.name} API and MCP server.`,
  tabs: [
    { id: "keys", label: "API keys" },
    { id: "usage", label: "Usage" },
    { id: "webhooks", label: "Webhooks" },
    { id: "reference", label: "Reference" },
  ] as const,
  signedOut: {
    title: `Build with ${brand.name}`,
    body: "Create API keys, watch every call your code and agents make, and get a webhook when a generation finishes. Sign in with a free account to start.",
    cta: "Create account",
    login: "Log in",
    guest: "You are using a guest account. Create a free account to make API keys and webhooks.",
    points: [
      "REST API for models, prices, generations and files",
      "MCP server for AI agents, with the same keys",
      "Signed webhooks with retries and a delivery log",
    ],
  },
  keys: {
    title: "API keys",
    blurb: "A key works for both the REST API and the MCP server. Keep it secret.",
    create: "Create key",
    name: "Name",
    namePlaceholder: "Untitled key",
    scopes: "Scopes",
    scopeHelp: { read: "Read models, prices, generations, files and balance.", generate: "Start and cancel generations and upload files." },
    expiry: "Expiry",
    empty: "No keys yet. Create one to call the API or connect an agent.",
    secretTitle: "Copy your new key now",
    secretWarn: "This is the only time the key is shown. We keep only a fingerprint of it, so it cannot be shown again. If you lose it, revoke it and make a new one.",
    done: "I have saved it",
    rename: "Rename",
    revoke: "Revoke",
    revokeTitle: "Revoke this key?",
    revokeBody: "Anything using it stops working at once. This cannot be undone.",
    revoked: "Revoked",
    neverUsed: "Never used",
    lastUsed: "Last used",
    created: "Created",
    save: "Save",
    cancel: "Cancel",
    of: (n: number, limit: number) => `${n} of ${limit} active`,
  },
  usage: {
    title: "Usage",
    blurb: "Every call made with your keys in the last 30 days, newest first.",
    allKeys: "All keys",
    keyFilter: "Key",
    last24: "Last 24 hours",
    requests: "Requests",
    errors: "Errors",
    credits: "Credits held",
    empty: "No calls yet. Calls made with your keys show up here.",
    more: "Load more",
    cols: ["Time", "Key", "Method", "Route", "Status", "Credits"],
  },
  hooks: {
    title: "Webhooks",
    blurb: "We POST signed JSON to your endpoint when a generation finishes, fails or is canceled.",
    create: "Add endpoint",
    url: "Endpoint URL",
    urlPlaceholder: "https://example.com/parallax-hook",
    description: "Description",
    events: "Events",
    enabled: "Enabled",
    empty: "No endpoints yet. Add one to hear about finished generations without polling.",
    secretTitle: "Copy the signing secret now",
    secretWarn: "This is the only time the secret is shown. Use it to check the Parallax-Webhook-Signature header.",
    edit: "Edit",
    delete: "Delete",
    deleteTitle: "Delete this endpoint?",
    deleteBody: "Its delivery log is deleted with it.",
    rotate: "Rotate secret",
    rotateBody: "The old secret stops working at once.",
    test: "Send test",
    deliveries: "Deliveries",
    noDeliveries: "No deliveries yet. Send a test event to try the endpoint.",
    retry: "Retry",
    more: "Load more",
  },
  reference: {
    title: "REST reference",
    blurb: "Every public route, read from the live OpenAPI document. Send your key as a bearer token.",
    openapi: "OpenAPI JSON",
    scope: "Scope",
    params: "Parameters",
    body: "Body",
    example: "Example",
  },
  retry: "Try again",
};
