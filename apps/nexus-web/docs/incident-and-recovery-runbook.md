# Nexus Social — incident containment and recovery runbook

Status: local operational baseline; not a substitute for a production on-call,
legal notification decision, external audit or disaster-recovery environment.

## Severity and first response

| Severity | Typical trigger | Initial target | First action |
|---|---|---:|---|
| SEV0 | funds/keys/child safety/immediate physical danger | immediate, target <15 min | contain, preserve minimal evidence, appoint Incident Commander |
| SEV1 | auth bypass, sensitive leak, harmful active stream | <30 min | pause affected control, protect reporters, start incident log |
| SEV2 | major degradation, reconciliation or moderation failure | <2 h | degrade safely, stop expansion, tracked mitigation |
| SEV3 | bounded defect without immediate risk | business day | ticket, owner, deadline and regression test |

Roles are Incident Commander, Technical Lead, Safety/Privacy/Legal liaison,
Communications and Scribe. Contact with users, authorities, rightsholders or
emergency services remains a human/legal action for the relevant country.

## Containment controls

Read current state without mutation:

```powershell
npm run incident:status
```

Available controls are `all_mutations`, `ugc_publish`, `media_upload`,
`live_start` and `public_discovery`. Reads, reports, appeals, blocking, account
export/cancellation and logout/session revocation remain available during a broad
pause. The public health endpoint reports `degraded` but does not reveal the
incident reason.

An emergency pause requires `NEXUS_INCIDENT_CONTROL_EXECUTE=1`, an operator
identity and a scoped approval such as `NX-INC-*`. Example syntax only:

```powershell
npm run incident:control -- --action pause --control ugc_publish --severity SEV1 --reason HARMFUL_CONTENT --approval NX-INC-EXAMPLE_0001
```

Reactivation uses `--action resume --incident <id>` and requires
`NEXUS_INCIDENT_CHECKER` to be set to a distinct maker-checker identity. Raw
operator identity is never stored; the command produces a chained event hash.
Never put incident detail, PII, secrets or victim data in `reason` or environment
values. `reason` is a bounded code, not free text.

## Evidence and communications

1. Record UTC timestamps, severity, affected surface and incident ID.
2. Preserve only hashes and the minimum necessary artifacts; put legal-hold data
   in its restricted evidence system, not in application logs.
3. Verify health, mutation denial, report availability and outbox backlog.
4. Do not claim resolution from “monitoring added”; add a causal fix and regression
   test, then obtain checker approval before resume.
5. Legal/Privacy determines whether 24-hour early warning, 72-hour notification,
   one-month final report or another national deadline applies.

## Backup and restore drill

Run the zero-egress synthetic drill:

```powershell
npm run recovery:drill
```

The drill never opens the demo database. It creates a current-schema synthetic
database in an OS temporary directory, uses SQLite's online backup API, checks
integrity and foreign keys, restores into a new file, compares exact canonical
state hashes, then removes only that verified temporary directory. A modified
backup or existing restore target is rejected.

Production policy must separately define encrypted backup storage, access, key
ownership, geographic copies, retention, legal holds, RPO/RTO and a restore target.
Never restore over the live database. Restore to a fresh isolated target, verify
state hash/integrity/schema/application smoke, reconcile outbox/Action Ledger, then
promote through maker-checker change control. The local drill proves mechanism,
not production durability or regional disaster recovery.

## Closure

An incident closes only after containment is removed with checker approval,
critical journeys pass, outstanding data/legal notifications are owned, and a
blameless review records root cause, corrective actions, owners and due dates.
