# Checkpoint — NX-SYNTH-P01

## Identitate

- Task: `NX-SYNTH-P01` — Ten-thousand deterministic actor isolation run
- Owner: `A37`
- Risc: `T1`
- Stare: `done`
- Data deschidere: `2026-08-09`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

Zece mii de actori locali `SYSTEM_TEST` execută un journey bounded și determinist,
respectând limite de CPU/timp/disk, fără payout, review, reputație, adopție, trafic
organic, provider extern sau cost incremental.

## Felie de implementare

- generator determinist cu seed, actor IDs namespaced și fără date reale;
- workload bounded peste profile/social/chat/marketplace fără efecte externe;
- sink-uri economice, reputație, review și organic metrics fail-closed;
- resource caps și abort controlat;
- raport repetabil cu hash de corpus și contoare exacte;
- probe de label stripping, mixed actor class, replay și metric poisoning.

## Gates și excluderi

- QA, Contract Registry și Observability sunt dependințe acceptate;
- review independent C01/C02/C08/C10 este obligatoriu înainte de `done`;
- utilizatori reali, producție, trafic de adopție, LLM-uri externe și furnizori
  contorizați rămân excluse.

## Stare curentă

Implementarea și validarea owner sunt complete. Validatorul
`NX-SYNTH-P01-OWNER-VALIDATION02` a trecut 105 controale și 32 scenarii executate
de trei ori identic: 10.000 actori, 40.000 acțiuni și 50.000 tentative de
contaminare refuzate. Corpus SHA-256:
`4e77cb1b328cebf0748fa44e04730eb804fdc25d16b5db8b814d355f11253661`.
Review-ul independent C01/C02/C08/C10 este PASS: binding 18/18, validator
105/105 și 32 scenarii × 3. Receipt SHA-256:
`f50a1134031dea6ebcd7f16661fd85aaab34643dd6fa043935a4460c52fbab40`.
Packet-ul este acceptat; efectele externe și costul incremental sunt zero.
