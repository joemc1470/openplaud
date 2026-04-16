# Deploying openplaud on Hazel (Unraid)

This is the runbook for standing up upstream openplaud on Hazel for the FBD
selection-meeting transcription pipeline. Phase 1 only — no diarization
service or AgentOS skill yet.

## Layout on Hazel

| Path | Contents |
|---|---|
| `/mnt/user/appdata/openplaud/src/` | Cloned `joemc1470/openplaud` git checkout (the running app source) |
| `/mnt/user/appdata/openplaud/postgres/` | Postgres data (mapped to the `db` container's `/var/lib/postgresql/data`) |
| `/mnt/user/appdata/openplaud/audio/` | Audio blobs (mapped to the `app` container's `/app/audio`) |

We use `appdata` because: backed up by Unraid's appdata backup plugin if Joe
has it enabled, lives on the cache pool (fast SSD), and matches every other
service Hazel runs.

We override the upstream `docker-compose.yml`'s named volumes with these
explicit bind mounts via `docker-compose.override.yml` (see that file for
the override).

## Network exposure

Phase 1: LAN only. The app listens on `:3000` on Hazel's LAN IP. Reach it at
`http://hazel.local:3000` from any device on the LAN.

Phase 1+ (later): if Joe wants TLS, we add a reverse-proxy entry in his
existing Caddy/NPM stack. Not in scope for Phase 1.

## Generate secrets (do this before the runbook)

On Hazel (or any machine — these are random hex strings):

```bash
openssl rand -hex 32   # → use as BETTER_AUTH_SECRET
openssl rand -hex 32   # → use as ENCRYPTION_KEY
```

Save both immediately — losing the second one means losing every Plaud token,
AI key, and S3 cred in the database.

## Runbook (Joe runs this on Hazel)

```bash
# 1. SSH to Hazel
ssh hazel

# 2. Make appdata dirs
sudo mkdir -p /mnt/user/appdata/openplaud/{postgres,audio}
sudo chown -R nobody:users /mnt/user/appdata/openplaud   # standard Unraid owner

# 3. Clone the fork into the src/ subdir
cd /mnt/user/appdata/openplaud
git clone https://github.com/joemc1470/openplaud.git src
cd src

# 4. Pull the deploy/hazel/ assets we wrote (they're already in the clone, in deploy/hazel/)
ls deploy/hazel
# expect: README.md  .env.template  docker-compose.override.yml  PLAUD-TOKEN-CAPTURE.md

# 5. Copy the .env template and fill in secrets
cp deploy/hazel/.env.template .env
nano .env    # paste in the two openssl-generated secrets, leave APP_URL as-is unless you changed the port

# 6. Copy the override file alongside upstream's docker-compose.yml
cp deploy/hazel/docker-compose.override.yml docker-compose.override.yml

# 7. Bring up the stack (compose auto-merges docker-compose.yml + .override.yml)
docker compose up -d

# 8. Wait for healthchecks to go green
docker compose ps
# both 'openplaud-db' and 'openplaud-app' should show 'healthy' after ~60-90s

# 9. Tail the app logs while you wait
docker compose logs -f app
# look for: Next.js ready / listening on 3000

# 10. Open the UI from your Mac
open http://hazel.local:3000

# 11. Onboarding wizard — complete in this order:
#     a. Create account (becomes the admin)
#     b. Connect Plaud device:
#        - Capture bearer token per deploy/hazel/PLAUD-TOKEN-CAPTURE.md
#        - Paste into the wizard
#     c. Configure AI provider:
#        - Add Z.AI as a custom OpenAI-compatible provider
#        - Base URL: <Joe's Z.AI endpoint, see ~/.openclaw/workspace/memory file reference_infrastructure.md>
#        - API key: from macOS keychain, item AGENTOS_VAULT_KEY (or the Z.AI key, whichever is right)
#        - Model: GLM-5.1
#     d. Storage: leave on default 'local'
#     e. Sync interval: pick something reasonable (every 15 min is fine for selection meetings)

# 12. Trigger a manual sync to confirm Plaud auth works
#    (use the Sync button in the UI; or: curl -X POST http://localhost:3000/api/plaud/sync from inside the app container)

# 13. Verify a recording appears in the UI within ~30s of sync
```

## Verify success

After step 13:

```bash
# Recording count > 0 in the API
curl -s http://hazel.local:3000/api/recordings | head -50

# Audio blobs landing on disk
ls -la /mnt/user/appdata/openplaud/audio | head

# Postgres has our recordings
docker exec openplaud-db psql -U postgres -d openplaud -c "select id, title, created_at from recordings limit 5;"
```

If all three return data, Phase 1 is done.

## Rollback

```bash
cd /mnt/user/appdata/openplaud/src
docker compose down
# To also wipe data (CAREFUL):
# rm -rf /mnt/user/appdata/openplaud/{postgres,audio}
```

## Troubleshooting

- **`db` container unhealthy** — check `docker compose logs db`. Most often a port conflict on 5432 (we expose it for the override; close it if conflict exists by removing the `ports:` mapping from the override).
- **`app` container won't start** — check `.env` has both secrets filled. Empty `BETTER_AUTH_SECRET` or `ENCRYPTION_KEY` causes immediate exit.
- **Sync returns 401** — bearer token expired or wrong region. Re-capture per PLAUD-TOKEN-CAPTURE.md and check the API host noted there matches your Plaud account region.
- **No recordings appear** — wait one full sync interval; check `docker compose logs app` for sync-loop messages. If silent, click the manual Sync button in the UI.

## When to ping me (Claude)

After step 13 succeeds, message me on Discord with:
- "openplaud is up, got my first recording"

I'll start Phase 2 (record voice ref clip + plan the diarization service).

If anything in this runbook breaks, paste the error in Discord and I'll triage.
