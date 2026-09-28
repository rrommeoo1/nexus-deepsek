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

## Persistence acceptance check

1. Sign in and create a post with an uploaded image.
2. Confirm that the post, image, profile and comments load.
3. Redeploy the same commit or restart the service.
4. Sign in again and confirm that the post, image and comments are unchanged.

Do not add a second replica while SQLite is used. Before scaling horizontally,
migrate the database to a shared database service and media to object storage.
