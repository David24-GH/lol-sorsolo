# LoL Champion Sorsoló

Szerencsekerék a League of Legendshez: válaszd ki a lane-ed, pörgesd ki a championod, majd egy második keréken egy hozzá illő **fun buildet** – teljes rúnaoldallal, idézői varázslatokkal és tárgyakkal vásárlási sorrendben.

**Élő oldal: https://lol-sorsolo.vercel.app/**

Statikus weboldal (HTML + CSS + JavaScript), build lépés és telepítendő függőség nélkül. Egyetlen szerveroldali része a közös üzenőfal (`api/wall.js`, Vercel szerverfüggvény).

## Funkciók

### Champion kerék
- **Lane-választás** (Top, Jungle, Mid, ADC, Support) a pörgetés előtt; az oldal megjegyzi.
- Az adott lane-en **játszhatatlan championok kimaradnak** a kerékről (pl. Yuumi jungle-ben).
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
- **Rúnaoldal**: a buildhez illő fő rúna, teljes és szabályos oldal, plusz az **alap értékek** (shardok).
- **Tárgyak vásárlási sorrendben**; a speciális tárgyak (kezdő pet, support tárgy, cipő) külön, elválasztva.
- A tárgyak az aktuális patch tárgylistájából jönnek: ha egy tárgyat kivesznek a játékból, magától kimarad.

### Előzmények, kedvencek, ötletek
- **Előzmények**: az utolsó 10 sorsolás, kattintásra pontosan visszahívható (ugyanaz a build, rúnák, tárgyak).
- **Kedvencek**: a jól bevált buildek ☆ csillaggal elmenthetők (legfeljebb 30).
- **Ötletek**: közös üzenőfal, mint egy Facebook-fal – bárki kiírhatja az ötletét, mindenki látja a többiekét, és 👍 lájkolhatók. Moderálni a `#admin` címmel lehet (lásd lent: [Üzenőfal beállítása](#üzenőfal-beállítása)).

Az előzmények és a kedvencek a böngészőben tárolódnak (`localStorage`), az üzenőfal üzenetei a szerveren.

## Helyi futtatás

Windows alatt a mellékelt kis szerverrel:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Majd nyisd meg: http://localhost:8792

Bármilyen más statikus szerver is jó, pl. `npx serve .` vagy `python -m http.server`. Az üzenőfal helyben nem működik (ahhoz a Vercel szerverfüggvénye kell), ott a „nem érhető el” üzenet jelenik meg; minden más igen.

## Közzététel weboldalként

Az oldal a **Vercelen** fut, ami össze van kötve ezzel a GitHub-tárolóval: minden `main` ágra feltöltött változás pár percen belül magától élesedik a https://lol-sorsolo.vercel.app/ címen.

## Üzenőfal beállítása

Az **Ötletek** fül fala az `api/wall.js` szerverfüggvényen keresztül egy **Upstash Redis** tárolóba menti az üzeneteket. Amíg ez nincs beállítva, a fal azt írja ki, hogy „hamarosan elérhető”.

1. Vercel → a projekt → **Storage** → *Create Database* → **Upstash for Redis** (ingyenes csomag) → kösd a projekthez (*Connect*), minden környezethez. Ez magától létrehozza a `KV_REST_API_URL` és `KV_REST_API_TOKEN` változókat.
2. Vercel → a projekt → **Settings** → **Environment Variables**: új változó `ADMIN_KEY` néven, értéke egy hosszú, titkos kód (ezzel moderálsz).
3. **Deployments** → a legutóbbi élesítésnél *Redeploy*, hogy a változók érvénybe lépjenek.

**Moderálás:** nyisd meg az oldalt `#admin` végződéssel (pl. https://lol-sorsolo.vercel.app/#admin), írd be az admin kódot, és minden üzenetnél megjelenik egy szemetes ikon. A kód csak az adott böngészőlapon marad meg, a lap bezárásával kilépsz.

**Korlátok:** egy üzenet legfeljebb 1000 karakter, egy címről fél percenként egy üzenet küldhető, a fal a legújabb 200 üzenetet őrzi meg (és az 50 legújabbat mutatja). Egy böngészőből üzenetenként egy lájk adható.

## Testreszabás

A szabályok mind a `script.js` elején, jól elkülönítve találhatók:

| Mit | Hol |
|---|---|
| Lane-enként kizárt championok | `LANE_BANS` |
| Build típusok (tárgyak sorrendje, cipő, fő rúnák, alap értékek, kinek jár) | `BUILDS` |
| Kézi javítások a champion profilokhoz (pl. ki számít AP-nak / AD-nak) | `AP_EXTRA`, `AP_EXCLUDE`, `AD_EXTRA`, `AD_EXCLUDE`, `CRIT_EXTRA`, `AP_ONHIT_EXTRA`, `INFO_FIX` |
| Tárgyszám lane-enként | `LANES` |
| Support tárgy és jungle pet a build szerint | `SUPPORT_ITEM`, `JUNGLE_PET` |
| Egymást kizáró tárgyak (alapanyag szerint, plusz kézi csoportok) | `GROUP_COMPONENTS`, `MANUAL_GROUPS` |
| Fix első / utolsó tárgy egy buildben | a build `pool` első eleme, illetve `last` mezője |

## Felépítés

```
index.html    az oldal szerkezete
style.css     megjelenés (sötét, LoL-stílusú téma, mobilon is)
script.js     adatbetöltés, kerekek, build-összeállítás, előzmények, kedvencek, üzenőfal
api/wall.js   az üzenőfal szerverfüggvénye (Vercel + Upstash Redis)
serve.ps1     kis helyi szerver teszteléshez (Windows PowerShell)
```

## Adatforrások

- [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) – championok, tárgyak, rúnák, idézői varázslatok, képek (magyarul).
- [CommunityDragon](https://www.communitydragon.org/) – szerepkör- és lane-ikonok, a rúnák alap értékei, a champion-választás hangjai.

Az oldal futás közben tölti be az adatokat, ezért internetkapcsolat kell hozzá.

## Licenc

Minden jog fenntartva. A kód megtekinthető, de engedély nélkül nem használható fel.

## Jogi nyilatkozat

A LoL Champion Sorsoló nem a Riot Games terméke, és nem tükrözi a Riot Games vagy a League of Legends létrehozásában és kezelésében hivatalosan részt vevő személyek nézeteit. A League of Legends és a Riot Games a Riot Games, Inc. védjegyei vagy bejegyzett védjegyei.
