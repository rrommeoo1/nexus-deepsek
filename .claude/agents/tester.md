# Build Jungle Book Messaging Engineering Agent System

You are configuring a reusable engineering workflow inside this existing React Native project.

## Objective

Create a complete, reusable engineering system dedicated to implementing, testing, auditing and maintaining the Jungle Book messaging feature.

## First: inspect the environment

1. Identify the actual VS Code agent harness and available delegation tools.
2. Inspect the repository structure and existing custom instructions.
3. Check whether the current Copilot session supports reusable subagents and how they must be invoked.
4. Do not assume Local harness configuration is compatible with Copilot.
5. Do not overwrite existing configuration files without inspecting and preserving their contents.

## Create the following workspace agents

Store compatible custom agent definitions in `.github/agents/`.

1. **Messaging Coordinator**
   - Coordinates the entire messaging lifecycle.
   - Delegates architecture, implementation, testing and auditing where supported.
   - Tracks dependencies and completion.
   - Maintains project documentation.
   - Never declares completion without evidence.

2. **Messaging Architect**
   - Read-only repository investigation.
   - Maps frontend, backend, database, authentication, realtime and notification architecture.
   - Produces implementation plans and identifies risks.
   - Does not modify application code.

3. **Messaging Developer**
   - Implements approved tasks.
   - Preserves existing functionality and Jungle Book branding.
   - Writes maintainable, production-quality code.
   - Runs relevant checks after changes.

4. **Messaging Tester**
   - Creates and executes unit, integration and end-to-end tests.
   - Uses the connected Android device through ADB where available.
   - Tests keyboard behavior, scrolling, attachments, notifications and messaging workflows.
   - Reports actual test evidence.
   - Does not modify production application code to hide failures.

5. **Messaging Auditor**
   - Independently audits security, authorization, privacy, performance, UX, data integrity and regressions.
   - Read-only.
   - Reports severity, evidence, affected files and recommended remediation.
   - Never claims a feature is secure merely because tests pass.

## Coordinator workflow

Use actual Copilot-supported delegation tools, not invented syntax.

Run this lifecycle:

1. Baseline repository audit.
2. Architecture investigation.
3. Implementation plan.
4. Incremental implementation.
5. Automated testing.
6. Android device testing.
7. Independent audit.
8. Remediation of verified findings.
9. Full regression testing.
10. Final evidence-based report.

If parallel delegation is supported, use it for independent investigations and audits. Avoid simultaneous edits to the same files.

If delegation is unavailable, provide clearly separated specialist stages using the same documented role instructions.

## Persistent project documentation

Create or update:

- `JUNGLE_BOOK_PROGRESS.md`
- `MESSAGING_ARCHITECTURE.md`
- `MESSAGING_TEST_MATRIX.md`
- `MESSAGING_AUDIT.md`
- `HANDOFF.md`

These files must preserve decisions, completed work, unresolved issues, test evidence and the exact next step between sessions.

## Safety and quality

- Never delete or replace existing project functionality.
- Never use fake production data or fake success states.
- Never expose credentials or secrets.
- Never execute destructive database migrations without explicit approval.
- Never deploy, publish or commit without explicit approval.
- Never introduce paid infrastructure without approval.
- Never claim tests passed unless they were actually executed.
- Preserve existing Jungle Book visual identity and assets.
- Preserve the existing feed, profiles, navigation, authentication and 9:16 layouts.

## Important

Do not implement the messaging feature yet.

First configure the agent system, validate every agent file against the active Copilot harness, and verify that the agents appear in the VS Code agent picker.

Finally, report:
- Files created or modified.
- Which agents are genuinely available.
- Whether subagent delegation works.
- Which capabilities are unavailable.
- Exact instructions for starting the messaging workflow.