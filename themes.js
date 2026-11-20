// Kerettémák: minden keret (a játék 21 szintkerete) saját színvilágot ad az oldalnak.
// A színeket a keretképek fő színeiből kevertük ki (fém, drágakő / fény, alapszín):
//   gold      – a keret fémje: gombok, keretek, kiemelések
//   goldLight – a fém legvilágosabb árnyalata: címek, kiemelt szöveg
//   goldDark  – a fém sötét árnyalata: vékony keretek
//   accent    – a keret drágakövének / fényének színe (az eredeti türkiz helyén)
//   bg, bg2, panel, border – az oldal háttere és dobozai, a keret alapszínével árnyalva
//   text, muted – szövegszínek
// Az oldal betöltésekor (a <head>-ben) rögtön alkalmazza a mentett témát, így nem villan.
(function () {
  // Az oldal eredeti színei: keret nélkül.
  const BASE = {
    bg: '#010a13', bg2: '#0a1428', panel: '#0f1d33', border: '#1e2d45',
    gold: '#c8aa6e', goldLight: '#f0e6d2', goldDark: '#785a28', accent: '#0ac8b9',
    text: '#cdbe91', muted: '#8a8f99', steel: '#1e3a5a',
  };

  const THEMES = {
    // 1 Piltover: pezsgőarany és ezüst, éjkék, hextech kék (saját háttere és díszítése is van: style.css, „Piltover téma”)
    1: { bg: '#050a18', bg2: '#0b1630', panel: '#101e3a', border: '#2a3b62', gold: '#dcc58f', goldLight: '#f4f1e6', goldDark: '#6f6346', accent: '#4cc3ff', text: '#d9dde6', muted: '#94a0b8' },
    // 2 Zaun: sárgaréz és vegyi-zöld izzás (saját háttere és díszítése is van: style.css, „Zaun téma”)
    2: { bg: '#030602', bg2: '#081005', panel: '#0d1608', border: '#2c3a18', gold: '#d2b56e', goldLight: '#f3e9c8', goldDark: '#7a6630', accent: '#9be22d', text: '#ddd5b0', muted: '#9aa184' },
    // 3 Hextech: bronz és hextech kék (saját háttere és díszítése is van: style.css, „Hextech téma”)
    3: { bg: '#020a16', bg2: '#081830', panel: '#0d2140', border: '#22395e', gold: '#d9a865', goldLight: '#f6e4c4', goldDark: '#7a4e2c', accent: '#2fb8ff', text: '#dfd0b0', muted: '#8e9aae' },
    // 4 Tűz: izzó narancs és arany, kovácsolt vas (saját háttere és díszítése is van: style.css, „Tűz téma”)
    4: { bg: '#0d0503', bg2: '#1a0b06', panel: '#241009', border: '#3d1d10', gold: '#f2a64a', goldLight: '#fde3b8', goldDark: '#8a3f14', accent: '#ff5a2a', text: '#ecc896', muted: '#a3918a' },
    // 5 Fényív: fehér arany fény, alkonyi éjkék (saját háttere és díszítése is van: style.css, „Fényív téma”)
    5: { bg: '#070c1a', bg2: '#0e1630', panel: '#141f3d', border: '#2e3d66', gold: '#e9cf8f', goldLight: '#fffaf0', goldDark: '#8a7340', accent: '#9fe6ff', text: '#e8e3d4', muted: '#9ea7bc' },
    // 6 Átitatott: vörösréz és bíbor
    6: { bg: '#0d040a', bg2: '#1a0a15', panel: '#24101e', border: '#3d1c33', gold: '#daa476', goldLight: '#f6dfcb', goldDark: '#6b2716', accent: '#e02aae', text: '#e0bca0', muted: '#9a8a92' },
    // 7 Árny-szigetek: kísérteties kékeszöld
    7: { bg: '#030a0d', bg2: '#071419', panel: '#0c1d24', border: '#1a333d', gold: '#79b6c7', goldLight: '#d6f1f6', goldDark: '#1d3944', accent: '#20e0c8', text: '#a9cdd6', muted: '#7e9298' },
    // 8 Shurima: napsárga arany, smaragd
    8: { bg: '#0c0904', bg2: '#181209', panel: '#22190d', border: '#3a2c17', gold: '#e2c062', goldLight: '#f8ecc0', goldDark: '#735223', accent: '#2ecf82', text: '#e0cc8e', muted: '#978f7c' },
    // 9 Lunari: holdezüst levendula, halványkék
    9: { bg: '#07060e', bg2: '#100d1c', panel: '#181428', border: '#2c2645', gold: '#a9b4e0', goldLight: '#e6eefb', goldDark: '#4d3f6f', accent: '#9fd8f7', text: '#c3c6e6', muted: '#8e8ca3' },
    // 10 Hódítók: jádezöld és bronz
    10: { bg: '#020b06', bg2: '#06170e', panel: '#0a2015', border: '#163a28', gold: '#c9a85a', goldLight: '#f0e6c4', goldDark: '#65482f', accent: '#0dd46e', text: '#d3c48f', muted: '#87968c' },
    // 11 Freljord: jégkék
    11: { bg: '#030812', bg2: '#081325', panel: '#0e1c33', border: '#1c3150', gold: '#8fdcef', goldLight: '#e2f6fb', goldDark: '#2b4d73', accent: '#3fc6f0', text: '#b5dbe8', muted: '#8695a6' },
    // 12 Csatagép: sötét gépfém, narancs-vörös energia
    12: { bg: '#0b0509', bg2: '#170b13', panel: '#20111b', border: '#3a2132', gold: '#f58e18', goldLight: '#f8d9b5', goldDark: '#6a1113', accent: '#ff4a24', text: '#e2b896', muted: '#9a8a93' },
    // 13 Ionia: szürke kő, szilva, türkiz
    13: { bg: '#09080b', bg2: '#131117', panel: '#1b1820', border: '#302b36', gold: '#c5b29f', goldLight: '#f1e9e0', goldDark: '#534e4d', accent: '#4fc9e6', text: '#d2c5b7', muted: '#8f8a92' },
    // 14 Bilgewater: tengerzöld
    14: { bg: '#020a07', bg2: '#06150f', panel: '#0b1e16', border: '#183628', gold: '#a9c78e', goldLight: '#e6f0da', goldDark: '#3d4a35', accent: '#01db80', text: '#c3d3b0', muted: '#879489' },
    // 15 Rúna: mélykék, cián
    15: { bg: '#04050f', bg2: '#0a0d1f', panel: '#10142b', border: '#222a4a', gold: '#8d9fcc', goldLight: '#dfe5f6', goldDark: '#2a3264', accent: '#0ab6e7', text: '#b9c3e0', muted: '#8a8ea3' },
    // 16 Noxus: vérvörös és acélszürke
    16: { bg: '#0b0606', bg2: '#170d0c', panel: '#201312', border: '#3a2523', gold: '#c2bcb9', goldLight: '#f2eeec', goldDark: '#5a5452', accent: '#e0362b', text: '#ddd0cc', muted: '#958a88' },
    // 17 Égi: éjkék-lila, rózsaezüst, cián
    17: { bg: '#08060f', bg2: '#120e1f', panel: '#1a152b', border: '#2f2846', gold: '#d1b0bf', goldLight: '#f3e6ee', goldDark: '#4a4775', accent: '#4fc3e8', text: '#d6c1cf', muted: '#928ca3' },
    // 18 Kerekerdő: szilvaszín fa, cián szemek
    18: { bg: '#0b0508', bg2: '#170c11', panel: '#201219', border: '#3a222d', gold: '#c4958d', goldLight: '#f0e0dc', goldDark: '#5e2e33', accent: '#4fd2d9', text: '#d5b9b4', muted: '#968a8e' },
    // 19 Az Üresség: üreslila és bíbor
    19: { bg: '#08040e', bg2: '#12091f', panel: '#1b0f2c', border: '#321d4d', gold: '#c26bdc', goldLight: '#f0dcf7', goldDark: '#4a1f72', accent: '#ff5fd0', text: '#d7b9e6', muted: '#958aa3' },
    // 20 Vérhold: vérvörös, karmazsin és arany
    20: { bg: '#0d0304', bg2: '#1a0709', panel: '#240c0f', border: '#401a1e', gold: '#e9bc89', goldLight: '#f8e6d2', goldDark: '#80060f', accent: '#e0395e', text: '#e6c4a8', muted: '#9a8a8b' },
    // 21 Örökkévaló: arany és indigó
    21: { bg: '#06050f', bg2: '#0e0c20', panel: '#15122d', border: '#29234a', gold: '#d9b98f', goldLight: '#f5ead9', goldDark: '#764d25', accent: '#6c7cf0', text: '#dccbb2', muted: '#8f8ca3' },
  };

  // A 6–21. keret díszítése motívumcsaládokból áll (style.css, „Díszített témák – 6–21”):
  // tüskék, kristályok, levelek, hullámok, sugarak, rúnák. Mindegyik saját hátteret és ikont is kap.
  const DECOR = {
    6: 'runes', 7: 'waves', 8: 'rays', 9: 'crystal', 10: 'leaves', 11: 'crystal', 12: 'spikes', 13: 'leaves',
    14: 'waves', 15: 'runes', 16: 'spikes', 17: 'rays', 18: 'leaves', 19: 'runes', 20: 'spikes', 21: 'rays',
  };

  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const shade = (a, k) => toHex(rgb(a).map(v => v * k));

  // A teljes paletta: a gombok háttere (steel) és a kerékszeletek színei a témából számolva.
  function palette(id) {
    const t = THEMES[id] || BASE;
    const steel = t.steel || mix(t.border, t.accent, 0.22);
    return {
      ...t,
      steel,
      slices: [shade(steel, 0.65), mix(t.bg2, steel, 0.15), steel, mix(t.bg2, steel, 0.5)],
    };
  }

  function apply(id) {
    const p = palette(id);
    window.LOL_THEME = p;
    // Egyes témáknak saját háttere és díszítése is van a style.css-ben
    // (html[data-frame="1"] – Piltover, "2" – Zaun, "3" – Hextech, "4" – Tűz, "5" – Fényív,
    // a 6–21. keretnél html[data-decor] a motívumcsaláddal).
    document.documentElement.dataset.frame = String(THEMES[id] ? id : 0);
    if (DECOR[id]) document.documentElement.dataset.decor = DECOR[id];
    else delete document.documentElement.dataset.decor;
    const s = document.documentElement.style;
    const vars = {
      '--bg': p.bg, '--bg-2': p.bg2, '--panel': p.panel, '--border': p.border,
      '--gold': p.gold, '--gold-light': p.goldLight, '--gold-dark': p.goldDark,
      '--blue': p.accent, '--text': p.text, '--muted': p.muted,
    };
    Object.entries(vars).forEach(([k, v]) => s.setProperty(k, v));
    const rgbVars = {
      '--bg-rgb': p.bg, '--bg2-rgb': p.bg2, '--gold-rgb': p.gold, '--gold-dark-rgb': p.goldDark,
      '--gold-light-rgb': p.goldLight, '--blue-rgb': p.accent, '--steel-rgb': p.steel,
    };
    Object.entries(rgbVars).forEach(([k, v]) => s.setProperty(k, rgb(v).join(', ')));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = p.bg2;
  }

  window.lolThemeRgba = (hex, a) => `rgba(${rgb(hex).join(', ')}, ${a})`;
  window.lolThemeMix = mix;
  window.applyLolTheme = apply;

  // Alapból keret nélkül (script.js: DEFAULT_FRAME). A mentett keret témája csak akkor
  // töltődik be, ha a keret már fel van oldva (script.js: „Keret-kihívások”).
  let id = 0;
  try {
    const saved = Number(localStorage.getItem('lolSorsolo.frame'));
    const unlocked = JSON.parse(localStorage.getItem('lolSorsolo.unlocked') || '[]');
    if (saved && Array.isArray(unlocked) && unlocked.map(Number).includes(saved)) id = saved;
  } catch { /* nem elérhető */ }
  apply(id);
})();
