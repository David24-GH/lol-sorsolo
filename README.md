# LoL Champion Sorsoló

Szerencsekerék a League of Legendshez: válaszd ki a lane-ed, pörgesd ki a championod, majd egy második keréken egy hozzá illő **fun buildet** – teljes rúnaoldallal, idézői varázslatokkal és tárgyakkal vásárlási sorrendben.

**Élő oldal: https://lol-sorsolo.vercel.app/**

Tisztán statikus weboldal (HTML + CSS + JavaScript): nincs build lépés, nincs telepítendő függőség, bármilyen statikus tárhelyen fut.

## Funkciók

### Champion kerék
- **Lane-választás** (Top, Jungle, Mid, ADC, Support) a pörgetés előtt; az oldal megjegyzi.
- Az adott lane-en **játszhatatlan championok kimaradnak** a kerékről (pl. Yuumi jungle-ben); a „kizárva” feliratra víve az egeret felugrik a listájuk.
- **Szűrés szerepkörre** a játék ikonjaival (Harcos, Tank, Mágus, Orgyilkos, Lövész, Támogató); több is kijelölhető.
- Mindig friss champion lista: a Riot hivatalos adataiból töltődik be, az új championok maguktól megjelennek.
- Sorsoláskor megszólal a champion **angol nyelvű választási hangja**, mint a játékban (kikapcsolható).
- Látványos eredmény: teljes képernyős bemutató, fénysugarak, csillogás, részecske-effekt.

### Fun build kerék
- A kisorsolt champion **fejlécként** megmarad, alatta egy második kerék jelenik meg.
- 14 build típus: Teljes AP, AP on-hit, AP tank, Lethality, Kritikus csapás, On-hit, Bruiser, Teljes tank, HP-halmozás, Vámpír, Enchanter, Mana-halmozás, Mozgási sebesség, Képesség-gyorsítás.
- Minden champion **csak olyan buildet kap, amivel játszható** – a Riot adataiból (sebzéstípus, szerepkör, harctávolság) számolva, kézi javításokkal.

### Teljes build a lane szerint
| Lane | Tárgyak |
|---|---|
| Top | cipő + 5 tárgy |
| Jungle | kezdő pet tárgy + cipő + 5 tárgy, Sújtás |
| Mid | fejlesztett cipő + 5 tárgy |
| ADC | cipő + 6 tárgy (7 tárgy) |
| Support | support tárgy + cipő + 4 tárgy |

- **Idézői varázslatok** a lane és a build szerint.
- **Képességsorrend** nyilakkal (pl. Q → E → W → R): a szokásos maxolási sorrend championonként (`SKILL_ORDER`), néhány AP buildnél eltérő (`AP_SKILL_ORDER`). Általános javaslat, nem patch-statisztika.
- **Rúnaoldal**: a buildhez illő fő rúna, teljes és szabályos oldal, plusz az **alap értékek** (shardok).
- **Tárgyak vásárlási sorrendben**; a speciális tárgyak (kezdő pet, support tárgy, cipő) külön, elválasztva.
- **+1 csere opció**: minden build alatt külön egy plusz tárgy ugyanabból a build típusból, ami nincs a buildben és egyik tárgyával sem ütközik – ha valamelyik tárgy nem tetszik, ez vehető helyette.
- A tárgyak az aktuális patch tárgylistájából jönnek: ha egy tárgyat kivesznek a játékból, magától kimarad.
- **Tárgy-tooltip**: ha az egeret egy tárgy fölé viszed (build kártya, előzmények, build-javasló), megmutatja az árát, a statjait és a passzív / aktív képességeit, a játékbelihez hasonló színekkel.

### Előzmények, kedvencek, ötletek
- **Előzmények**: az utolsó 10 sorsolás, kattintásra pontosan visszahívható (ugyanaz a build, rúnák, tárgyak).
- **Kedvencek**: a jól bevált buildek ☆ csillaggal elmenthetők (legfeljebb 30).
- **Ötletek**: javaslat-űrlap a további fejlesztésekhez (lásd lent: [Ötletek fogadása](#ötletek-fogadása-formspree)).
- **Build javaslása**: a látogatók ikononként összerakhatják a saját buildjüket – champion, lane, tárgyak sorrendben, teljes rúnaoldal alap értékekkel, idézői varázslatok –, és elküldhetik. A szerkesztő a játék szabályait követi (ADC-n 7 tárgyhely, egy cipő / support tárgy / jungle pet, egymást kizáró tárgyak, szabályos rúnaoldal). Az Ötletek fülről, illetve a build kártyáról (előre kitöltve) nyitható meg, és ugyanoda érkezik, ahová az ötletek.

Az előzmények és a kedvencek a böngészőben tárolódnak (`localStorage`).

### Nyelv: magyar és angol
- Jobb felül a **zászlókkal** váltható az oldal nyelve; a választást megjegyzi. Első látogatáskor a böngésző nyelve dönt (magyar böngészőnél magyar, egyébként angol).
- Váltáskor a Riot adatai (championok, tárgyak, rúnák, varázslatok) is az új nyelven töltődnek be, és az épp látott build megmarad.
- Az oldal szövegei az `i18n.js` fájlban vannak, mindkét nyelven. A beküldött ötletek és buildek mezőnevei mindig magyarok, a `nyelv` mező mutatja, milyen nyelven küldték.

## Helyi futtatás

Windows alatt a mellékelt kis szerverrel:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Majd nyisd meg: http://localhost:8792

Bármilyen más statikus szerver is jó, pl. `npx serve .` vagy `python -m http.server`.

## Közzététel weboldalként

Az oldal a **Vercelen** fut, ami össze van kötve ezzel a GitHub-tárolóval: minden `main` ágra feltöltött változás pár percen belül magától élesedik a https://lol-sorsolo.vercel.app/ címen.

Máshol is közzétehető, mert csak ezek a fájlok kellenek hozzá: `index.html`, `style.css`, `i18n.js`, `script.js` (a `serve.ps1` csak helyi teszteléshez kell). Például Netlifyon: húzd rá a mappát a https://app.netlify.com/drop oldalra.

## Ötletek fogadása (Formspree)

Az **Ötletek** fülön a látogatók javaslatokat küldhetnek. Alapból ezek csak az adott böngészőben tárolódnak. Hogy minden látogató ötlete hozzád érkezzen:

1. Regisztrálj ingyen a https://formspree.io oldalon, és hozz létre egy új űrlapot (*New Form*).
2. Másold ki az űrlap címét, pl. `https://formspree.io/f/abcdwxyz`.
3. Írd be a `script.js` elején az `IDEA_ENDPOINT` értékének:
   ```js
   const IDEA_ENDPOINT = 'https://formspree.io/f/abcdwxyz';
   ```
4. Töltsd fel újra az oldalt. Az ötletek ezután e-mailben és a Formspree felületén is megjelennek (kategória, javaslat, név).

## Testreszabás

A szabályok mind a `script.js` elején, jól elkülönítve találhatók:

| Mit | Hol |
|---|---|
| Lane-enként kizárt championok | `LANE_BANS` |
| Build típusok (tárgyak sorrendje, cipő, fő rúnák, alap értékek, kinek jár) | `BUILDS` |
| Kézi javítások a champion profilokhoz (pl. ki számít AP-nak / AD-nak) | `AP_EXTRA`, `AP_EXCLUDE`, `AD_EXTRA`, `AD_EXCLUDE`, `CRIT_EXTRA`, `AP_ONHIT_EXTRA`, `INFO_FIX` |
| Közösségi fun build ötletek: champion → plusz build típusok (a [funleaguebuilds.de](https://funleaguebuilds.de/) buildjei alapján, csak az ötlet) | `EXTRA_BUILDS` |
| Kik kapják a Mozgási sebesség / Vámpír buildet | `MS_CHAMPS`, `LIFESTEAL_CHAMPS` |
| Tárgyszám lane-enként | `LANES` |
| Support tárgy és jungle pet a build szerint | `SUPPORT_ITEM`, `JUNGLE_PET` |
| Egymást kizáró tárgyak | `GROUP_COMPONENTS`, `MANUAL_GROUPS` |
| Az oldal szövegei (magyar és angol), a buildek angol neve | `i18n.js` |

## Felépítés

```
index.html   az oldal szerkezete
style.css    megjelenés (sötét, LoL-stílusú téma, mobilon is)
i18n.js      az oldal szövegei magyarul és angolul
script.js    adatbetöltés, kerekek, build-összeállítás, előzmények, kedvencek, ötletek
serve.ps1    kis helyi szerver teszteléshez (Windows PowerShell)
```

## Adatforrások

- [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) – championok, tárgyak, rúnák, idézői varázslatok, képek (magyarul és angolul).
- [CommunityDragon](https://www.communitydragon.org/) – szerepkör- és lane-ikonok, a rúnák alap értékei, a champion-választás hangjai.

Az oldal futás közben tölti be az adatokat, ezért internetkapcsolat kell hozzá.

## Licenc

Minden jog fenntartva. A kód megtekinthető, de engedély nélkül nem használható fel.

## Jogi nyilatkozat

A LoL Champion Sorsoló nem a Riot Games terméke, és nem tükrözi a Riot Games vagy a League of Legends létrehozásában és kezelésében hivatalosan részt vevő személyek nézeteit. A League of Legends és a Riot Games a Riot Games, Inc. védjegyei vagy bejegyzett védjegyei.
