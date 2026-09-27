# Nexus Delivery Control Plane

Acest director conține input-uri machine-readable pentru orchestrarea agenților.
Documentul normativ este
[`docs/16-agent-delivery-continuous-assurance.md`](../docs/16-agent-delivery-continuous-assurance.md).

- `agent-task-template.yaml`: contractul obligatoriu al unui task packet;
- `backlog-p0.yaml`: primele task packets, owners, checkers și dependențe;
- `backlog-p1.yaml`: thin vertical packets blocate de dependențele fundației;
- `validate-program.ps1`: verificarea machine-readable a ownership-ului,
  referințelor și grafului P0/P1;
- `openai-plus-capacity-plan.md`: limitele de WIP, checkpoint și testare pentru
  execuția inițială pe ChatGPT Plus;
- statusurile sunt `blocked`, `ready`, `in_progress`, `review`, `control`, `done`;
- orchestratorul nu pornește un task dacă `depends_on` nu este `done` ori dacă
  owner-ul are deja un task `in_progress`;
- un owner nu poate apărea singur în `peer_reviewers`/`control_reviewers`.

Fișierele din `planning/` pregătesc execuția; nu înlocuiesc OpenAPI, ABI, ADR,
threat models sau Evidence Pack.

Regulile persistente pentru toți agenții sunt în [`AGENTS.md`](../AGENTS.md).
