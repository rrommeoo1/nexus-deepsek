# Nexus M9–M10 local checkpoint

Data: 2026-09-10  
Verdict: `PASS_LOCAL` pentru M9 și M10; nu este certificare de producție.

## M9

- Profil Dating 18+, preferințe mutuale, decizii private și match reciproc unic.
- Trust Passport descriptiv, fără scor scalar de atractivitate/seriozitate.
- Unmatch/block închide conversația; meet plan-ul păstrează numai zonă aproximativă
  și hash PIN, cu confirmare bilaterală.
- Privé este safe preview fail-closed: fără media explicită ori bani reali.

## M10

- Watch are canale, video long-form pe upload reluabil, subscriptions, playlists,
  Watch Later și Continue Watching privat.
- Discovery verifică rights/moderation/audience înainte de ranking și exclude traficul
  `SYSTEM_TEST`; publicarea `approved_local_demo` nu pretinde clearance de producție.
- Live permite preview, programare și emergency terminate local. Start public răspunde
  `LIVE_INGEST_NOT_CONFIGURED` până la provider verificat.
- Family Center emite o capabilitate Kids separată; shell-ul `/kids.html` nu reutilizează
  sesiunea adultă. Catalogul este allowlisted, autoplay este hard-off, iar activitatea
  copilului este expirabilă, off-chain și fără wallet/DM/ads/upload public.

## Dovezi

- `npm run audit:m9`: 12/12.
- `npm run audit:m10`: 16/16.
- teste focalizate M9/M10: 12/12.
- `npm test`: 360/360.
- `npm run audit:data`: PASS_LOCAL, inclusiv indexurile M9/M10.

Gates externe rămân deschise pentru KYC/age assurance, rights, transcoding/CDN,
managed Live, producție Kids separată, Country Packs, DPIA și audit independent.
