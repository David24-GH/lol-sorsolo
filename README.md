# LoL Champion Sorsoló

Szerencsekerék, ami véletlenszerűen kisorsol egy League of Legends championt.

- A championok listája és képei a Riot hivatalos [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) szolgáltatásából töltődnek be, így az új championok automatikusan megjelennek.
- Szűrés szerepkörre (Harcos, Tank, Mágus, Orgyilkos, Lövész, Támogató).
- Az utolsó 10 sorsolás a böngészőben megmarad.
- Sorsoláskor megszólal a champion angol nyelvű választási hangja és effektje (mint a champion-választásnál), a hang a jobb felső gombbal kikapcsolható.
- Látványos eredmény: teljes képernyős bemutató, fénysugarak, csillogás és részecske-effekt.
- Az elején kiválasztod a lane-ed (Top, Jungle, Mid, ADC, Support), és a végén a lane-nek megfelelő **teljes buildet** kapsz: idézői varázslatok, rúnaoldal és tárgyak.
  - Top / Jungle: cipő + 5 tárgy (jungle-ben kezdő pet tárggyal és Sújtással)
  - Mid: fejlesztett cipő + 5 tárgy
  - ADC: cipő + 6 tárgy (7 tárgy)
  - Support: support tárgy (a Világatlasz végső fejlesztése) + cipő + 4 tárgy
- A kisorsolt champion fejlécként megmarad, alatta egy második kerék jelenik meg **fun buildekkel** (pl. Teljes AP, Lethality, Kritikus csapás, Mozgási sebesség). Minden champion csak olyan buildeket kap, amivel játszható: ezt a Riot adataiból (sebzéstípus, szerepkör, harctávolság) számolja ki, néhány kézi javítással. A buildekhez tartozó tárgyak az aktuális patch tárgylistájából jönnek.

A szerepkör-ikonok és a hangok a [CommunityDragon](https://www.communitydragon.org/) oldalról töltődnek be.

Tisztán statikus oldal (HTML + CSS + JS), nincs build lépés és nincs függőség.

## Helyi futtatás

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Majd: http://localhost:8792

## Feltöltés weboldalra

Bármely statikus tárhelyen működik. Feltölteni ezeket a fájlokat kell: `index.html`, `style.css`, `script.js` (a `serve.ps1` csak helyi teszteléshez kell).

**GitHub Pages**
1. Hozz létre egy új repót a GitHubon (pl. `lol-sorsolo`), és töltsd fel ezt a mappát.
2. Repó → *Settings* → *Pages* → *Source*: `Deploy from a branch`, branch: `main`, mappa: `/ (root)`.
3. Pár perc múlva elérhető: `https://<felhasznalonev>.github.io/lol-sorsolo/`

**Netlify**
Húzd rá a mappát a https://app.netlify.com/drop oldalra.

## Ötletek fogadása (Formspree)

Az **Ötletek** fülön a látogatók javaslatokat küldhetnek. Alapból ezek csak az adott böngészőben tárolódnak. Hogy minden látogató ötlete hozzád érkezzen:

1. Regisztrálj ingyen a https://formspree.io oldalon, és hozz létre egy új űrlapot (*New Form*).
2. Másold ki az űrlap címét, pl. `https://formspree.io/f/abcdwxyz`.
3. Írd be a `script.js` elején az `IDEA_ENDPOINT` értékének:
   ```js
   const IDEA_ENDPOINT = 'https://formspree.io/f/abcdwxyz';
   ```
4. Töltsd fel újra az oldalt. Az ötletek ezután e-mailben és a Formspree felületén is megjelennek (kategória, javaslat, név).

## Jogi nyilatkozat

A LoL Champion Sorsoló nem a Riot Games terméke, és nem tükrözi a Riot Games vagy a League of Legends létrehozásában és kezelésében hivatalosan részt vevő személyek nézeteit. A League of Legends és a Riot Games a Riot Games, Inc. védjegyei vagy bejegyzett védjegyei.
