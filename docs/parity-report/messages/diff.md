# Comparație numerică — messages

DPR 2.6 · toleranță 2 CSS px · surse: docs/web-ref/messages/*.dom.json și docs/parity-report/messages/native-*.xml

## inbox-0

Elemente web etichetate: **43** · potrivite fără diferență: **0** · potrivite cu diferență: **18** · fără pereche în nativ: **25** · în plus în nativ: **6**

| Element (etichetă) | Web [x,y,w,h] | Nativ [x,y,w,h] | Verdict |
|---|---|---|---|
| Sari la conținutul principal | [12,-59,240,45] | — | LIPSĂ |
| Nexus Home · revino la prima pagină | [16,17,112,64] | [10,72,124,42] | DIFERIT (dx=-6 dy=55 dw=12 dh=-22) |
| Nexus | [16,17,112,29] | — | LIPSĂ |
| NE | [17,20,34,21] | — | LIPSĂ |
| X | [52,20,14,21] | — | LIPSĂ |
| US | [68,20,34,21] | — | LIPSĂ |
| 1.11 | [57,46,29,21] | [10,102,26,12] | DIFERIT (dx=-47 dy=56 dw=-3 dh=-9) |
| MESSAGES | [16,67,112,14] | — | LIPSĂ |
| ⌄ | [134,27,132,44] | — | LIPSĂ |
| Social | [144,40,36,19] | [178,85,32,15] | DIFERIT (dx=34 dy=45 dw=-4 dh=-4) |
| Toate mesajele | [63,128,196,44] | — | LIPSĂ |
| Social | [63,172,196,44] | — | LIPSĂ |
| Dating | [63,216,196,44] | — | LIPSĂ |
| Work | [63,260,196,44] | — | LIPSĂ |
| Travel | [63,304,196,44] | — | LIPSĂ |
| Market | [63,348,196,44] | — | LIPSĂ |
| ⌄ | [272,27,132,44] | — | LIPSĂ |
| Toate | [282,40,33,19] | — | LIPSĂ |
| Secțiuni inbox | [200,128,196,220] | — | LIPSĂ |
| Toate | [200,128,196,44] | — | LIPSĂ |
| Necitite | [200,172,196,44] | — | LIPSĂ |
| Grup | [200,216,196,44] | — | LIPSĂ |
| Cereri | [200,260,196,44] | — | LIPSĂ |
| Activitate | [200,304,196,44] | — | LIPSĂ |
| Conversație nouă | [409,27,44,44] | — | LIPSĂ (iconiță web) |
| Caută conversații | [17,83,391,44] | — | LIPSĂ |
| Caută conversații | [408,83,44,44] | — | LIPSĂ (iconiță web) |
| Stories | [16,134,437,160] | [0,138,469,160] | DIFERIT (dx=-16 dy=4 dw=32 dh=0) |
| Story-ul tău | [18,142,98,144] | [2,146,98,146] | DIFERIT (dx=-16 dy=4 dw=0 dh=2) |
| TE | [19,143,96,124] | — | LIPSĂ |
| + | [83,235,26,26] | [74,243,11,18] | DIFERIT (dx=-9 dy=8 dw=-15 dh=-8) |
| Story-ul tău | [33,271,67,15] | [2,275,98,15] | DIFERIT (dx=-31 dy=4 dw=31 dh=0) |
| Nicio conversație aici | [160,332,149,20] | [158,325,154,21] | DIFERIT (dx=-2 dy=-7 dw=5 dh=1) |
| Pornește una folosind username-ul Nexus, nu un I | [105,365,260,36] | [51,354,367,18] | DIFERIT (dx=-54 dy=-11 dw=107 dh=-18) |
| navigation | [0,961,469,60] | [0,920,469,101] | DIFERIT (dx=0 dy=-41 dw=0 dh=41) |
| Acasă | [8,965,63,50] | [8,920,63,50] | DIFERIT (dx=0 dy=-45 dw=0 dh=0) |
| Mesaje | [72,965,63,50] | [72,920,63,50] | DIFERIT (dx=0 dy=-45 dw=0 dh=0) |
| Găsește oameni și conținut | [136,965,63,50] | [137,920,63,50] | DIFERIT (dx=1 dy=-45 dw=0 dh=0) |
| Creează | [200,957,68,50] | [201,920,68,42] | DIFERIT (dx=1 dy=-37 dw=0 dh=-8) |
| + | [208,962,52,52] | [227,930,16,27] | DIFERIT (dx=19 dy=-32 dw=-36 dh=-25) |
| Prieteni | [269,965,63,50] | [270,920,63,50] | DIFERIT (dx=1 dy=-45 dw=0 dh=0) |
| Live | [334,965,63,50] | [334,920,63,50] | DIFERIT (dx=0 dy=-45 dw=0 dh=0) |
| Profil | [398,965,63,50] | [398,920,63,50] | DIFERIT (dx=0 dy=-45 dw=0 dh=0) |

**În nativ, fără pereche în web:**

- [414,110,26,26] ImageView „Tools"
- [142,71,104,44] Button „Schimbă Nexus Social · profil activ Test Nexus"
- [249,71,103,44] Button „Schimbă feedul Social · Reels"
- [286,85,29,15] TextView „Reels"
- [355,71,104,44] Button „Deschide relațiile Social · Prieteni"
- [386,85,42,15] TextView „Prieteni"

## inbox-s0

_Fără captură nativă: `native-inbox-s0.xml` lipsește (lotul pe telefon încă nu a rulat)._

## thread-0

_Fără captură nativă: `native-thread-0.xml` lipsește (lotul pe telefon încă nu a rulat)._
