# LoL Champion Sorsoló

Szerencsekerék, ami véletlenszerűen kisorsol egy League of Legends championt.

- A championok listája és képei a Riot hivatalos [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) szolgáltatásából töltődnek be, így az új championok automatikusan megjelennek.
- Szűrés szerepkörre (Harcos, Tank, Mágus, Orgyilkos, Lövész, Támogató).
- Az utolsó 10 sorsolás a böngészőben megmarad.

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

## Jogi nyilatkozat

A LoL Champion Sorsoló nem a Riot Games terméke, és nem tükrözi a Riot Games vagy a League of Legends létrehozásában és kezelésében hivatalosan részt vevő személyek nézeteit. A League of Legends és a Riot Games a Riot Games, Inc. védjegyei vagy bejegyzett védjegyei.
