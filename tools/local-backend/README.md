# Jungle Book on this PC

Everything here runs on this machine, from this repository, with no service outside it in the data path.
Railway is no longer consulted for anything the app does.

```
C:\Nexus\                     the machine's own data root (outside the repository, outside git)
  data\nexus.sqlite           the live database
  data\media\                 the live media store (content-addressed: <sha256>.<ext>)
  env\jungle.env              port, data dir, session secret — read by the service, never committed
  logs\server-YYYY-MM-DD.log  the server's own output, one line per request
  logs\supervisor.log         restarts, health probes, stops
  logs\backup.log             snapshots, retention, failures
  run\status.json             pid, start time, restarts, health — what `status-backend.ps1` prints
  run\supervisor.lock         the one supervisor that is running
  backups\db\<stamp>\         a consistent database snapshot + manifest.json (sha256, integrity)
  backups\media\<stamp>\      a hard-linked snapshot of the media store
  backups\drill\<stamp>\      where a restore drill proves a snapshot is worth keeping
```

## The three pieces

1. **`jungle-backend-service.mjs`** — a supervisor. It starts `apps/nexus-web/server.js`, restarts it with
   exponential backoff when it exits, probes `/api/version` every 30 s and restarts it if three probes in a
   row fail (a hung server is worse than a dead one), rotates its log by size, and writes `run\status.json`.
2. **Scheduled task `Jungle Book Backend`** — starts that supervisor at logon and daily, hidden, through a
   VBS launcher, with `MultipleInstances = IgnoreNew`. The task's only job is "something started"; keeping
   it alive is the supervisor's.
3. **Scheduled task `Jungle Book Backup`** — `backup-db.mjs` daily at 03:30, hidden, with retention.

## Everyday commands

```powershell
# state: is it up, since when, after how many restarts, what does it say about itself
powershell -ExecutionPolicy Bypass -File tools\local-backend\status-backend.ps1

# start / stop (stop asks the server to close the database, and only hard-kills it after 15 s)
powershell -ExecutionPolicy Bypass -File tools\local-backend\start-backend.ps1
powershell -ExecutionPolicy Bypass -File tools\local-backend\stop-backend.ps1

# logs: all, or -Only requests|errors|supervisor|backup
powershell -ExecutionPolicy Bypass -File tools\local-backend\logs-backend.ps1 -Tail 80
powershell -ExecutionPolicy Bypass -File tools\local-backend\logs-backend.ps1 -Only requests
```

## Backups

```powershell
# take one now (also run daily by the scheduled task)
node tools\local-backend\backup-db.mjs --label manual

# prove the newest snapshot is restorable, without touching anything live
node tools\local-backend\restore-backup.mjs --drill

# restore over the live database (stop the service first; the previous file is kept beside the new one)
powershell -ExecutionPolicy Bypass -File tools\local-backend\stop-backend.ps1
node tools\local-backend\restore-backup.mjs --apply --snapshot C:\Nexus\backups\db\<stamp> --force
powershell -ExecutionPolicy Bypass -File tools\local-backend\start-backend.ps1
```

A snapshot is taken with `VACUUM INTO`, so it is a single-transaction copy, not a file copy of a database
that something is writing to. Each one is checked with `PRAGMA integrity_check` and hashed before it is
kept; a snapshot that fails either test is deleted and the run fails loudly. `--drill` restores into a
throwaway directory and compares row counts with the live database, so "the backup works" is a test result
and not a belief.

## After a Windows restart

Nothing to do: the task starts the supervisor at logon, the supervisor starts the server, and the database
is where it was. Confirm with `status-backend.ps1`; the phone reconnects on its own because it points at
the PC's LAN address, which does not change while the router keeps the same lease.

## Updating the backend

```powershell
git -C C:\Users\Romeo\projects\nexus_deepsek pull --ff-only
node tools\local-backend\backup-db.mjs --label pre-update      # a snapshot before new code touches the data
powershell -ExecutionPolicy Bypass -File tools\local-backend\stop-backend.ps1
powershell -ExecutionPolicy Bypass -File tools\local-backend\start-backend.ps1
powershell -ExecutionPolicy Bypass -File tools\local-backend\status-backend.ps1
```

Schema changes are additive and run at open time (`lib/db.js` `addMissingColumns`), so a restart is the
migration. The snapshot exists because "additive" is a property of code, not a promise about data.

## Installing on a fresh machine

```powershell
node tools\local-backend\init-local-backend.mjs                # C:\Nexus, env file, secret, ACLs
powershell -ExecutionPolicy Bypass -File tools\local-backend\install-autostart.ps1
powershell -ExecutionPolicy Bypass -File tools\local-backend\install-backup-task.ps1
node tools\local-backend\issue-local-session.mjs --handle <handle> --device-id <32 hex> --out C:\Nexus\run\phone-session.json
```

`init-local-backend.mjs` never overwrites an existing `jungle.env`: rotating the session secret is a
decision, not a side effect of running an installer twice.
