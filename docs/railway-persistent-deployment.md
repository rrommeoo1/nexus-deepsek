# Nexus persistent Railway deployment

This deployment keeps the current Node.js + SQLite architecture and stores all
mutable state on one Railway Volume. It is intended for preview and product
testing, not for horizontal scaling.

## Service

- Source: this GitHub repository, branch `main`
- Builder: the repository-root `Dockerfile`
- Health check: `/health`
- Replicas: exactly `1`
- Public networking: enabled

## Persistent storage

Attach one Railway Volume to the web service and mount it at:

```text
/data
```

Both the SQLite database and uploaded media are derived from
`NEXUS_DATA_DIR=/data`, so the complete mutable application state survives
restarts and deployments.

## Runtime variables

Set the following variables on the Railway service:

```text
NODE_ENV=production
HOST=0.0.0.0
NEXUS_DEPLOYMENT_MODE=preview
NEXUS_DATA_DIR=/data
NEXUS_MEDIA_STORAGE_PROVIDER=local-content-addressed
NEXUS_RATE_LIMIT_MODE=trusted-edge
NEXUS_TRUST_PROXY=1
NEXUS_MVX_NETWORK=mainnet
NEXUS_SESSION_SECRET=<at least 32 random characters>
NEXUS_ORIGIN=https://<generated Railway domain>
NEXUS_ACCEPTED_ORIGINS=https://<generated Railway domain>
```

Railway provides `PORT`; do not define it manually.

Preview mode intentionally keeps the test email account enabled while xPortal
is not configured. WalletConnect/xPortal can be enabled later with the Reown
project variables required by `apps/nexus-web/lib/env.js`.

## Backup before a deploy that touches data

The whole mutable state is one SQLite database on the volume: `/data/nexus.sqlite` (with `-wal` and
`-shm` next to it). A backup must be taken **by SQLite**, not by copying a live WAL set with `cp`:
`VACUUM INTO` writes a consistent, single-file snapshot while the server keeps serving.

With a shell in the running service (Railway dashboard → the service → its shell / `railway ssh` with
the CLI: `npm i -g @railway/cli`, `railway login`, `railway link`):

```sh
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/data/nexus.sqlite');db.exec(\"VACUUM INTO '/data/nexus-backup-2026-10-17.sqlite'\");db.close();"
ls -l /data/nexus-backup-*.sqlite
```

If the service has no interactive shell, run the same `node -e …` as a one-off command/job on the same
volume (the image already ships Node 24, and `node:sqlite` ships with it — no `sqlite3` binary needed).

Then, for a copy that survives the volume itself, download the file and check it locally:

```sh
# macOS / Linux
railway ssh cat /data/nexus-backup-2026-10-17.sqlite > nexus-backup-2026-10-17.sqlite
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('nexus-backup-2026-10-17.sqlite',{readOnly:true});console.log(db.prepare('select count(*) c from users').get());"
```

Do **not** redirect binary output through Windows PowerShell (`>` / `Out-File` corrupts it — the same
failure that `tools/images/safe-screencap.ps1` exists to avoid); use `base64` on the remote side and
decode locally, or download the file with the CLI's own file transfer.

Rollback of a bad deploy that only changed code: redeploy the previous commit and, if it also wrote
data, restore the snapshot above into `/data/nexus.sqlite` while the service is stopped.

## Persistence acceptance check

1. Sign in and create a post with an uploaded image.
2. Confirm that the post, image, profile and comments load.
3. Redeploy the same commit or restart the service.
4. Sign in again and confirm that the post, image and comments are unchanged.

Do not add a second replica while SQLite is used. Before scaling horizontally,
migrate the database to a shared database service and media to object storage.
