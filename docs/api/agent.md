# Agent API (agent chat)

The agent is Parallax's agent chat. A member talks to an assistant that plans and runs
creative work: it generates images, video, speech and music with any registry model, uses
files from the member's library, drives a cloud computer, and acts in connected apps.

Everything lives under `/api/agent`. You build the screens from this page alone.

## Contents

1. [Concepts](#concepts): chats, turns, rows, cards, modes
2. [Live updates](#live-updates): the event stream and catching up
3. [Row reference](#row-reference): every row and card body
4. [Routes](#routes)
5. [Errors](#errors)
6. [Tables](#tables)
7. [Engines](#engines): the built-in loop, or a Hermes agent
8. [Configuration](#configuration)
9. [Open improvements](#open-improvements)

All routes need a signed-in member (guests count) unless marked **public**. Writes from
another site are refused with 403. Errors use the shared shape:

```json
{ "error": { "code": "not_found", "message": "That chat does not exist." } }
```

`message` is written for the member. You can show it as it is. A member asking for another
member's chat, card, project, skill, memory, schedule or server gets **404**, never 403.
Times are Unix milliseconds. Credit amounts are millicredits (1 credit = 1000).

---

## Concepts

**Chat.** A conversation. It can be pinned and renamed. It can belong to one **project**
and have **skills** attached. An **incognito** chat writes nothing to memory and is
deleted when it is closed.

```json
{
  "id": "sch_…", "title": "Launch poster", "projectId": null, "skillIds": ["skill-brand-kit"],
  "pinned": false, "incognito": false,
  "state": "idle",            // idle | running | waiting (a card is waiting for the member)
  "rev": 42,                  // the chat's newest updatedSeq
  "createdAt": 1794560000000, "updatedAt": 1794560100000
}
```

**Turn.** Each posted message queues one turn. A chat runs one turn at a time. Messages
sent during a turn wait in a queue (at most 5). A turn streams the model's reply, runs the
model's tool calls, and repeats until the model answers. It also ends when the member
stops it or a limit is reached (12 model steps, or 5 minutes of working time). Time spent
waiting for the member does not count toward the 5 minutes.

```json
{ "id": "stn_…", "chatId": "sch_…", "status": "done", "mode": "ask", "model": "auto",
  "steps": 2, "createdAt": 0, "startedAt": 0, "finishedAt": 0 }
```
`status`: `queued | running | waiting | done | failed | stopped | interrupted`.

**Rows.** A transcript is a list of rows. Each row has:

| Field | Meaning |
|---|---|
| `seq` | Position in the chat, 1, 2, 3… Never changes. |
| `updatedSeq` | The chat's revision when this row last changed. Grows with every write in the chat. |
| `kind` | `message`, `tool-call`, `card`, `event` or `notice` |
| `body` | JSON object. Shape depends on `kind`; see the [row reference](#row-reference). |
| `chatId`, `createdAt` | |

A streaming reply is **the same row written again** with a higher `updatedSeq`. The client
keeps a map `seq → row` and **upserts** every row it receives. Render the rows sorted by `seq`.

**Modes** (sent with each message):

- `ask`, **Ask before generating** (default): every `generate_media` call first posts an
  approval card with the model, prompt and price. No credits move until the member taps Allow.
- `auto`, **Generate without asking**: generations start at once and spend credits.

Scheduled runs always use `ask`.

**Cards** pause the turn until the member answers:

- `approval`: a generation or an app action. The answer is `allow`, `always` or `deny`.
- `question`: the assistant asks something, with choices. The answer is a `choice`.

Answers go only through `POST /api/agent/approvals/:id`. Nothing the model writes can grant
an approval. When the member sends a new message, any card still waiting in that chat
expires. Unanswered cards expire after 30 minutes.

**Assistant model.** `model` is `auto` (the server picks) or one of the ids from
`GET /api/agent/config`. These are assistant models, separate from the media models in the
registry.

---

## Live updates

### `GET /api/agent/events`: Server-Sent Events

One stream per member carries every chat. Open it once when the app loads (`new
EventSource("/api/agent/events")`; the session cookie is sent automatically). Each member
can have up to 4 open streams, for example several tabs. When a fifth opens, the oldest
closes.

| `event:` | `data` | When |
|---|---|---|
| `ready` | `{ "at": 1794560000000 }` | Right after connecting |
| `row` | a [Row](#row-reference) | A row was added or rewritten. Upsert by `chatId` + `seq` |
| `chat` | `{ "chat": Chat }` | A chat was created, renamed, pinned, or changed `state` |
| `chat-deleted` | `{ "chatId": "sch_…" }` | A chat was deleted, or an incognito chat was closed |
| `computer` | [ComputerStatus](#get-apiagentcomputer) | The cloud computer changed state or took a screenshot |

A `: ping` comment is sent every 20 s. Rows that arrive in a burst can be applied in any
order, because the client upserts by `seq`.

### Catching up

When the stream reconnects, or a chat opens, call
`GET /api/agent/chats/:id/rows?after=<highest updatedSeq you hold for that chat>`.
Use `after=0` for the full transcript.

---

## Row reference

### `message`

```json
{ "role": "user", "text": "make a poster", "fileIds": ["ast_…"],
  "files": [{ "id": "ast_…", "kind": "image", "url": "/api/assets/ast_…/file", "posterUrl": null }],
  "mode": "ask" }
```
```json
{ "role": "assistant", "text": "Let me set that up.", "streaming": false }
```
`streaming: true` means the text is still growing. The same row arrives again with more text.

### `tool-call`

One activity line per tool the assistant used:

```json
{ "tool": "computer_open_page", "input": { "url": "https://…" }, "status": "done", "summary": "Opened duckduckgo.com/" }
```
`status`: `running | done | error`. `summary` is a short line you can show as is. `input`
is clipped to short strings. Tool names:

| Tool | What it does |
|---|---|
| `generate_media` | Generates media. Posts an approval card (in `ask` mode) and a result card |
| `list_models`, `get_model`, `quote` | Read the media model registry |
| `search_library`, `get_asset` | Read the member's own files |
| `computer_screenshot`, `computer_click`, `computer_type`, `computer_key`, `computer_scroll`, `computer_open_page`, `computer_shell` | Use the member's cloud computer |
| `list_connectors`, `connect_app` | List apps; ask the member to connect one (posts a connect card) |
| `app_<ACTION>` | A connected app's own action, for example `app_MAIL_SEND_EMAIL` |
| `remember`, `recall` | The member's memory |
| `ask_user` | Posts a question card |
| `schedule_chat` | Proposes a scheduled chat (posts an approval card) |
| `engine.<name>` | A tool of the outside engine's own, for example `engine.terminal`. Only on the [Hermes engine](#engines). `input` is always `{}` and `summary` is a readable name such as "Terminal". Show `summary`, not `tool` |

### `card`, approval for a generation

```json
{
  "card": "approval", "approvalId": "sap_…", "tool": "generate_media", "status": "pending",
  "title": "Generate with Flux Schnell", "modelId": "flux-schnell", "modelName": "Flux Schnell",
  "kind": "image", "prompt": "a blue heron", "count": 1,
  "price": 4200, "priceLabel": "4.2 credits",
  "choices": ["allow", "deny"]
}
```
`status`: `pending | allowed | denied | expired`. After an answer it also carries `decision`.
`price` is in millicredits.

### `card`, approval for an app action

```json
{
  "card": "approval", "approvalId": "sap_…", "tool": "app_MAIL_SEND_EMAIL", "status": "pending",
  "title": "Use mail: MAIL_SEND_EMAIL", "app": "mail", "action": "MAIL_SEND_EMAIL",
  "description": "Send an email.", "args": { "to": "sam@example.com", "body": "…" },
  "choices": ["allow", "always", "deny"]
}
```
`always` stores a per-member rule for that tool, so later calls run without a card.
Disconnecting the app clears its rules. Read-only app actions (list, get, search…) never
ask. `schedule_chat` cards have the same shape, with `prompt` and `intervalMinutes` and
choices `allow`/`deny`.

### `card`, question

```json
{ "card": "question", "approvalId": "sap_…", "tool": "ask_user", "status": "pending",
  "question": "Which palette?", "choices": ["Pastel", "Bold"] }
```
After the answer it has `status: "answered"` and `answer`. The member may also type a
free answer.

### `card`, result

```json
{
  "card": "result", "status": "succeeded",           // running | succeeded | partial | failed
  "modelId": "flux-schnell", "modelName": "Flux Schnell", "prompt": "a blue heron",
  "cost": 4200, "jobIds": ["job_…"], "assetIds": ["ast_…"],
  "files": [{ "id": "ast_…", "kind": "image", "url": "/api/assets/ast_…/file", "posterUrl": null, "width": 1024, "height": 768 }],
  "errors": []
}
```
The card is posted as `running` and rewritten when the jobs finish. If the job could not
start (for example, not enough credits), the card arrives already `failed`, with `message`.
The jobs also appear in `/api/jobs` with `surface: "super"` and `meta.superChatId`.

### `card`, connect

```json
{ "card": "connect", "app": "mail", "reason": "to send email for you",
  "url": "https://…", "status": "pending" }
```
Open `url` in a new window. The member returns to the page `/agent/connect/<app>`,
which calls the callback route below to complete the connection and then closes itself. `status: "active"` means the app is already connected.

### `event`

```json
{ "event": "schedule-run", "scheduleId": "ssc_…", "text": "Scheduled run of \"Daily moon\"." }
```
`event`: `schedule-created | schedule-run`. Show `text`.

### `notice`

```json
{ "level": "error", "code": "turn_failed", "text": "Something went wrong with this reply. Try again." }
```
`level`: `info | warning | error`. `code`: `stopped`, `turn_failed`, `time_limit`,
`step_limit`, `declined`, `too_long`, `interrupted` (a restart cut the turn off),
`schedule_failed`. Show `text`.

---

## Routes

### Configuration and showcase

#### `GET /api/agent/config`
The composer's options.
```json
{
  "modes": [{ "id": "ask", "name": "Ask before generating", "description": "…" }, { "id": "auto", … }],
  "defaultMode": "ask",
  "models": [{ "id": "auto", "name": "Auto", "description": "…", "tier": "standard" },
             { "id": "claude-opus-5-5", "name": "Claude Opus 5.5", "tier": "high" }, …],
  "defaultModel": "auto",
  "services": { "llm": "mock", "computer": "mock", "connectors": "mock" },
  "engine": { "id": "builtin", "name": "Built-in" },
  "limits": { "maxSteps": 12, "turnSeconds": 300, "maxSchedules": 10, "messageMaxLength": 20000, "maxFilesPerMessage": 10 }
}
```
`tier` (`standard|low|medium|high`) is a cost hint for the model picker. `services` shows
`mock` while a service is not live. You may want to show a "demo" badge in that case.
`engine` says what runs the chat: `builtin`, or `hermes` with the agent's display name. On
the Hermes engine `models` has one entry, `auto`, named after the agent, and `services.llm`
is `live`.

#### `GET /api/agent/showcase`: **public**
Example prompts for the home gallery.
```json
{ "items": [{ "id": "sc-lighthouse", "category": "Marketing", "title": "Launch poster",
              "prompt": "Generate an image of …", "skillId": "skill-brand-kit" }, …],
  "categories": ["All", "Marketing", "Explainer videos", "Apps", "Games"] }
```
"Recreate" fills the composer with `prompt`. Use `skillId` when you create the chat.

### Chats

#### `GET /api/agent/chats?projectId=&pinned=1&search=&limit=50&before=`
`{ "chats": Chat[] }`. Pinned chats come first, then the newest by `updatedAt`. To page,
pass `before` = the last chat's `updatedAt`. `search` matches the title (100 characters at
most). Open incognito chats are listed with `incognito: true`.

#### `POST /api/agent/chats`
Body: `{ "title"?: string ≤80, "projectId"?: string, "skillIds"?: string[] ≤10, "incognito"?: boolean }`
→ `{ "chat": Chat }`. If no title is given, the first message sets one.
Errors: 400 for bad fields, or an incognito chat in a project. 404 for an unknown project
or skill. 400 at 500 chats.

#### `GET /api/agent/chats/:id`
→ `{ "chat": Chat, "turns": Turn[] }`. Returns the last 20 turns, newest first.

#### `PATCH /api/agent/chats/:id`
Body (all optional): `{ "title": string 1–80, "pinned": boolean, "projectId": string|null, "skillIds": string[] }`
→ `{ "chat": Chat }`. Use it to rename, pin or unpin, move into or out of a project, and
attach skills (the list replaces the old one).

#### `DELETE /api/agent/chats/:id`
Stops any running turn and deletes the chat, its rows and its cards. → `{ "ok": true }`

#### `POST /api/agent/chats/:id/close`
Call it when the member leaves a chat. An incognito chat is deleted
(`{ "deleted": true }`, plus a `chat-deleted` event). Other chats are not changed
(`{ "deleted": false }`).

#### `POST /api/agent/chats/:id/messages`
```json
{ "text": "generate an image of a red fox", "fileIds": ["ast_…"], "mode": "ask", "model": "auto" }
```
`text` ≤ 20,000 characters (may be empty when `fileIds` is not). `fileIds` holds up to 10
of the member's own files. `mode` is `ask` (the default) or `auto`. `model` is `auto` (the
default) or an id from config.
→ `{ "turn": Turn, "row": Row }`. `row` is the member's own message row. The reply arrives
as rows on the stream.
Errors: 400 bad input or unknown model. 404 unknown chat or file. 429 `too_many_messages`
when 5 messages are already queued.

#### `POST /api/agent/chats/:id/stop`
Stops the running turn, drops queued ones, and expires waiting cards. → `{ "stopped": true|false }`.
A `notice` row with code `stopped` follows.

#### `GET /api/agent/chats/:id/rows?after=0&limit=200`
→ `{ "chat": Chat, "rows": Row[], "rev": number }`. Returns rows with `updatedSeq > after`,
oldest change first. `limit` ≤ 500. If there are more, call again with `after=rev`.

### Cards

#### `POST /api/agent/approvals/:approvalId`
For an approval card: `{ "decision": "allow" | "always" | "deny" }`. The decision must be
one of the card's `choices`.
For a question card: `{ "choice": "Pastel" }`. Free text is allowed, up to 500 characters.
→ `{ "ok": true, "status": "allowed" | "denied" | "answered" }`. The card row is rewritten
with the new status.
Errors: 400 for a decision the card does not offer. 404 for an unknown card or someone
else's card. 409 `already_answered` if the card was already answered or has expired.

### Projects

A project groups chats under shared instructions and files. The assistant reads both in
every chat of the project.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/agent/projects` | | `{ projects: Project[] }` |
| POST | `/api/agent/projects` | `{ name 1–80, instructions? ≤8000, fileIds? ≤50 }` | `{ project }` |
| GET | `/api/agent/projects/:id` | | `{ project, chats: Chat[] }` |
| PATCH | `/api/agent/projects/:id` | any of the POST fields | `{ project }` |
| DELETE | `/api/agent/projects/:id` | | `{ ok }`. Its chats stay, outside any project |

```json
{ "id": "spr_…", "name": "Spring launch", "instructions": "Pastel colours only.",
  "fileIds": ["ast_…"], "chatCount": 3, "createdAt": 0, "updatedAt": 0 }
```
`fileIds` must be the member's own files (404 otherwise). The limit is 100 projects.

### Skills

Skills are reusable instruction packs. Built-in skills come with Parallax and cannot be
changed. Members can add their own. Attach skills to a chat with
`PATCH /api/agent/chats/:id { skillIds }`, up to 10.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/agent/skills` | | `{ skills: Skill[] }`, built-ins first |
| POST | `/api/agent/skills` | `{ name 1–80, description? ≤300, instructions 1–8000 }` | `{ skill }` |
| PATCH | `/api/agent/skills/:id` | any of the POST fields | `{ skill }`. 404 for built-ins |
| DELETE | `/api/agent/skills/:id` | | `{ ok }`. 404 for built-ins |

```json
{ "id": "skill-storyboard", "name": "Storyboard first", "description": "…",
  "instructions": "…", "builtIn": true, "category": "Video" }
```
Custom skills have ids `skl_…` and `category: "Custom"`. The limit is 100.

### Connectors

#### `GET /api/agent/connectors?search=`
```json
{
  "apps": [{ "slug": "mail", "name": "Mail", "description": "Read and send email.",
             "category": "Email & calendar", "logoUrl": null, "status": "none" }, …],
  "connected": [{ "app": "mail", "status": "active", "connectedAt": 0 }],
  "mcpServers": [McpServer]
}
```
`status`: `none | pending | active`. Group the catalog by `category`. In mock mode there
are six apps. A live catalog has hundreds, so use `search`. 502 `connector_unavailable`
means the service is down.

#### `POST /api/agent/connectors/apps/:slug/connect`
→ `{ "url": "https://…", "connection": { "app", "status", "connectedAt" } }`. Open `url`
for the sign-in. In mock mode the connection is `active` at once. 404 for an unknown app.

#### `GET /api/agent/connectors/apps/:slug/callback?connected_account_id=`
The sign-in page sends the member back here. You can also call it to check status. It
trusts only the connection id stored for this member, and asks the service for the real
state. → `{ "connection": … }`. Errors: 404 if nothing is waiting, 400 if the id does not
match, 409 `connect_failed`. The sign-in window does not land here: it lands on the page
`/agent/connect/<app>?connected_account_id=…`, which calls this route.

#### `POST /api/agent/connectors/apps/:slug/disconnect`
→ `{ "ok": true }`. Also forgets that app's "always allow" rules. 404 if the app is not connected.

#### Custom MCP servers

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/agent/connectors/mcp` | | `{ servers: McpServer[] }` |
| POST | `/api/agent/connectors/mcp` | `{ name 1–60, url }` (https only, no user info, ≤500) | `{ server }` |
| DELETE | `/api/agent/connectors/mcp/:id` | | `{ ok }` |

`McpServer = { id, name, url, createdAt }`. Servers are **stored only**. Parallax does not
call them yet, so tell the member they are saved for later. The limit is 20.

### Memory

| Method | Path | Response |
|---|---|---|
| GET | `/api/agent/memory` | `{ memories: [{ id, text, chatId, createdAt }] }`, newest first |
| DELETE | `/api/agent/memory/:id` | `{ ok }` |

The assistant writes memory with its `remember` tool, except in incognito chats. The
newest 200 facts are kept.

### Schedules

A schedule posts its prompt into its own chat ("Scheduled: <title>") every N minutes. The
chat is made on the first run. Runs use the `ask` mode, so generations wait for the
member's approval. Due schedules are checked every 30 seconds.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/agent/schedules` | | `{ schedules: Schedule[] }` |
| POST | `/api/agent/schedules` | `{ title 1–80, prompt 1–4000, intervalMinutes 60–43200, runNow?: boolean }` | `{ schedule }` |
| PATCH | `/api/agent/schedules/:id` | `{ title?, prompt?, intervalMinutes?, enabled?, runNow? }` | `{ schedule }` |
| DELETE | `/api/agent/schedules/:id` | | `{ ok }`. The chat stays |

```json
{ "id": "ssc_…", "chatId": "sch_…", "title": "Daily moon", "prompt": "…", "intervalMinutes": 1440,
  "enabled": true, "nextRunAt": 0, "lastRunAt": null, "createdAt": 0 }
```
A member can have up to 10 schedules. The assistant can also propose one; the member
approves it on a card.

### Computer

Each member has one cloud computer. It is created the first time the assistant uses it
and suspended after 20 idle minutes. It wakes again on the next use.

#### `GET /api/agent/computer`
```json
{ "computer": { "status": "running", "lastUsedAt": 0, "screenshotAt": 0,
                "screenshotUrl": "/api/agent/computer/screenshot?v=1794560000000" } }
```
`status`: `none | creating | running | suspended | error`. The `computer` event pushes the
same object.

#### `GET /api/agent/computer/screenshot`
The latest screenshot as `image/png`. Returns 404 before the first one. A live screen viewer
is not part of this API yet.

---

## Errors

Shared codes: `unauthorized` 401, `forbidden` 403 (cross-site), `invalid_request` 400,
`not_found` 404, `server_error` 500. Codes specific to this feature:

| Code | Status | When |
|---|---|---|
| `too_many_messages` | 429 | 5 messages already queued in the chat |
| `already_answered` | 409 | Card already answered or expired |
| `connector_unavailable` | 502 | App service unreachable |
| `connect_failed` | 409 | The sign-in did not complete |

Problems inside a turn (no credits, model unavailable, tool failure) never fail the HTTP
request. They show up as rows: a failed result card, a tool-call row with `status: "error"`,
or a notice.

---

## Tables

From `migrations/080_super.sql`. Every table is keyed to `users(id)` with cascade delete.

| Table | Holds |
|---|---|
| `super_chats` | Chats: title, project, skills, pinned, incognito, state, `last_seq`, `rev` |
| `super_rows` | Transcript rows `(chat_id, seq)` with `updated_seq`, `kind`, JSON `body` |
| `super_llm` | The model's own history per chat, append-only, kept apart from the rows |
| `super_turns` | One row per posted message: status, mode, model, steps, error |
| `super_approvals` | Cards waiting for the member and their answers |
| `super_policies` | "Always allow" rules per member and tool |
| `super_projects` | Projects: name, instructions, file ids |
| `super_skills` | Custom skills. Built-ins live in code |
| `super_memories` | Remembered facts, up to 200 per member |
| `super_connections` | Connected apps per member: status and the service's connection id |
| `super_mcp_servers` | Stored custom MCP servers |
| `super_schedules` | Scheduled chats |
| `super_computers` | One row per member: the computer id, status and latest screenshot |

## Engines

The chat can run on one of two engines. Members see the same chat either way: the same
rows, cards, credits and approvals.

**Built-in** (the default). Parallax runs the loop itself: it calls the assistant model,
runs the tools it asks for, and repeats up to `AGENT_MAX_STEPS` times.

**Hermes** (`AGENT_ENGINE=hermes`). A Hermes agent runs the loop. Parallax sends each message to the agent's API server and shows its answer
as it streams. The agent reaches Parallax's tools over MCP, so media generation, the
member's library, memory, questions and schedules still run inside Parallax, as that
member, with their credits and their approval cards.

```
member ──▶ Parallax ──POST {HERMES_URL}/v1/responses (stream)──▶ Hermes agent
                ▲                                                    │
                └────────── POST /api/agent/mcp (tools) ◀────────────┘
```

### What Parallax sends

One request per message: `input` is the member's message, `instructions` is the same
system prompt the built-in engine uses plus a few notes for the agent, and `conversation`
is `parallax-<chatId>`, so the agent keeps the thread on its side. The agent's own persona
and settings stay as they are; the instructions are added on top for that one answer.

### `POST /api/agent/mcp`: the engine's tool server

MCP over Streamable HTTP, for the engine only. It answers **404** on the built-in engine.

- **Who may call.** `Authorization: Bearer <AGENT_ENGINE_TOKEN>`. Sessions and API keys are
  not accepted. A wrong token is 401, and repeated wrong tokens from one address are
  throttled (429).
- **Whose turn.** Every tool takes a required `turn` argument: a key Parallax makes for each
  message and gives to the agent in that message's instructions. A call with no key, a
  made-up key, or the key of a reply that has ended is refused as a tool error. The key is
  never stored, and it is cut out of the reply if the agent repeats it.
- **Tools.** `generate_media`, `list_models`, `get_model`, `quote`, `search_library`,
  `get_asset`, `remember`, `recall`, `ask_user`, `schedule_chat`. The `computer_*` tools are
  added only when the cloud computer is live. Connected apps are not offered to an outside
  engine.
- **Long calls.** A call can wait for an approval or a render. When the caller accepts
  `text/event-stream`, the answer is a stream with a comment line every 15 seconds, then one
  `message` event with the JSON-RPC result.

The agent sees the tools as `mcp__<HERMES_MCP_NAME>__<tool>`, for example
`mcp__parallax__generate_media`.

### Setting it up

1. On the agent's machine, turn on Hermes' API server and note its key (`API_SERVER_KEY`).
2. Make a long random engine token for Parallax (`openssl rand -hex 32`).
3. Add Parallax to the agent's `config.yaml`:
   ```yaml
   mcp_servers:
     parallax:
       url: https://<your-parallax>/api/agent/mcp
       headers:
         Authorization: "Bearer <the engine token>"
       timeout: 2100          # longer than AGENT_APPROVAL_MS
       connect_timeout: 30
   ```
4. Start Parallax with `AGENT_ENGINE=hermes`, `HERMES_URL`, `HERMES_API_KEY_FILE` and
   `AGENT_ENGINE_TOKEN_FILE`.

Both sides must reach each other: Parallax calls the agent, and the agent calls Parallax
back. When they are on private machines, one SSH tunnel with a local and a remote forward
does both: `deploy/tunnel.sh`. The full walk-through is
[`docs/hermes-on-orgo.md`](../hermes-on-orgo.md).

If a setting is missing, the server logs one line that names it and uses the built-in
engine.

### Read this before you point it at a personal agent

- **The agent's own tools are not behind Parallax's approval cards.** A Hermes agent often
  has a shell, file access, a browser and its own connected accounts. A chat can ask it to
  use them. They show in the chat as a step with a name only, and nothing asks the member
  first. Use an agent whose tools you would hand to everyone who can open the chat: a
  separate Hermes home with a narrow toolset is the safe choice for anything public.
- **The agent keeps the conversation.** Deleting a chat in Parallax does not delete it on
  the agent's side. An incognito chat tells the agent to save nothing, but the agent is not
  forced to obey.
- **Limits.** `AGENT_TURN_MS` still ends a reply that runs too long. `AGENT_MAX_STEPS` does
  not apply; the agent has its own limits. The step count on a turn is the number of tools
  that ran.
- **One model choice.** The picker shows the agent's name. The model is whatever the agent
  is set up to use.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AGENT_MODE` | (mock) | `live` turns on each service whose key is set |
| `AGENT_ENGINE` | (built-in) | `hermes` runs the chat on a Hermes agent. Works with any `AGENT_MODE` |
| `AGENT_ALLOWED_EMAILS` | (nobody) | Who may chat while the agent is live (any live service, or the Hermes engine): member emails, comma separated, or `*` for every signed-in member. Guests never. Unset means nobody. In mock mode everyone may. Others get `403 agent_restricted` |
| `HERMES_URL` | | The agent's API server, for example `http://127.0.0.1:8642` |
| `HERMES_API_KEY` or `HERMES_API_KEY_FILE` | | The agent's API key, or a file that holds it |
| `AGENT_ENGINE_TOKEN` or `AGENT_ENGINE_TOKEN_FILE` | | The token the agent sends to `/api/agent/mcp`. At least 24 characters |
| `AGENT_ENGINE_NAME` | `Hermes` | The name members see in the model picker |
| `HERMES_MODEL` | `hermes-agent` | The `model` field sent to the agent |
| `HERMES_MCP_NAME` | `parallax` | The name of the Parallax entry in the agent's `mcp_servers` |
| `ANTHROPIC_API_KEY` | | Assistant model key (live only) |
| `AGENT_LLM_MODEL` | `claude-opus-5-5` | The model used for `auto` |
| `ORGO_API_KEY`, `ORGO_WORKSPACE_ID` | | Cloud computer key and workspace (live only) |
| `COMPOSIO_API_KEY` | | Connected apps key (live only) |
| `PARALLAX_ORIGIN` | the request's own address | Public origin for connect links. Scheduled runs have no request, so they fall back to `http://localhost:3000` |
| `AGENT_MAX_STEPS`, `AGENT_TURN_MS`, `AGENT_APPROVAL_MS`, `AGENT_JOB_WAIT_MS`, `AGENT_COMPUTER_IDLE_MIN` | 12, 300000, 1800000, 600000, 20 | Limits |

## Open improvements

1. **A price that matches the job exactly.** `src/server/jobs.ts` should export
   `quoteSubmit(user, input): { millicredits, jobs }`. It would run the same validation and
   `quoteJob` call as `submitJobs`, with real `inputs`, but insert nothing. The approval
   card price is computed today by calling `quoteJob` with placeholder media. For a model
   whose price depends on the length of its reference files, the shown price could then
   differ from the charge. `submitJobs` stays the only path that charges.
2. **A hook when a job finishes.** For example `onJobDone(fn)` in `worker.ts`. A turn now
   checks its jobs with `getJob` once a second while it waits.
3. **A canonical public origin.** Done: `src/server/origin.ts` reads `PARALLAX_ORIGIN`
   (`publicOrigin(req)` for links, `sameOrigin(req)` for the cross-site check).
4. **A page for the connect callback.** Done: the link now lands on
   `/agent/connect/<app>`, which calls the callback route and closes the window.
