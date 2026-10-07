# Comparație numerică — feed

DPR 2.6 · toleranță 2 CSS px · surse: docs/web-ref/feed/*.dom.json și docs/parity-report/feed/native-*.xml

## drawer-open

_Fără captură nativă: `native-drawer-open.xml` lipsește (lotul pe telefon încă nu a rulat)._

## drawer-open2

_Fără captură nativă: `native-drawer-open2.xml` lipsește (lotul pe telefon încă nu a rulat)._

## reels-0

Elemente web etichetate: **41** · potrivite fără diferență: **2** · potrivite cu diferență: **15** · fără pereche în nativ: **24** · în plus în nativ: **17**

| Element (etichetă) | Web [x,y,w,h] | Nativ [x,y,w,h] | Verdict |
|---|---|---|---|
| Sari la conținutul principal | [12,-59,240,45] | — | LIPSĂ |
| Nexus Home · revino la prima pagină | [12,14,80,42] | [12,15,80,42] | OK (dx=0 dy=1 dw=0 dh=0) |
| Nexus | [12,24,80,21] | — | LIPSĂ |
| NE | [13,27,25,15] | — | LIPSĂ |
| X | [38,27,11,15] | — | LIPSĂ |
| US | [49,27,25,15] | — | LIPSĂ |
| 1.11 | [12,44,29,13] | [12,45,26,13] | DIFERIT (dx=0 dy=1 dw=-3 dh=0) |
| Ce citești | [98,15,38,40] | — | LIPSĂ |
| Reels | [98,15,38,40] | [108,28,17,17] | DIFERIT (dx=10 dy=13 dw=-21 dh=-23) |
| ▶ | [109,26,17,17] | [110,29,13,15] | DIFERIT (dx=1 dy=3 dw=-4 dh=-2) |
| Schimbă profilul Nexus | [415,14,42,42] | [415,15,42,42] | OK (dx=0 dy=1 dw=0 dh=0) |
| ↻ | [155,-33,14,25] | — | LIPSĂ |
| Trage pentru actualizare | [177,-29,137,16] | — | LIPSĂ |
| Previzualizare media editată nedistructiv | [0,-2,469,969] | — | LIPSĂ |
| @test | [18,853,77,24] | — | LIPSĂ |
| Test Nexus | [18,855,77,19] | — | LIPSĂ |
| Verificare nativa: login, camera, editor, public | [18,877,375,18] | — | LIPSĂ |
| Nexus native test 0710 | [18,902,161,20] | — | LIPSĂ |
| Vezi traducerea | [18,927,375,22] | — | LIPSĂ |
| Acțiuni clip | [406,589,54,360] | — | LIPSĂ |
| @test | [404,585,58,62] | — | LIPSĂ |
| Deschide selectorul de reacții | [405,665,56,56] | — | LIPSĂ |
| 😮 | [415,650,36,36] | — | LIPSĂ |
| 1 | [430,688,5,14] | — | LIPSĂ |
| Deschide comentariile | [405,719,56,56] | — | LIPSĂ |
| 0 | [430,759,7,14] | — | LIPSĂ |
| Salvează | [405,777,56,56] | [415,816,44,32] | DIFERIT (dx=10 dy=39 dw=-12 dh=-24) |
| Repost / Distribuie | [405,835,56,56] | — | LIPSĂ |
| 0 | [430,875,7,14] | — | LIPSĂ |
| Activează sunetul | [405,893,56,56] | [417,72,40,40] | DIFERIT (dx=12 dy=-821 dw=-16 dh=-16) |
| ♫ | [422,897,23,32] | — | LIPSĂ |
| Deschide Reel-ul pe tot ecranul | [0,967,469,969] | [0,58,469,863] | DIFERIT (dx=0 dy=-909 dw=0 dh=-106) |
| navigation | [0,967,469,60] | [0,920,469,101] | DIFERIT (dx=0 dy=-47 dw=0 dh=41) |
| Acasă | [8,971,63,50] | [8,920,63,50] | DIFERIT (dx=0 dy=-51 dw=0 dh=0) |
| Mesaje | [72,971,63,50] | [72,920,63,50] | DIFERIT (dx=0 dy=-51 dw=0 dh=0) |
| Găsește oameni și conținut | [136,971,63,50] | [137,920,63,50] | DIFERIT (dx=1 dy=-51 dw=0 dh=0) |
| Creează | [200,963,68,50] | [201,920,68,42] | DIFERIT (dx=1 dy=-43 dw=0 dh=-8) |
| + | [208,968,52,52] | [227,930,16,27] | DIFERIT (dx=19 dy=-38 dw=-36 dh=-25) |
| Prieteni | [269,971,63,50] | [270,920,63,50] | DIFERIT (dx=1 dy=-51 dw=0 dh=0) |
| Live | [334,971,63,50] | [334,920,63,50] | DIFERIT (dx=0 dy=-51 dw=0 dh=0) |
| Profil | [398,971,63,50] | [398,920,63,50] | DIFERIT (dx=0 dy=-51 dw=0 dh=0) |

**În nativ, fără pereche în web:**

- [414,110,26,26] ImageView „Tools"
- [321,72,40,40] Button „Pauză"
- [333,81,15,21] TextView „❚❚"
- [369,72,40,40] Button „Mod de afișare a imaginii"
- [383,81,12,21] TextView „⤢"
- [428,81,19,21] TextView „&#128263;"
- [415,688,44,50] Button „Reacționează"
- [422,688,30,32] TextView „&#129293;"
- [66,773,319,19] TextView „Nexus Test 02 (social)"
- [66,792,319,17] TextView „@urailwaytest02cb2b · 21.01.1970"
- [415,752,44,50] Button „Comentarii"
- [422,752,30,32] TextView „&#128172;"
- [14,817,372,58] TextView „[test] Clip de verificare. Sursă: Wikimedia Commons — Timela"
- [422,816,30,32] TextView „&#127991;"
- [14,881,372,17] TextView „♫ Audio original · Nexus Test 02 (social)"
- [415,862,44,32] Button „Distribuie"
- [422,862,30,32] TextView „&#128257;"

## reels-s0

_Fără captură nativă: `native-reels-s0.xml` lipsește (lotul pe telefon încă nu a rulat)._

## swipe-left-1

_Fără captură nativă: `native-swipe-left-1.xml` lipsește (lotul pe telefon încă nu a rulat)._

## swipe-left-2

_Fără captură nativă: `native-swipe-left-2.xml` lipsește (lotul pe telefon încă nu a rulat)._

## swipe-right-1

_Fără captură nativă: `native-swipe-right-1.xml` lipsește (lotul pe telefon încă nu a rulat)._
