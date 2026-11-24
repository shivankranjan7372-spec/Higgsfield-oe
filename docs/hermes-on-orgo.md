# The agent chat on a Hermes agent, on Orgo

The agent is Parallax's agent chat. Out of the box it answers with a scripted stand-in
(`AGENT_MODE=mock`). This guide swaps in a real agent: a [Hermes](https://github.com/NousResearch/hermes-agent)
agent living on an [Orgo](https://www.orgo.ai) cloud computer runs the conversation, and
Parallax gives it the studio's tools.

```
member ──▶ Parallax ──POST /v1/responses (stream)──▶ Hermes agent (on an Orgo computer)
               ▲                                          │
               └────── POST /api/agent/mcp (tools) ◀──────┘
```

What you get:

- The agent thinks, plans and talks. It keeps the thread on its side.
- When it wants a picture, a video or audio, it calls Parallax's `generate_media` tool. The
  member sees an approval card with the price, and pays with their own credits.
- The generation key (Treg) stays inside Parallax. The agent never sees it.
- Members see one chat. The model picker shows your agent's name.

> **Status, honestly.** The engine is tested end to end against a stand-in agent that speaks
> the same API (`tests/agent_hermes.py`, 70 checks) and in a browser. It has **not** been run
> against a live Hermes agent yet, and `deploy/tunnel.sh` has not been used on a real pair of
> machines. Expect to fix small things. Reports and pull requests are welcome.

## What you need

- Parallax, built and running (see the [README](../README.md)). Node 22.13 or newer.
- A Hermes agent with its **API server** turned on. This guide was written against
  Hermes Agent v0.23.
- An Orgo computer for the agent to live on (any Linux machine works the same way).
- Ten minutes.

## Read this first: which agent?

**The agent's own tools are not behind Parallax's approval cards.** A Hermes agent usually
has a shell, file access, memory and its own connected accounts. Anyone who can open the
chat can ask it to use them. They show up in the chat as a step with a name, and nothing
asks first.

So:

- **Do not point a public Parallax at your personal agent.**
- For anything other people can open, make a **second, narrow Hermes home** (its own
  `HERMES_HOME`, a small toolset, no personal keys or memory) and use that.
- A personal agent is fine while you are the only one who can reach the app.

## Step 1. Turn on the agent's API server

On the agent's computer, in the agent's `.env` (usually `~/.hermes/.env`):

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=<a long random value>     # openssl rand -hex 32
# API_SERVER_PORT=8642                   # the default
# API_SERVER_HOST=127.0.0.1              # the default: this machine only. Keep it.
```

Restart the Hermes gateway, then check from the same computer:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8642/health        # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8642/v1/models     # 401 without the key
```

Names of these settings can change between Hermes versions. If yours differ, look for
"API server" in the Hermes docs.

## Step 2. Make the two secrets on the Parallax side

Parallax needs the agent's API key, and the agent needs a token to call Parallax back.
Keep both in files, not in your shell history:

```bash
mkdir -p deploy/run/engine && chmod 700 deploy/run/engine
( umask 077
  openssl rand -hex 32 > deploy/run/engine/engine.token     # the agent uses this to call Parallax
  cat > deploy/run/engine/hermes-api.key                    # paste API_SERVER_KEY, Enter, Ctrl-D
  echo "Hermes" > deploy/run/engine/name.txt                # the name members see
)
```

`deploy/run/` is ignored by git.

## Step 3. Let the two reach each other

Parallax calls the agent, and the agent calls Parallax back. Pick the case that fits.

### A. Same computer (simplest)

Run Parallax on the Orgo computer the agent lives on. Everything stays on `127.0.0.1`:

| | Address |
|---|---|
| Parallax → agent (`HERMES_URL`) | `http://127.0.0.1:8642` |
| agent → Parallax (the MCP `url`) | `http://127.0.0.1:3000/api/agent/mcp` |

```bash
echo "http://127.0.0.1:8642" > deploy/run/engine/url.txt
```

To open the app to a browser, make an Orgo public URL for Parallax's port (3000) and write
that address to `deploy/run/origin.txt`, for example `https://your-link.example`. Leave
port 8642 private.

### B. Two computers (Parallax here, the agent on Orgo)

Neither side needs a port open to the internet. One SSH connection carries both directions.

1. Turn on **Direct SSH** for the agent's Orgo computer (dashboard, or the
   `enable computer SSH` API call) with a key made for this purpose. Orgo may ask for a
   restart of the computer, which interrupts the agent, so pick a quiet moment.
2. Write `deploy/run/engine/ssh.conf` on the Parallax machine:
   ```
   Host agent
     HostName <host Orgo gives you>
     Port <port Orgo gives you>
     User root
     IdentityFile /absolute/path/to/deploy/run/engine/id_ed25519
     UserKnownHostsFile /absolute/path/to/deploy/run/engine/known_hosts
     IdentitiesOnly yes
   ```
3. Open the pipe and check it:
   ```bash
   deploy/tunnel.sh start
   deploy/tunnel.sh status      # process: yes, Parallax -> agent: yes
   ```

| | Address |
|---|---|
| Parallax → agent (`HERMES_URL`) | `http://127.0.0.1:18642` (the default, nothing to write) |
| agent → Parallax (the MCP `url`) | `http://127.0.0.1:13100/api/agent/mcp` |

`tunnel.sh` reads `PORT` if Parallax is not on 3000. "agent -> Parallax" turns to yes once
Parallax is running (step 5).

## Step 4. Give the agent Parallax's tools

Copy `deploy/add-parallax-to-hermes.py` and `engine.token` to the agent's computer and run
it there, with the Python that Hermes uses:

```bash
python3 add-parallax-to-hermes.py --token-file ./engine.token \
  --url http://127.0.0.1:13100/api/agent/mcp      # case B; use port 3000 for case A
rm ./engine.token
```

It adds this to the agent's `config.yaml`, keeps a dated copy of the old file, and refuses
to write if any other setting would change. `--dry-run` checks without writing; `--remove`
takes it out again.

```yaml
mcp_servers:
  parallax:
    url: "http://127.0.0.1:13100/api/agent/mcp"
    headers:
      Authorization: "Bearer <engine token>"
    timeout: 2100          # a render plus an approval can take many minutes
    connect_timeout: 30
```

Hermes picks up new MCP servers without a restart. The agent will see the tools as
`mcp__parallax__generate_media`, `mcp__parallax__list_models` and so on.

## Step 5. Start Parallax on the Hermes engine

```bash
npm run build
deploy/start.sh mock        # sample files, spends nothing. Drop "mock" for real generations.
```

The last line should end with `chat engine: Hermes (Hermes)`. `start.sh` switches engines by
itself when `deploy/run/engine/` holds both secret files; an empty file named `off` in that
folder switches back.

Not using the deploy scripts? These are the settings (`.env.local` or the environment):

```bash
AGENT_ENGINE=hermes
HERMES_URL=http://127.0.0.1:8642
HERMES_API_KEY_FILE=/absolute/path/to/hermes-api.key
AGENT_ENGINE_TOKEN_FILE=/absolute/path/to/engine.token
AGENT_ENGINE_NAME=Hermes
```

A live agent is closed to everyone until you name who may use it. Add your own account's
email (comma separate several; `*` means every signed-in member, never guests):

```bash
AGENT_ALLOWED_EMAILS=you@example.com
```

## Step 6. Try it

1. Open `/agent` and send: *"Make me a poster of a lighthouse at dusk."*
2. The model pill should show your agent's name once the chat exists.
3. The agent should call `generate_media`. You get an approval card with the price.
4. Approve. The picture appears in the chat and in your library.

## When it does not work

| What you see | Likely cause |
|---|---|
| The server log says a Hermes setting is missing, and the chat is the scripted stand-in | A secret file is empty or missing, or the token is shorter than 24 characters. Parallax falls back to the built-in engine. |
| The reply fails at once | `HERMES_URL` is wrong, the API server is off, or the tunnel is down (`deploy/tunnel.sh status`). The server log has the reason. |
| "The engine did not accept our key." | `hermes-api.key` is not the agent's `API_SERVER_KEY`. |
| The agent answers but never makes anything | The `parallax` MCP entry is missing or its `url` does not reach Parallax from the agent's computer. Try `curl -s -o /dev/null -w '%{http_code}' <url>` there: 401 means it reaches Parallax (no token sent), anything else means it does not. |
| 401 in the agent's MCP log | The token in `config.yaml` is not the one in `engine.token`. |
| 404 from `/api/agent/mcp` | Parallax is running the built-in engine. |
| A long render is cut off | `timeout` in the MCP entry is too low. Keep it above 2100. |

## What the agent can and cannot do in Parallax

Offered: `generate_media`, `list_models`, `get_model`, `quote`, `search_library`,
`get_asset`, `remember`, `recall`, `ask_user`, `schedule_chat`. Every call runs as the
member who sent the message, so it uses their credits and their library.

Not offered: Parallax's connected apps (the agent has its own), and the `computer_*` tools
unless Parallax's own cloud computer is live (`AGENT_MODE=live` with an Orgo key).

The technical reference is the "Engines" section of [`docs/api/agent.md`](api/agent.md).

## Next steps, if you want to build on this

- **Run it against a live agent and report back.** This is the most useful thing anyone can
  do right now.
- **A one-command setup.** A script that makes the secrets, enables Direct SSH through the
  Orgo API, writes `ssh.conf` and runs the config script on the agent.
- **A ready-made narrow agent.** A Hermes home template with only the Parallax tools, for
  public deployments.
- **An Orgo template.** One computer image with Parallax and a Hermes agent already joined.
- **Per-member agents.** Today every member talks to the same agent, with separate
  conversations. One Orgo computer per member would give each their own workspace.
- **Show the agent's own steps in full.** Today its own tools appear as a name only.
- **Connectors through the agent.** Let approval cards cover the agent's own app actions.
