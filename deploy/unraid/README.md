# Deploying openplaud on the Unraid host

This is the runbook for standing up upstream openplaud on Joe's Unraid box
(hostname `Tower`, LAN IP `192.168.68.121`) for the FBD selection-meeting
transcription pipeline. Phase 1 only — no diarization service or AgentOS
skill yet.

> Earlier revisions of this doc referred to the host as "Hazel" — that was
> wrong. Hazel was an OpenClaw agent CONTAINER that lived on Unraid; the
> container has been decommissioned. The HOST itself is just "Unraid" /
> `Tower`. Updated 2026-04-17.

## Layout on the Unraid host

| Path | Contents |
|---|---|
| `/mnt/user/appdata/openplaud/src/` | Cloned `joemc1470/openplaud` git checkout (the running app source) |
| `/mnt/user/appdata/openplaud/postgres/` | Postgres data (mapped to the `db` container's `/var/lib/postgresql/data`) |
| `/mnt/user/appdata/openplaud/audio/` | Audio blobs (mapped to the `app` container's `/app/audio`) |

`appdata` is on the cache pool (fast SSD) and lives next to every other
Docker service on this box — standard Unraid pattern. Override compose in
`docker-compose.override.yml` swaps upstream's named volumes for these
explicit bind mounts.

## Network exposure

Phase 1: LAN only. Host port **3030** (remapped — `:3000` is already Mealie on
this Unraid). App inside the container still listens on `:3000`; the override
exposes it as `3030:3000`. Reach it at `http://tower.local:3030` or
`http://192.168.68.121:3030` from any device on the LAN.

Phase 1+ (later): if Joe wants TLS, add a reverse-proxy entry in his
existing Caddy / Nginx-Proxy-Manager stack. Out of scope for Phase 1.

## Secrets

Two random hex strings (32 bytes / 64 hex chars each):

```bash
openssl rand -hex 32   # → BETTER_AUTH_SECRET
openssl rand -hex 32   # → ENCRYPTION_KEY
```

Save **both** immediately — losing the second one makes every Plaud token,
AI key, and S3 cred in the database unrecoverable.

## Runbook

Can be run remotely over SSH (no Unraid UI required). Izzy's local alias
`chloe` points at `192.168.68.121`, so `ssh chloe "..."` works from Izzy's
host.

```bash
# 1. SSH to the Unraid box (adjust alias to match your setup)
ssh chloe   # or: ssh root@192.168.68.121

# 2. Create appdata dirs
mkdir -p /mnt/user/appdata/openplaud/{postgres,audio}
chown -R nobody:users /mnt/user/appdata/openplaud

# 3. Clone the fork
cd /mnt/user/appdata/openplaud
git clone https://github.com/joemc1470/openplaud.git src
cd src
git checkout deploy/unraid   # this branch has the override + env template

# 4. Check the deploy assets are there
ls deploy/unraid
# expect: README.md  .env.template  docker-compose.override.yml  PLAUD-TOKEN-CAPTURE.md

# 5. Copy the env template and fill in the two secrets
cp deploy/unraid/.env.template .env
# edit BETTER_AUTH_SECRET and ENCRYPTION_KEY in .env
# (APP_URL defaults to http://tower.local:3030 — change only if the port is taken)

# 6. Copy the override compose next to upstream's docker-compose.yml
cp deploy/unraid/docker-compose.override.yml docker-compose.override.yml

# 7. Bring up the stack (compose auto-merges docker-compose.yml + override)
docker compose up -d

# 8. Wait for healthchecks to go green (~60–90s)
docker compose ps
# both openplaud-db and openplaud-app should show 'healthy'

# 9. Verify HTTP from the LAN
curl -sS http://192.168.68.121:3030/api/health
# expect: JSON with status:"ok"
```

## First-run onboarding (Joe does this in a browser)

Open `http://tower.local:3030` (or `http://192.168.68.121:3030`) and walk
through:

1. **Create account** — this account becomes the admin.
2. **Connect Plaud device** — capture the bearer token per
   [`PLAUD-TOKEN-CAPTURE.md`](PLAUD-TOKEN-CAPTURE.md), paste into the
   wizard, select the matching Plaud API region (US `api.plaud.ai`,
   EU `api-euc1.plaud.ai`).
3. **Configure AI provider** — add a custom OpenAI-compatible provider:
   - **Base URL**: the Z.AI endpoint from `reference_infrastructure.md`
     (`https://api.z.ai/api/coding/paas/v4`)
   - **API key**: from macOS keychain, item `ZAI_API_KEY` (or whichever
     secret name Joe uses today — `reference_agentos_keychain_pattern.md`)
   - **Model**: `glm-5.1`
   - Note: also set `thinking: {type: disabled}` if the provider dropdown
     exposes it, per `reference_glm51_thinking_mode.md`.
4. **Storage**: leave on default `local` (audio lives in
   `/mnt/user/appdata/openplaud/audio`).
5. **Sync interval**: every 15 min is fine for selection-meeting cadence.

Then click **Sync** manually to confirm Plaud auth works.

## Verify success

```bash
# Recording count via API (run from any LAN host)
curl -sS http://192.168.68.121:3030/api/recordings | head -c 400

# Audio landing on disk
ssh chloe "ls -la /mnt/user/appdata/openplaud/audio | head"

# Postgres has recordings
ssh chloe "docker exec openplaud-db psql -U postgres -d openplaud -c 'select id, title, created_at from recordings limit 5;'"
```

If all three return data after you complete onboarding, Phase 1 is done.

## Rollback

```bash
ssh chloe "cd /mnt/user/appdata/openplaud/src && docker compose down"
# To also wipe data (DESTRUCTIVE):
# ssh chloe "rm -rf /mnt/user/appdata/openplaud/{postgres,audio}"
```

## Troubleshooting

- **`db` container unhealthy** — `ssh chloe "docker logs openplaud-db"`. Most
  often a port conflict on 5432. Fix: remove the 5432 port mapping from
  `docker-compose.override.yml` (the app container talks to postgres via
  the Docker network anyway).
- **`app` container won't start** — check `.env` has both secrets filled.
  Empty `BETTER_AUTH_SECRET` or `ENCRYPTION_KEY` causes immediate exit.
- **Sync returns 401** — bearer token expired or wrong region. Re-capture
  per `PLAUD-TOKEN-CAPTURE.md`; make sure you picked the right API host.
- **No recordings after a sync** — check `docker compose logs app` for the
  sync-loop output. If silent, click the manual Sync button in the UI.

## When to ping Izzy

After onboarding completes and you see the first synced recording:

> "openplaud is up, got my first recording"

…and Izzy starts Phase 2 (record the voice-reference clip + plan the
diarization service that turns "Speaker 0/1" into "Joe / Homeowner").

Phase 2 spec is already at
`~/.openclaw/workspace/memory/specs/2026-04-16-openplaud-design.md`.
