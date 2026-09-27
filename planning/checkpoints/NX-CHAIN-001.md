# Checkpoint — NX-CHAIN-001

## Identitate

- Task: `NX-CHAIN-001` — Action capability and devnet record proof
- Owner: `A20`
- Risc: `T0`
- Stare: `done`
- Data deschidere: `2026-08-02`
- Cost incremental maxim implicit: `0 EUR`

## Obiectiv verificabil

O acțiune a unui adult sintetic, semnată printr-o capabilitate limitată, produce
exact un eveniment acceptat și o stare terminală neambiguă, fără PII sau target
privat predictibil în payload.

## Acceptance obligatoriu

- nonce replay, capability escalation, batch abuse și relayer mutation sunt respinse;
- stările `ordered`, `included`, `finalized` și `executed` nu pot fi confundate;
- payload-ul nu conține PII ori identificatori privați predictibili;
- scenariile critice sunt comparate între RustVM și GoVM;
- gas snapshot și limitele de cost sunt măsurate cu GoVM, fără mainnet, fonduri
  reale sau provider contorizat.

## Gates păstrate

- audit independent înainte de fonduri mainnet materiale;
- niciun deploy mainnet, fond real, provider plătit sau egress în acest packet;
- orice incompatibilitate Supernova se tratează prin adaptor/versionare;
- ABI-ul acceptat v1 nu este înlocuit: implementarea curentă este staged separat
  ca `2.0.0-alpha.1`.

## Progres implementat

- sandbox TypeScript v1: capability bounded, Ed25519 boundary, nonce/action-limit
  CAS, relayer v3 agreement, endpoint-uri non-payable și o acțiune per apel;
- contract MultiversX real în `contracts/nexus-actions`, `no_std`, Rust `1.88.0`,
  `multiversx-sc = 0.66.2` și EI `1.5`;
- registry de capabilități cu register/revoke/rotate, scopuri, limită de acțiuni,
  expirare, nonce strict secvențial și relayer allowlist/pause;
- semnătură Ed25519 verificată de VM, domain separation legată de chain ID și
  adresa raw a contractului;
- action types publice și private separate; Kids este exclus din acest contract,
  iar actorii sintetici sunt marcați `SYSTEM_TEST`;
- build `sc-meta` locked generează ABI, MXSC, proxy și WASM reproductibil;
- patru scenarii Mandos sunt generate pentru replay, scope privat respins/acceptat
  și emergency pause.

## Dovezi locale curente

- validator sandbox: `planning/validate-chain-actions.ps1` — `118` controale și
  `52/52` aserțiuni `PASS`;
- validator integrat: `planning/validate-chain-rust.ps1` — `87` controale `PASS` la
  prima validare completă și scriere automată a Evidence Pack-ului la rerulare;
- `cargo check --workspace --all-targets --locked`: `PASS`, fără warnings;
- RustVM cu Ed25519 real: `9/9 PASS`, dintre care patru scenarii diferențiale;
- WASM: `11.476 bytes`, SHA-256
  `16cb227ba43678b8bbe8772cd2b704ff2d01a3e40b848ecd98b89de6493ab16f`;
- codehash: `00a65735a13a6fb18193f3dfcfb95a784e52041c062fe87524ecbcc40f59d17e`;
- ABI v2 alpha SHA-256:
  `5ec4c699480ebd3421c68d77b429eb80da78a5a67e597928f2798bbf30d35a63`;
- LLVM-MinGW `20260616-ucrt-x86_64` verificat prin SHA-256;
- runnerul oficial GoVM Linux `v5.1.0` este staged și verificat: arhivă SHA-256
  `337c533d985174de61b86414fd21c8df567bcbb1d3e9989532cc8e0ed1852e48`;
- preflight: `planning/validate-chain-govm-preflight.ps1`; status `READY` pentru
  runtime, artefact verificat și toate cele patru scenarii;
- parserul determinist pentru outputul oficial `total gas used` este pregătit în
  `planning/parse-govm-gas.ps1`; fixture-ul local trece `9/9` aserțiuni;
- WSL `2.7.11.0`, Ubuntu `24.04`, GoVM `5.1.0`/VM `1.5`: `PASS_4_OF_4`, pe
  aceleași hash-uri de scenarii ca RustVM;
- gas GoVM real: `recordAction = 5.106.811`, limită recomandată `6.384.000`;
  `recordPrivateAction = 5.119.346`, limită recomandată `6.400.000`;
- rejecțiile așteptate sunt separate de baseline deoarece VM consumă limita
  furnizată la `signalError`;
- network/economic operations: `0/0`; cost incremental: `0 EUR`.

## Limitări și claims excluse

- RustVM nu modelează gas-ul protocolului;
- runnerul oficial GoVM nu suportă Windows nativ; WSL și Virtual Machine Platform
  au fost activate controlat, iar Ubuntu 24.04 rulează local fără provider extern;
- nu există încă tranzacție devnet, mainnet readiness sau audit de securitate de
  producție; aceste claims nu sunt inferate din scenariile locale;
- salt entropy pentru commitment-urile private este o garanție de client și nu
  poate fi demonstrată on-chain.

## Pas următor

Evidence Pack-ul este pregătit pentru verificarea independentă T0. Checkerul trebuie
să reverifice acceptance-ul, prospețimea hash-urilor, privacy scan, gas budgets și
rollback/pause înainte ca packetul să poată deveni `done`.

## Remediere audit C03 — 2026-08-02

Verdictul C03 inițial rămâne imutabil în
`planning/evidence/reviews/NX-CHAIN-001-C03.yaml`; packetul rămâne `in_progress`
până la închiderea tuturor celor trei finding-uri și o nouă verificare independentă.

- `C03-CHAIN-001-001` — remediat tehnic: corpus determinist cu opt seed-uri fixe,
  `4.096/4.096` mutații și câte `512` cazuri în opt categorii; două replay-uri
  produc același SHA-256
  `40e0659c05908773e40cd31f1e9c085b9fee86af70150092de666167577ea57f`.
  Evidence Pack: `planning/evidence/NX-CHAIN-001-fuzz-validation.json`.
- `C03-CHAIN-001-002` — remediat tehnic: `10/10` teste RustVM și `8/8`
  scenarii portabile identice RustVM/GoVM 1.5. Setul comun include replay,
  scope privat respins/acceptat, pause, revoke, rotație cu escaladare respinsă,
  relayer/nonce și apel batch-shaped cu argument suplimentar respins de decoder.
  Evidence Packs: `planning/evidence/NX-CHAIN-001-rustvm-scenarios.json` și
  `planning/evidence/NX-CHAIN-001-govm-validation.json`.
- validatorul integrat trece `101/101` controale, run
  `NX-CHAIN-001-RUST-20260802T211355748Z-5ccd29a6`; WASM-ul și codehash-ul nu
  s-au schimbat.
- `C03-CHAIN-001-003` — încă deschis: repository-ul nu conține wallet/relayer
  privat. CLI-ul oficial `mxpy 11.4.1` este instalat izolat, iar wallet-urile
  publice de test din SDK au xEGLD fără valoare pe Devnet. Totuși, controlul de
  securitate a refuzat simularea deoarece aceasta ar transmite bytecode-ul local
  către gateway-ul public. Nu s-a trimis bytecode, nu s-a broadcastat tranzacție
  și nu s-a consumat xEGLD.
- runnerul `planning/run-chain-devnet.ps1` este acum pregătit fail-closed: modul
  implicit `Prepare` nu face rețea, iar `Execute` cere simultan flag explicit și
  un `approval_id` dedicat. Preflight-ul trece `17/17` controale; builderul offline
  reproduce exact envelope-ul, signing message-ul și semnătura RustVM în `7/7`
  aserțiuni. Evidence Pack:
  `planning/evidence/NX-CHAIN-001-devnet-preflight.json`.

### Următorul pas autorizabil

Este necesară aprobarea explicită a proprietarului pentru transmiterea artefactului
`contracts/nexus-actions/output/nexus-actions.wasm` către
`https://devnet-gateway.multiversx.com`, urmată de deploy și tranzacții exclusiv cu
wallet-uri publice de test și xEGLD fără valoare. Aprobarea nu include mainnet,
fonduri reale, publicare în producție sau acceptarea unor termeni externi.

## Deploy Devnet parțial și Resume fail-closed — 2026-08-03

- Contractul a fost creat pe Devnet la
  `erd1qqqqqqqqqqqqqpgq3hd0f9mhnl2gt20sjmeg2z4hn5p7ew7pd8ssjldy2t`;
  owner-ul, codul prezent și runtime codehash-ul
  `00a65735a13a6fb18193f3dfcfb95a784e52041c062fe87524ecbcc40f59d17e`
  corespund artefactului Nexus aprobat. Dovada intermediară este
  `planning/evidence/NX-CHAIN-001-devnet-partial-deploy.json`.
- `mxpy 11.4.1` a broadcastat deploy-ul, apoi awaiter-ul a eșuat deoarece valoarea
  CLI `--timeout` a rămas `str`. Runner-ul nu a continuat cu cele trei apeluri;
  toate argumentele `--timeout` au fost eliminate, folosind default-ul numeric SDK.
- `Mode=Resume` nu poate face deploy. El verifică fail-closed adresa exactă,
  owner-ul, codehash-ul, codul prezent, `getChainId == D` și pauser-ul constructorului
  înainte de primul apel mutabil.
- Receipt-ul Resume este legat de `operation_mode`, adresa contractului, subject,
  WASM, run ID și capul exact de trei tranzacții; consumarea rămâne single-use cu
  lock inter-proces și CAS logic.
- Regression suite: `32/32 PASS`, opt planuri CLI parsate și nouă cazuri negative,
  inclusiv mismatch de mod, adresă și transaction cap. Preflight: `24/24 PASS`,
  subject SHA-256
  `222e19908284b34d97c9708ba8c4cd368304c5862fe265aea129159df5a8da08`.
- Checkerul independent C03 a emis
  `PASS_PREFLIGHT_FOR_OWNER_APPROVAL_REQUEST`; review-ul este în
  `planning/evidence/reviews/NX-CHAIN-001-C03-resume-preflight-review.yaml`.
- Validatorul integrat curent trece `109/109`, run
  `NX-CHAIN-001-RUST-20260802T221321182Z-e7afce82`; WASM-ul este neschimbat.

Packetul rămâne `in_progress`. Următorul efect permis este exclusiv Resume pentru
cele trei apeluri rămase (`setRelayerAllowed`, `registerCapability`, `recordAction`)
după o aprobare nouă care reproduce exact subject-ul, adresa, capul și run ID-ul.
Aprobarea veche de deploy nu este extinsă implicit.

## Închidere finală Devnet și C03 — 2026-08-03

- Contract Devnet: `erd1qqqqqqqqqqqqqpgq3hd0f9mhnl2gt20sjmeg2z4hn5p7ew7pd8ssjldy2t`;
  WASM SHA-256 `16cb227ba43678b8bbe8772cd2b704ff2d01a3e40b848ecd98b89de6493ab16f`,
  runtime codehash `00a65735a13a6fb18193f3dfcfb95a784e52041c062fe87524ecbcc40f59d17e`.
- R3 a finalizat exact trei tranzacții cu valoare zero: `setRelayerAllowed`
  `dc47b5e75d56ff21bc0f6c74c8ab79f85b4260cd8261d4512e2121f5c4a480db`,
  `rotateCapability` `1d09673c9c4d162969da9091f60b581baac78d39598d88b3d283d1251d84090a`
  și `recordAction` `b4987f83d572551efe2c749edc87ad6511f68c95ce27952bda0f8a45420dc34b`.
- Toate trei sunt `success` și hyperblock-final. `recordAction` conține exact un
  eveniment ABI `ActionRecorded` în forma EI 1.5; noul capability are
  `used_actions=1`, `last_action_nonce=1`, iar capability-ul vechi este inactiv.
- Verificarea read-only este în `planning/evidence/NX-CHAIN-001-devnet-validation.json`;
  validatorul integrat final trece `125/125`, run
  `NX-CHAIN-001-RUST-20260803T060411125Z-94988264`.
- C03 a emis `PASS_FINAL_C03_NX_CHAIN_001`; toate acceptance tests sunt dovedite,
  fără finding-uri deschise. Mainnet, fondurile reale și production enablement rămân
  explicit în afara packet-ului.

Stare finală: `done`. Succesorul direct `NX-CHAIN-002` rămâne dependent de
`NX-OBS-001`; observability devine următorul packet eligibil.
