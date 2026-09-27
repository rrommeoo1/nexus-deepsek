# Nexus

Nexus este un produs social mobile-first, wallet-native, construit pe MultiversX. O
singură identitate de cont controlează mai multe profiluri de context izolate:
Social, Work, Dating, Travel, Market și Mobility. Chatul, încrederea, harta,
tranzacțiile, Business Pages, programările, promovarea și review-urile sunt servicii
comune. Music și Grow (nutriție, sport și educație) sunt hub-uri globale care
respectă separarea profilelor și a datelor sensibile. Onboarding-ul principal
creează automat un wallet embedded după login Google/Apple/Facebook/TikTok, iar
agenții AI au identitate și economie proprie, fără a pretinde că sunt oameni.
Dating oferă preferințe incluzive, Incognito și Trust Passport, iar Pulse adaugă
conversația publică tip X cu aliasuri și identitate publică protejată. `Clips`
oferă experiența TikTok-like, `Watch` adaugă video long-form și live streaming,
iar `Nexus Kids` este o aplicație separată, administrată de părinte.

> Statut: specificație de produs și arhitectură, 1 august 2026. „Nexus” este nume
> de lucru până la verificarea juridică a mărcii și domeniilor.

## Documentație

- [Specificația principală](docs/00-master-spec.md)
- [Arhitectura tehnică](docs/01-technical-architecture.md)
- [Smart contracts MultiversX](docs/02-smart-contracts.md)
- [Date, API și evenimente](docs/03-data-api.md)
- [Securitate, privacy, moderare și conformitate](docs/04-security-compliance.md)
- [Fluxuri UX](docs/05-user-flows.md)
- [Roadmap, echipă, estimări și riscuri](docs/06-roadmap-risks.md)
- [Monetizare și tokenomics](docs/07-tokenomics.md)
- [Decizii de produs și arhitectură](docs/08-decisions.md)
- [Every-action ledger și Marketplace OLX-like](docs/09-action-ledger-classifieds.md)
- [Supernova readiness, cost minim și economie](docs/10-supernova-economics-compliance.md)
- [Business, servicii locale, promovare și Review Graph](docs/11-business-services-promotion-reviews.md)
- [Music, Wellness, Sport și Learning](docs/12-music-wellness-learning.md)
- [Rețea globală, wallet embedded și Agent Network](docs/13-global-auth-agent-network.md)
- [Dating avansat, discreție și Pulse](docs/14-dating-pulse-discretion-trust.md)
- [Recomandări, Clips, Watch, Live și Nexus Kids](docs/15-recommendations-clips-watch-live-kids.md)
- [Programul agenților și Departamentul de Control Continuu](docs/16-agent-delivery-continuous-assurance.md)
- [Nexus Node Network — descentralizare și sharding aplicațional](docs/17-decentralized-node-network.md)

Documentele `docs/research-*.md` sunt note de cercetare și nu reprezintă sursa
normativă pentru implementare. În caz de conflict, `00-master-spec.md` și
deciziile din `08-decisions.md` au prioritate. Documentele `09`–`17` sunt
specificații normative de domeniu.

## Execuție

- [Backlog-ul P0 pentru agenți](planning/backlog-p0.yaml)
- [Template Agent Task Packet](planning/agent-task-template.yaml)
- [Reguli pentru orchestrarea backlog-ului](planning/README.md)

## Principiul central

**One wallet. Every side of you. Every way you move.**

Blockchain-ul este registrul fiecărei acțiuni și stratul de settlement, nu
depozitul de plaintext social. Fiecare mutație intenționată produce o tranzacție
MultiversX distinctă; datele private, media și conținutul rămân off-chain, iar
tranzacția conține un envelope compact, hash/CID sau commitment. Activitatea Kids
este excepția de siguranță: nu creează istoric public individual pe blockchain.
