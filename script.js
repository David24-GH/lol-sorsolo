(() => {
  'use strict';

  // ---------- Nyelv ----------
  // A választott nyelv megmarad; első látogatáskor a böngésző nyelve dönt.
  const LANG_KEY = 'lolSorsolo.lang';
  const RESUME_KEY = 'lolSorsolo.resume';
  const LANG = (() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'hu' || saved === 'en') return saved;
    } catch { /* nem elérhető */ }
    return (navigator.language || '').toLowerCase().startsWith('hu') ? 'hu' : 'en';
  })();
  const TEXT = window.LOL_TEXT[LANG];
  const t = (key, ...args) => {
    const v = key in TEXT ? TEXT[key] : window.LOL_TEXT.hu[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(...args) : v;
  };
  const SORT_LOCALE = LANG;
  const DATE_LOCALE = LANG === 'hu' ? 'hu-HU' : 'en-US';

  const DDRAGON = 'https://ddragon.leagueoflegends.com';
  const LOCALE = LANG === 'hu' ? 'hu_HU' : 'en_US';
  const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/';
  const ROLE_ICON_BASE = `${CDRAGON}rcp-fe-lol-champion-details/global/default/`;
  const LANE_ICON_BASE = `${CDRAGON}rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/`;
  // A champion-választás hangjai (angol), a champion numerikus kulcsa alapján.
  const CDRAGON_AUDIO = `${CDRAGON}rcp-be-lol-game-data/global/default/v1/`;
  // A rúnaoldal alap értékei (shardok) a választott nyelven; a Data Dragon ezeket nem tartalmazza.
  const CDRAGON_DATA = `${CDRAGON}rcp-be-lol-game-data/global/${LANG === 'hu' ? 'hu_hu' : 'default'}/v1/`;
  const CDRAGON_ASSETS = `${CDRAGON}rcp-be-lol-game-data/global/default/`;
  const HISTORY_KEY = 'lolSorsolo.history';
  const SOUND_KEY = 'lolSorsolo.sound';
  const VOLUME_KEY = 'lolSorsolo.volume';
  const LANE_KEY = 'lolSorsolo.lane';
  const HISTORY_MAX = 10;
  const FAV_KEY = 'lolSorsolo.favorites';
  const FAV_MAX = 30;
  // Az Ötletek űrlap ide küldi a javaslatokat (pl. 'https://formspree.io/f/abcdwxyz').
  // Ha üres, az ötletek csak a böngészőben tárolódnak. Lásd: README.md.
  const IDEA_ENDPOINT = 'https://formspree.io/f/mwlvonek';
  const IDEA_KEY = 'lolSorsolo.ideas';
  const CHAMP_SPIN_MS = 5500;
  const BUILD_SPIN_MS = 4500;
  const REVEAL_MS = 5000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ROLES = ['Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support']
    .map(tag => ({ tag, label: t(`role.${tag}`) }));
  const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.tag, r.label]));

  // items: hány tárgy jár a cipőn / support tárgyon felül.
  const LANES = [
    { id: 'top', label: 'Top', icon: 'top', items: 5 },
    { id: 'jungle', label: 'Jungle', icon: 'jungle', items: 5 },
    { id: 'mid', label: 'Mid', icon: 'middle', items: 5 },
    { id: 'bot', label: 'ADC', icon: 'bottom', items: 6 },
    { id: 'support', label: 'Support', icon: 'utility', items: 4 },
  ];
  const LANE_BY_ID = new Map(LANES.map(l => [l.id, l]));

  // Ezek a championok az adott lane-en gyakorlatilag játszhatatlanok, ezért nem kerülnek a kerékre.
  const LANE_BANS = {
    jungle: new Set([
      // Enchanterek és tank supportok: nincs tisztítás és túlélés
      'Yuumi', 'Sona', 'Soraka', 'Janna', 'Nami', 'Lulu', 'Seraphine', 'Milio', 'Renata', 'Karma',
      'Senna', 'Braum', 'Rakan', 'Taric', 'Bard', 'Leona', 'Alistar',
      // ADC-k
      'Ashe', 'Caitlyn', 'Jhin', 'Jinx', 'MissFortune', 'Samira', 'Sivir', 'Xayah', 'Zeri', 'Aphelios',
      'Draven', 'Ezreal', 'Varus', 'Lucian', 'Smolder', 'Yunara', 'KogMaw', 'Kaisa', 'Tristana', 'Corki', 'Kalista',
      // Mozgásképtelen tüzérmágusok
      'Xerath', 'Velkoz', 'Ziggs', 'Lux', 'Orianna', 'Syndra', 'Viktor', 'Veigar', 'Azir', 'AurelionSol',
      'Hwei', 'Anivia', 'Annie', 'Mel', 'Zoe', 'Cassiopeia', 'Malzahar', 'Heimerdinger',
    ]),
    top: new Set(['Yuumi', 'Janna', 'Nami', 'Milio', 'Renata', 'Sona', 'Rakan']),
    mid: new Set(['Yuumi', 'Janna', 'Nami', 'Milio', 'Renata', 'Soraka', 'Taric', 'Braum', 'Rakan', 'Alistar', 'Leona']),
    bot: new Set(['Yuumi', 'Janna', 'Nami', 'Milio', 'Renata', 'Soraka', 'Taric', 'Braum', 'Rakan', 'Alistar', 'Leona', 'Rell']),
    support: new Set(),
  };

  const SLICE_COLORS = ['#13294b', '#0b1a30', '#1d3b5e', '#102238'];

  // ---------- Fun buildek ----------
  // A champion profilja a Riot "info" értékeiből (0–10) jön; ahol ez nem tükrözi
  // a valós játékot, ezek a listák javítják.
  // Jarvan IV: az E-je varázserőből is sebez; Yasuo: full AP fun build.
  const AP_EXTRA = new Set(['Gwen', 'Kaisa', 'KogMaw', 'Volibear', 'Shyvana', 'Udyr', 'Varus', 'JarvanIV', 'Yasuo']);
  const AP_EXCLUDE = new Set(['Belveth', 'DrMundo', 'Jhin', 'KSante', 'Senna']);
  // Az AP tank buildhez a Riot adataiban kevés a varázserejük, mégis működik velük.
  const APTANK_EXTRA = new Set(['JarvanIV']);
  // Teemo: AD (lethality, kritikus csapás) és on-hit buildek is.
  const AD_EXTRA = new Set(['Belveth', 'Nidalee', 'Teemo']);
  const CRIT_EXTRA = new Set(['Nidalee']);
  const AD_EXCLUDE = new Set(['Azir', 'Diana', 'Elise', 'Gwen', 'Hwei', 'Kennen']);
  const AP_ONHIT_EXTRA = new Set(['Kayle', 'Teemo', 'Kaisa', 'Gwen', 'KogMaw', 'Varus', 'Katarina']);
  // A Vámpír build csak nekik jár: a képességeikben életlopás vagy mindenevő vámpírság van,
  // vagy az okozott sebzésük egy részét visszagyógyítják (a Riot képességleírásai alapján).
  const LIFESTEAL_CHAMPS = new Set([
    'Aatrox', 'Ambessa', 'Aphelios', 'Belveth', 'Briar', 'Hecarim', 'Kayn', 'KSante', 'LeeSin',
    'Nasus', 'Nilah', 'Olaf', 'Renekton', 'Samira', 'Udyr', 'Viego', 'Warwick', 'Zaahen',
  ]);
  // Néhány championnál a Riot adataiban minden érték 0.
  const INFO_FIX = {
    Akshan: { attack: 8, defense: 3, magic: 2 },
    Qiyana: { attack: 9, defense: 2, magic: 2 },
    Rell: { attack: 3, defense: 8, magic: 6 },
    Seraphine: { attack: 1, defense: 3, magic: 8 },
    Vex: { attack: 1, defense: 3, magic: 9 },
  };

  // A pool, boots és keystones mező vagy egy lista, vagy profilonként ({ ad, ap, tank }) külön lista.
  // pool: a tárgyak vásárlási sorrendben; az első kettő mindig bekerül, a többiből véletlenszerűen
  // választ, de a kiválasztottakat is ebben a sorrendben adja vissza.
  const BUILDS = [
    {
      id: 'ap', name: 'Teljes AP', color: '#5b2f9e',
      desc: 'Minden pont varázserőbe: egy kombó, és a célpont már nincs is.',
      pool: [6655, 4645, 4646, 3118, 3100, 3165, 3157, 3137, 3135],
      // Rabadon mindig az utolsó tárgy, lane-től függetlenül.
      last: 3089,
      boots: [3020],
      keystones: ['Electrocute', 'ArcaneComet', 'DarkHarvest', 'FirstStrike'],
      shards: [5008, 5008, 5001],
      ok: p => p.ap,
    },
    {
      id: 'aponhit', name: 'AP on-hit', color: '#7a3c8f',
      desc: 'Varázserő és támadási sebesség: minden ütésed egy kis varázslat.',
      pool: [3115, 3124, 4633, 3116, 3100, 4645, 3089, 3157, 3135],
      boots: [3006, 3020],
      keystones: ['LethalTempo', 'PressTheAttack', 'HailOfBlades'],
      shards: [5005, 5008, 5001],
      ok: p => (p.ap && p.attack >= 6) || AP_ONHIT_EXTRA.has(p.id),
    },
    {
      id: 'aptank', name: 'AP tank', color: '#3d4f9e',
      desc: 'Szívós vagy, mégis fáj: tankolás varázserővel megfűszerezve.',
      pool: [6653, 4633, 3068, 3116, 8010, 4401, 3075, 2502, 3157],
      boots: [3047, 3111],
      keystones: ['Conqueror', 'GraspOfTheUndying', 'PhaseRush', 'Aftershock'],
      shards: [5007, 5001, 5013],
      ok: p => (p.magic >= 5 && p.defense >= 5) || APTANK_EXTRA.has(p.id),
    },
    {
      id: 'lethality', name: 'Lethality', color: '#8f2a2a',
      desc: 'Páncéltörés és kitörő sebzés: vadászd le a puha célpontokat.',
      // Az első tárgy mindig Gőg (Hubris).
      pool: [6697, 3142, 6698, 6696, 3814, 6676, 6694, 3156],
      boots: [3158, 3047],
      keystones: ['Electrocute', 'DarkHarvest', 'FirstStrike', 'HailOfBlades'],
      shards: [5008, 5008, 5001],
      ok: p => p.ad,
    },
    {
      id: 'crit', name: 'Kritikus csapás', color: '#b5652a',
      desc: 'Minden ütés kritikus: lassan indul, de a végén minden olvad tőle.',
      pool: [6672, 3031, 3095, 3094, 3046, 6676, 3036, 3033, 3072, 3026],
      boots: [3006],
      keystones: ['LethalTempo', 'PressTheAttack', 'FleetFootwork', 'HailOfBlades'],
      shards: [5005, 5008, 5001],
      ok: p => p.ad && (p.has('Marksman') || p.attack >= 7 || CRIT_EXTRA.has(p.id)),
    },
    {
      id: 'onhit', name: 'On-hit', color: '#9e7a2a',
      desc: 'Gyors ütések ráadás-sebzéssel: a hosszú harcok királya vagy.',
      pool: [3153, 3124, 3091, 3302, 6672, 3139, 6673, 3026],
      boots: [3006],
      keystones: ['LethalTempo', 'PressTheAttack', 'Conqueror'],
      shards: [5005, 5008, 5001],
      ok: p => p.ad && (p.has('Marksman') || p.has('Fighter') || p.attack >= 7),
    },
    {
      id: 'bruiser', name: 'Bruiser', color: '#7a4a2a',
      desc: 'Sebzés és túlélés egyensúlya: a csatatér közepén a helyed.',
      pool: [3078, 6610, 3071, 3161, 3073, 3748, 3181, 3053, 6333, 3065],
      boots: [3047, 3111],
      keystones: ['Conqueror', 'GraspOfTheUndying', 'PhaseRush'],
      shards: [5008, 5008, 5013],
      ok: p => p.melee && p.attack >= 5 && (p.has('Fighter') || p.has('Tank') || p.has('Assassin')),
    },
    {
      id: 'tank', name: 'Teljes tank', color: '#2f6b4f',
      desc: 'Csak életerő és páncél: sebzés nélkül is te leszel a csapat fala.',
      pool: [3084, 3068, 6665, 3075, 4401, 3143, 2502, 3110, 3065],
      boots: [3047, 3111],
      keystones: ['GraspOfTheUndying', 'Aftershock', 'Guardian'],
      shards: [5007, 5001, 5013],
      ok: p => p.has('Tank') || p.has('Fighter') || (p.has('Support') && p.melee),
    },
    {
      id: 'heartsteel', name: 'HP-halmozás', color: '#2a7a6b',
      desc: 'Acélos szív és Warmog: nőj óriásira, és üss a saját életerőddel.',
      pool: [3084, 3083, 3068, 6665, 3065, 2502, 3143, 4401],
      boots: [3047, 3111],
      keystones: ['GraspOfTheUndying', 'Aftershock'],
      shards: [5007, 5001, 5001],
      ok: p => (p.has('Tank') || p.has('Fighter')) && p.defense >= 5,
    },
    {
      id: 'lifesteal', name: 'Vámpír', color: '#7a1f3d',
      desc: 'Életlopás mindenből: amíg ütsz, addig nem halsz meg.',
      pool: [3153, 3074, 3072, 6673, 6610, 3031, 6333, 3036],
      boots: [3008],
      keystones: ['Conqueror', 'FleetFootwork', 'LethalTempo'],
      shards: [5005, 5008, 5001],
      // Csak azok kapják, akiknek a képességeiben is van életlopás.
      ok: p => p.ad && LIFESTEAL_CHAMPS.has(p.id),
    },
    {
      id: 'enchanter', name: 'Enchanter', color: '#2a8f8a',
      desc: 'Pajzsok és gyógyítás: a csapatod lesz a fegyvered.',
      pool: [6617, 6620, 3504, 6616, 2065, 6621, 3107, 3222, 4005],
      boots: [3158, 3009],
      keystones: ['SummonAery', 'Guardian', 'UnsealedSpellbook'],
      shards: [5007, 5008, 5001],
      ok: p => p.has('Support') && p.magic >= 5,
    },
    {
      id: 'tear', name: 'Mana-halmozás', color: '#2a5f9e',
      desc: 'Könnycsepp-tárgyakra építesz: lassan éled, de a végén hatalmas.',
      // Csak manát adó tárgyak, és nem pótol más tárgyakkal (onlyPool). A Könnycsepp-tárgyakból
      // (Arkangyal, Manamún, Közelgő tél) egyszerre csak egy lehet, AD-s mana-tárgy pedig csak
      // a Manamún van, ezért ez a build csak a varázserős, manát használó championoknak jár.
      pool: {
        ap: [3003, 6655, 3118, 2503, 6657, 2522, 3110],
        ad: [3003, 6655, 3118, 2503, 6657, 2522, 3110],
        tank: [3119, 3110, 6657, 3118, 2503, 6655, 2522],
      },
      onlyPool: true,
      boots: { ap: [3020], ad: [3020], tank: [3047] },
      keystones: { ap: ['ArcaneComet', 'PhaseRush'], ad: ['ArcaneComet', 'PhaseRush'], tank: ['GraspOfTheUndying', 'ArcaneComet'] },
      shards: { ap: [5007, 5008, 5001], ad: [5007, 5008, 5001], tank: [5007, 5001, 5013] },
      ok: p => p.mana && p.ap,
    },
    {
      id: 'ms', name: 'Mozgási sebesség', color: '#1f7a9e',
      desc: 'Senki nem ér utol: te leszel a leggyorsabb a pályán.',
      // Holtak vértje mindig benne van az extra futásért.
      pool: {
        ad: [3142, 3742, 6631, 3078, 3046, 6610, 6672],
        ap: [3152, 3742, 4646, 4629, 2065, 6655, 3089],
        tank: [3742, 3068, 3050, 4401, 3084, 3143],
      },
      boots: [3009],
      // Viharos lendület: a legtöbb mozgási sebességet adó fő rúna.
      keystones: ['PhaseRush'],
      shards: [5008, 5010, 5013],
      ok: () => true,
    },
    {
      id: 'haste', name: 'Képesség-gyorsítás', color: '#4a6b9e',
      desc: 'Szinte nincs töltési idő: képesség képesség hátán.',
      pool: {
        ad: [3071, 3161, 3073, 6610, 3142, 6333, 6694],
        ap: [3118, 4629, 6655, 6653, 3165, 3157, 3137],
        tank: [3068, 3110, 6665, 3050, 4401, 3084, 2504],
      },
      boots: [3158],
      keystones: ['ArcaneComet', 'UnsealedSpellbook', 'PhaseRush', 'Conqueror'],
      shards: { ad: [5007, 5008, 5001], ap: [5007, 5008, 5001], tank: [5007, 5001, 5013] },
      ok: () => true,
    },
  ];
  // Más nyelven a buildek neve és leírása az i18n.js-ből jön.
  const BUILD_TEXT = (window.LOL_BUILD_TEXT || {})[LANG];
  if (BUILD_TEXT) BUILDS.forEach(b => { if (BUILD_TEXT[b.id]) [b.name, b.desc] = BUILD_TEXT[b.id]; });
  const BUILD_BY_ID = new Map(BUILDS.map(b => [b.id, b]));

  // Ha a build saját tárgyai elfogynak (pl. kivettek egy tárgyat a játékból), ezekből pótol.
  const FALLBACK_POOL = {
    ad: [6672, 3153, 3031, 3071, 3046, 3072, 6673, 6333, 3036, 3026],
    ap: [6655, 4645, 4646, 3100, 3116, 3089, 3165, 3157, 3135],
    tank: [3084, 3068, 6665, 3075, 4401, 3143, 3083, 2502, 3110, 3065],
  };
  // A pótlás a build típusához illik, nem a champion profiljához (pl. az AD Teemo
  // on-hit buildjébe ne kerüljön varázserős tárgy). A többi build a profil szerint pótol.
  const FALLBACK_BY_BUILD = {
    ap: 'ap', aponhit: 'ap',
    lethality: 'ad', crit: 'ad', onhit: 'ad', bruiser: 'ad', lifesteal: 'ad',
    tank: 'tank', heartsteel: 'tank',
  };
  // Egymást kizáró tárgyak: a játékban az ugyanebből az alapanyagból épülő tárgyakból
  // egyszerre csak egy lehet nálad. A csoportokat a tárgyfából számolja ki (loadItems),
  // így az új tárgyakat is magától felismeri.
  const GROUP_COMPONENTS = {
    3057: 'Varázspenge',     // Ragyogás: Háromság hatalma, Félholt csapás, Jégkesztyű…
    3035: 'Utolsó suttogás', // Lord Dominik, Halálos emlékeztető, Serylda…
    3077: 'Hidra',           // Tiamat: hidrák, Megtorpantó
    3070: 'Könnycsepp',      // Arkangyal, Manamún, Közelgő tél…
    4630: 'Pusztítás',       // Pusztító ékkő: Az Üresség botja, Kriptavirág
    6660: 'Égetés',          // Bami parazsa: Naptűz égisz, Hollow Radiance
    3140: 'Higanyléptű',     // Higanyléptű öv
  };
  // Ezek nem közös alapanyagból épülnek, de szintén kizárják egymást.
  const MANUAL_GROUPS = {
    'Életmentő': [3053, 6673, 3156], // Sterak, Halhatatlan pajzsíj, Malmortius
  };
  const MELEE_ONLY = new Set([3074, 3748, 6698, 6631]);

  // A support tárgy végső fejlesztése és a jungle pet a build típusa szerint.
  const SUPPORT_ITEM = {
    tank: 3869, heartsteel: 3869, aptank: 3869,
    enchanter: [3870, 3876], ms: 3876,
    ap: 3871, aponhit: 3871,
    lethality: 3877, crit: 3877, onhit: 3877, lifesteal: 3877, bruiser: 3877,
  };
  const SUPPORT_BY_KIND = { ap: 3871, ad: 3877, tank: 3869 };
  const JUNGLE_PET = { tank: 1103, heartsteel: 1103, aptank: 1103, ms: 1102 };
  const JUNGLE_PET_BY_KIND = { ap: 1101, ad: 1101, tank: 1103 };

  function profileOf(c) {
    const { attack, defense, magic } = INFO_FIX[c.id] || c.info;
    const ap = !AP_EXCLUDE.has(c.id) && (magic >= 6 || AP_EXTRA.has(c.id));
    const ad = !AD_EXCLUDE.has(c.id) && (attack >= 6 || AD_EXTRA.has(c.id));
    const tanky = c.tags[0] === 'Tank' || (c.tags[0] === 'Support' && !ap);
    const kind = tanky ? 'tank' : ap && (magic >= attack || !ad) ? 'ap' : ad ? 'ad' : 'tank';
    return {
      id: c.id, attack, defense, magic, ap, ad, kind,
      melee: c.range <= 250,
      mana: c.partype === 'Mana',
      has: tag => c.tags.includes(tag),
    };
  }

  const buildsFor = c => {
    const p = profileOf(c);
    return BUILDS.filter(b => b.ok(p));
  };

  const pick = arr => arr[randomInt(arr.length)];
  const asList = v => (Array.isArray(v) ? v : [v]);

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const getItem = id => itemData.get(String(id)) || null;

  // lastId: ha meg van adva (és elérhető), ez mindig bekerül, utolsó tárgyként.
  function chooseItems(pool, fallback, count, melee, lastId) {
    const order = [...pool.slice(0, 2), ...shuffle(pool.slice(2)), ...shuffle(fallback)];
    const out = [];
    const seen = new Set();
    const usedGroups = new Set();
    const last = lastId ? getItem(lastId) : null;
    if (last) {
      seen.add(last.id);
      (itemGroups.get(last.id) || []).forEach(g => usedGroups.add(g));
      count -= 1;
    }
    for (const id of order) {
      if (out.length >= count) break;
      if (seen.has(id)) continue;
      seen.add(id);
      const it = getItem(id);
      // Ha egy tárgy kikerült a játékból, egyszerűen kimarad.
      if (!it || (!melee && MELEE_ONLY.has(id))) continue;
      const groups = itemGroups.get(id) || [];
      if (groups.some(g => usedGroups.has(g))) continue;
      groups.forEach(g => usedGroups.add(g));
      out.push(it);
    }
    // Vásárlási sorrend: előbb a build saját tárgyai a megadott sorrendben, utána a pótlások.
    const rank = id => {
      const i = pool.indexOf(id);
      return i >= 0 ? i : pool.length + fallback.indexOf(id);
    };
    out.sort((a, b) => rank(a.id) - rank(b.id));
    if (last) out.push(last);
    return out;
  }

  function spellsFor(laneId, build) {
    const ms = build.id === 'ms';
    const options = {
      top: ms ? ['SummonerHaste'] : ['SummonerTeleport', 'SummonerDot', 'SummonerHaste'],
      mid: ms ? ['SummonerHaste'] : ['SummonerDot', 'SummonerTeleport', 'SummonerBarrier', 'SummonerBoost'],
      bot: ms ? ['SummonerHaste'] : ['SummonerHeal', 'SummonerBarrier', 'SummonerBoost'],
      support: build.id === 'enchanter' ? ['SummonerExhaust', 'SummonerHeal']
        : ['tank', 'heartsteel', 'aptank'].includes(build.id) ? ['SummonerDot', 'SummonerExhaust']
          : ['SummonerDot', 'SummonerExhaust', 'SummonerHeal'],
    };
    const ids = laneId === 'jungle'
      ? ['SummonerSmite', ms ? 'SummonerHaste' : 'SummonerFlash']
      : ['SummonerFlash', pick(options[laneId])];
    return ids.map(id => spellData.get(id)).filter(Boolean);
  }

  function runePage(keystoneKeys) {
    const valid = keystoneKeys.filter(k => runeTrees.some(t => t.slots[0].some(r => r.key === k)));
    if (!valid.length) return null;
    const keyKey = pick(valid);
    const primary = runeTrees.find(t => t.slots[0].some(r => r.key === keyKey));
    const keystone = primary.slots[0].find(r => r.key === keyKey);
    const primaryRunes = primary.slots.slice(1).map(s => pick(s));
    const secondary = pick(runeTrees.filter(t => t !== primary));
    const rows = shuffle([1, 2, 3]).slice(0, 2).sort();
    const secondaryRunes = rows.map(i => pick(secondary.slots[i]));
    return { primary, keystone, primaryRunes, secondary, secondaryRunes };
  }

  // Soronként (Támadás, Rugalmas, Védekezés) a buildhez megadott érték, ha az abban a sorban választható.
  function statShards(wanted) {
    return shardSlots.map((slot, i) => {
      const shard = slot.shards.find(s => s.id === wanted[i]) || slot.shards[0];
      return shard && { ...shard, slot: slot.label };
    }).filter(Boolean);
  }

  // A teljes build: idézői varázslatok, rúnák és a lane szerinti tárgyak.
  function makeFullBuild(champ, build, laneId) {
    const p = profileOf(champ);
    const lane = LANE_BY_ID.get(laneId);
    const byKind = v => (Array.isArray(v) ? v : v[p.kind]);
    const items = [];
    let starter = null;

    if (laneId === 'jungle') {
      starter = getItem(JUNGLE_PET[build.id] || JUNGLE_PET_BY_KIND[p.kind]);
    }
    if (laneId === 'support') {
      const sup = getItem(pick(asList(SUPPORT_ITEM[build.id] || SUPPORT_BY_KIND[p.kind])));
      if (sup) items.push({ ...sup, note: 'support' });
    }
    let boots = getItem(pick(byKind(build.boots)));
    const upgraded = boots && laneId === 'mid' && getItem(bootUpgrade.get(boots.id));
    if (upgraded) {
      boots = { ...upgraded, note: 'bootsUp' };
    } else if (boots) {
      boots = { ...boots, note: 'boots' };
    }
    const fallback = build.onlyPool ? [] : FALLBACK_POOL[FALLBACK_BY_BUILD[build.id] || p.kind];
    const core = chooseItems(byKind(build.pool), fallback, lane.items, p.melee, build.last);
    // A cipő általában az első tárgy után jön; supportnál és a gyorsaság buildnél már előtte.
    const bootsFirst = laneId === 'support' || build.id === 'ms';
    if (boots && bootsFirst) items.push(boots);
    if (core.length) items.push(core[0]);
    if (boots && !bootsFirst) items.push(boots);
    items.push(...core.slice(1));

    return {
      build,
      lane,
      spells: spellsFor(laneId, build),
      runes: runePage(byKind(build.keystones)),
      shards: statShards(byKind(build.shards)),
      starter: starter && { ...starter, note: 'starter' },
      items,
    };
  }

  // A tárgyak megjegyzése egy kulcs (support, boots, bootsUp, starter); a régi
  // előzményekben még magyar szövegként van elmentve.
  const LEGACY_NOTE = { 'Support tárgy': 'support', 'Cipő': 'boots', 'Fejlesztett cipő': 'bootsUp', 'Kezdő tárgy': 'starter' };
  const noteKey = note => LEGACY_NOTE[note] || note;

  // ---------- Kerék ----------
  const mod = (a, m) => ((a % m) + m) % m;

  function randomInt(max) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  class Wheel {
    // opts: label(item), color(item, i, n), labelLimit, fontScale
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts;
      this.items = [];
      this.rotation = 0;
      this.spinning = false;
      this.highlightIdx = -1;
      this.highlightAlpha = 0;
    }

    setItems(items) {
      this.items = items;
      this.rotation = 0;
      this.highlightIdx = -1;
      this.draw();
    }

    resize() {
      const size = this.canvas.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.draw();
    }

    draw() {
      const { ctx, items, opts } = this;
      const w = this.canvas.width;
      if (!w) return;
      const r = w / 2;
      const n = items.length;
      ctx.clearRect(0, 0, w, w);

      if (!n) {
        ctx.fillStyle = SLICE_COLORS[1];
        ctx.beginPath();
        ctx.arc(r, r, r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const seg = (Math.PI * 2) / n;
      const labeled = n <= opts.labelLimit;
      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(this.rotation);

      for (let i = 0; i < n; i++) {
        // A 0. szelet a 12 óránál kezdődik.
        const start = i * seg - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, start, start + seg);
        ctx.closePath();
        ctx.fillStyle = opts.color(items[i], i, n);
        ctx.fill();
        if (labeled) {
          ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
          ctx.lineWidth = Math.max(1, w / 900);
          ctx.stroke();

          ctx.save();
          ctx.rotate(start + seg / 2);
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f0e6d2';
          const fontSize = Math.min(w * opts.fontScale, (seg * r * 0.8) * 0.75);
          ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
          ctx.fillText(opts.label(items[i]), r * 0.93, 0, r * 0.6);
          ctx.restore();
        }
      }

      if (this.highlightIdx >= 0 && this.highlightIdx < n) {
        // A nyertes szelet felvillan és arany keretet kap.
        const start = this.highlightIdx * seg - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, start, start + seg);
        ctx.closePath();
        ctx.fillStyle = `rgba(240, 230, 210, ${this.highlightAlpha})`;
        ctx.fill();
        ctx.strokeStyle = '#f0e6d2';
        ctx.lineWidth = Math.max(2, w / 250);
        ctx.stroke();
      }
      ctx.restore();

      // Belső arany gyűrű a gomb körül
      ctx.beginPath();
      ctx.arc(r, r, r * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#785a28';
      ctx.fill();
    }

    // A mutató (12 óra) alatt lévő szelet indexe.
    indexAtPointer() {
      const n = this.items.length;
      const seg = (Math.PI * 2) / n;
      return Math.min(n - 1, Math.floor(mod(-this.rotation, Math.PI * 2) / seg));
    }

    // Elindítja a pörgést, és visszaadja a (már eldöntött) nyertest.
    spin(duration, tickerEl, onDone) {
      const n = this.items.length;
      if (this.spinning || !n) return null;
      this.spinning = true;
      this.highlightIdx = -1;

      const seg = (Math.PI * 2) / n;
      const winner = randomInt(n);
      // Véletlen eltolás a szeleten belül, hogy ne mindig középen álljon meg.
      const jitter = (Math.random() - 0.5) * seg * 0.7;
      const targetMod = mod(-((winner + 0.5) * seg + jitter), Math.PI * 2);
      const startRot = this.rotation;
      const endRot = startRot + (5 + randomInt(3)) * Math.PI * 2 + mod(targetMod - startRot, Math.PI * 2);
      const t0 = performance.now();
      let lastIdx = -1;
      let done = false;

      const frame = (now, skipped = false) => {
        if (done) return;
        const t = skipped ? 1 : Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - t, 4);
        this.rotation = startRot + (endRot - startRot) * eased;
        this.draw();
        const idx = this.indexAtPointer();
        if (idx !== lastIdx) {
          tickerEl.textContent = this.opts.label(this.items[idx]);
          lastIdx = idx;
        }
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          done = true;
          this.skipSpin = null;
          this.rotation = mod(endRot, Math.PI * 2);
          this.draw();
          this.spinning = false;
          const won = this.indexAtPointer();
          this.flash(won);
          onDone(this.items[won]);
        }
      };
      this.skipSpin = () => frame(performance.now(), true);
      requestAnimationFrame(frame);
      return this.items[winner];
    }

    // Pörgés közben: azonnal a végeredményre ugrik.
    skip() {
      if (this.spinning && this.skipSpin) this.skipSpin();
    }

    // Pörgés nélkül a mutató alá forgatja és kiemeli az adott szeletet.
    pointAt(idx) {
      const n = this.items.length;
      if (idx < 0 || !n) return;
      const seg = (Math.PI * 2) / n;
      this.rotation = mod(-(idx + 0.5) * seg, Math.PI * 2);
      this.highlightIdx = idx;
      this.highlightAlpha = 0.35;
      this.draw();
    }

    flash(idx) {
      this.highlightIdx = idx;
      if (reducedMotion) {
        this.highlightAlpha = 0.35;
        this.draw();
        return;
      }
      const t0 = performance.now();
      const DURATION = 2400;
      const frame = now => {
        if (this.highlightIdx !== idx || this.spinning) return;
        const t = Math.min(1, (now - t0) / DURATION);
        // Négyszer felvillan, majd halvány kiemelésben marad.
        const pulse = (Math.sin(t * Math.PI * 8 - Math.PI / 2) + 1) / 2;
        this.highlightAlpha = 0.25 + pulse * 0.45 * (1 - t);
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  // ---------- Állapot ----------
  const $ = id => document.getElementById(id);
  const spinBtn = $('spinBtn');
  const buildSpinBtn = $('buildSpinBtn');

  let version = '';
  let champions = [];         // összes champion
  let pool = [];              // a szűrés után a keréken lévők
  let itemData = new Map();   // megvásárolható tárgyak: id -> { id, name, desc, gold }
  let bootUpgrade = new Map(); // cipő id -> fejlesztett cipő id
  let itemGroups = new Map();  // tárgy id -> az egymást kizáró csoportjai
  let editorItems = [];        // a build-javasló választható tárgyai
  let runeTrees = [];
  let spellData = new Map();
  let shardSlots = [];        // [{ label, shards: [{ id, name, desc, icon }] }]
  let currentChamp = null;
  let lane = null;
  const activeRoles = new Set(); // üres = minden champion a keréken van

  try {
    const saved = localStorage.getItem(LANE_KEY);
    if (LANE_BY_ID.has(saved)) lane = saved;
  } catch { /* nem elérhető */ }

  const champWheel = new Wheel($('wheel'), {
    label: c => c.name,
    color: (c, i, n) => {
      if (n > 40) {
        // Sok szeletnél színátmenet, hogy a forgás jól látsszon.
        return `hsl(${(i / n) * 360}, 45%, ${i % 2 ? 26 : 32}%)`;
      }
      if (i === n - 1 && n % SLICE_COLORS.length === 1) return SLICE_COLORS[2];
      return SLICE_COLORS[i % SLICE_COLORS.length];
    },
    labelLimit: 40,
    fontScale: 0.034,
  });

  const buildWheel = new Wheel($('buildWheel'), {
    label: b => b.name,
    color: b => b.color,
    labelLimit: 40,
    fontScale: 0.045,
  });

  // ---------- Adatok ----------
  async function loadData() {
    showError(null);
    $('champCount').textContent = t('count.loading');
    try {
      const versions = await fetchJson(`${DDRAGON}/api/versions.json`);
      version = versions[0];
      const data = path => `${DDRAGON}/cdn/${version}/data/${LOCALE}/${path}`;
      // A tárgyak, rúnák és varázslatok nélkül is működik a sorsolás, csak a build lesz hiányos.
      const optional = p => fetchJson(data(p)).catch(err => { console.warn(err); return null; });
      const cdragon = p => fetchJson(CDRAGON_DATA + p).catch(err => { console.warn(err); return null; });
      const [champJson, itemJson, runeJson, spellJson, perkJson, styleJson] = await Promise.all([
        fetchJson(data('champion.json')),
        optional('item.json'),
        optional('runesReforged.json'),
        optional('summoner.json'),
        cdragon('perks.json'),
        cdragon('perkstyles.json'),
      ]);
      loadShards(perkJson, styleJson);
      champions = Object.values(champJson.data)
        .map(c => ({
          id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags,
          info: c.info, partype: c.partype, range: c.stats.attackrange,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, SORT_LOCALE));
      loadItems(itemJson ? itemJson.data : {});
      runeTrees = (runeJson || []).map(t => ({
        key: t.key, name: t.name, icon: t.icon,
        slots: t.slots.map(s => s.runes.map(r => ({ key: r.key, name: r.name, icon: r.icon }))),
      }));
      spellData = new Map(Object.values(spellJson ? spellJson.data : {})
        .filter(s => s.modes.includes('CLASSIC'))
        .map(s => [s.id, { id: s.id, name: s.name }]));
      $('versionInfo').textContent = t('version', version, champions.length);
      applyFilter();
      renderLists();
      resumeAfterLanguageSwitch();
    } catch (err) {
      console.error(err);
      $('champCount').textContent = '';
      showError(t('error.load'));
    }
  }

  function loadItems(raw) {
    const entries = Object.entries(raw).filter(([, it]) => it.gold && it.gold.purchasable && it.maps && it.maps['11']);
    itemData = new Map(entries.map(([id, it]) => [id, {
      id: Number(id), name: it.name, desc: it.description || '', gold: it.gold.total,
    }]));
    // Fejlesztett cipő: az a tárgy, ami egyetlen (2. szintű) cipőből épül.
    const boots = new Set(entries
      .filter(([, it]) => (it.tags || []).includes('Boots') && (it.from || []).includes('1001'))
      .map(([id]) => id));
    bootUpgrade = new Map(entries
      .filter(([, it]) => it.from && it.from.length === 1 && boots.has(it.from[0]))
      .map(([id, it]) => [Number(it.from[0]), Number(id)]));

    // Egymást kizáró csoportok: melyik tárgy fájában szerepel valamelyik csoport-alapanyag.
    const components = id => {
      const found = new Set();
      const walk = i => ((raw[i] && raw[i].from) || []).forEach(f => { found.add(f); walk(f); });
      walk(id);
      return found;
    };
    itemGroups = new Map();
    const addGroup = (id, group) => itemGroups.set(id, [...(itemGroups.get(id) || []), group]);
    for (const [id] of entries) {
      const parts = components(id);
      for (const [comp, group] of Object.entries(GROUP_COMPONENTS)) {
        if (parts.has(comp)) addGroup(Number(id), group);
      }
    }
    for (const [group, ids] of Object.entries(MANUAL_GROUPS)) ids.forEach(id => addGroup(id, group));

    // A build-javasló választható tárgyai: csak végleges tárgyak (és a 2. szintű cipők),
    // alapanyagok, italok, őrök és championhoz kötött tárgyak nélkül.
    const bootIds = new Set([...[...boots].map(Number), ...bootUpgrade.values()]);
    const seenNames = new Set();
    editorItems = entries
      .filter(([id, it]) => (!it.into || !it.into.length || boots.has(id))
        && (it.tags || []).length
        && !(it.tags || []).some(t => t === 'Consumable' || t === 'Trinket')
        && !it.requiredChampion && !it.requiredAlly && id !== '1001')
      .sort(([a], [b]) => Number(a) - Number(b))
      // A játékban van néhány azonos nevű változat (pl. jungle petek): csak egyet mutat.
      .filter(([, it]) => !seenNames.has(it.name) && seenNames.add(it.name))
      .map(([id, it]) => {
        const tags = it.tags || [];
        const has = (...t) => t.some(x => tags.includes(x));
        const kind = bootIds.has(Number(id)) ? 'boots'
          : has('GoldPer') ? 'support'
            : has('Jungle') ? 'jungle'
              : has('Lane') ? 'starter' : null;
        const cats = new Set(['all']);
        if (kind === 'boots') cats.add('boots');
        if (kind === 'support' || kind === 'jungle' || kind === 'starter') cats.add('special');
        if (!kind && has('Damage', 'CriticalStrike', 'AttackSpeed', 'ArmorPenetration', 'OnHit', 'LifeSteal')) cats.add('ad');
        if (!kind && has('SpellDamage', 'MagicPenetration')) cats.add('ap');
        if (!kind && has('Armor', 'SpellBlock', 'MagicResist', 'Health')) cats.add('def');
        return { id: Number(id), name: it.name, kind, cats };
      })
      .sort((a, b) => a.name.localeCompare(b.name, SORT_LOCALE));
  }

  function loadShards(perks, styles) {
    if (!perks || !styles || !styles.styles || !styles.styles.length) return;
    const byId = new Map(perks.map(p => [p.id, p]));
    const strip = html => html.replace(/<[^>]+>/g, '').trim();
    shardSlots = styles.styles[0].slots
      .filter(s => s.type === 'kStatMod')
      .map(s => ({
        label: s.slotLabel,
        shards: s.perks.map(id => byId.get(id)).filter(Boolean).map(p => ({
          id: p.id,
          name: p.name,
          desc: strip(p.shortDesc),
          icon: CDRAGON_ASSETS + p.iconPath.replace('/lol-game-data/assets/', '').toLowerCase(),
        })),
      }));
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} – ${url}`);
    return res.json();
  }

  const iconUrl = id => `${DDRAGON}/cdn/${version}/img/champion/${id}.png`;
  const splashUrl = id => `${DDRAGON}/cdn/img/champion/splash/${id}_0.jpg`;
  const itemIconUrl = id => `${DDRAGON}/cdn/${version}/img/item/${id}.png`;
  const spellIconUrl = id => `${DDRAGON}/cdn/${version}/img/spell/${id}.png`;
  const runeIconUrl = icon => `${DDRAGON}/cdn/img/${icon}`;
  const laneIconUrl = l => `${LANE_ICON_BASE}icon-position-${l.icon}.png`;

  function showError(message) {
    $('errorBox').hidden = !message;
    $('errorText').textContent = message || '';
  }

  // ---------- Lane és szűrés ----------
  function renderLaneButtons() {
    const wrap = $('laneButtons');
    for (const l of LANES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lane-btn';
      btn.dataset.lane = l.id;
      btn.setAttribute('aria-pressed', String(lane === l.id));
      const img = document.createElement('img');
      img.src = laneIconUrl(l);
      img.alt = '';
      const span = document.createElement('span');
      span.textContent = l.label;
      btn.append(img, span);
      btn.addEventListener('click', () => {
        if (champWheel.spinning) return;
        setLane(l.id);
      });
      wrap.appendChild(btn);
    }
    $('laneButtons').classList.toggle('has-selection', !!lane);
  }

  function setLane(laneId) {
    lane = laneId;
    try { localStorage.setItem(LANE_KEY, lane); } catch { /* nem elérhető */ }
    document.querySelectorAll('.lane-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lane === lane)));
    $('searchHint').textContent = '';
    applyFilter();
  }

  function renderRoleButtons() {
    const wrap = $('roleButtons');
    for (const role of ROLES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'role-btn';
      btn.title = role.label;
      btn.setAttribute('aria-label', role.label);
      btn.setAttribute('aria-pressed', 'false');
      const img = document.createElement('img');
      img.src = `${ROLE_ICON_BASE}role-icon-${role.tag.toLowerCase()}.png`;
      img.alt = '';
      // Ha az ikon nem tölt be, a szerepkör neve jelenik meg helyette.
      img.addEventListener('error', () => { btn.classList.add('no-icon'); btn.textContent = role.label; });
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        if (champWheel.spinning) return;
        if (activeRoles.has(role.tag)) activeRoles.delete(role.tag);
        else activeRoles.add(role.tag);
        btn.setAttribute('aria-pressed', String(activeRoles.has(role.tag)));
        applyFilter();
      });
      wrap.appendChild(btn);
    }
  }

  function applyFilter() {
    $('roleButtons').classList.toggle('has-selection', activeRoles.size > 0);
    const bans = lane ? LANE_BANS[lane] : new Set();
    const playable = champions.filter(c => !bans.has(c.id));
    const banned = champions.length - playable.length;
    const banNote = banned ? t('count.banned', banned, LANE_BY_ID.get(lane).label) : '';
    if (activeRoles.size === 0) {
      pool = playable;
      $('champCount').textContent = t('count.wheel', pool.length) + banNote;
    } else {
      pool = playable.filter(c => c.tags.some(tag => activeRoles.has(tag)));
      const labels = ROLES.filter(r => activeRoles.has(r.tag)).map(r => r.label).join(', ');
      $('champCount').textContent = t('count.wheel', pool.length, labels) + banNote;
    }
    champWheel.setItems(pool);
    updateSpinState();
  }

  function updateSpinState() {
    $('laneButtons').classList.toggle('has-selection', !!lane);
    spinBtn.disabled = !champWheel.spinning && (pool.length === 0 || !lane);
    if (!champWheel.spinning) {
      $('ticker').textContent = lane ? ' ' : t('ticker.needLane');
    }
  }

  function setPickersDisabled(disabled) {
    document.querySelectorAll('.role-btn, .lane-btn, #champSearch').forEach(b => { b.disabled = disabled; });
  }

  // ---------- Champion választás név alapján ----------
  // Kisbetűs, ékezet- és írásjelmentes alak, hogy pl. a „kaisa” is megtalálja Kai'Sát.
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const SUGGEST_MAX = 8;
  let suggestions = [];
  let suggestIdx = -1;

  function updateSuggestions() {
    const input = $('champSearch');
    const list = $('champSuggest');
    const q = normalize(input.value);
    if (!q) {
      hideSuggestions();
      return;
    }
    suggestions = champions
      .map(c => ({ c, name: normalize(c.name), id: normalize(c.id) }))
      .filter(x => x.name.includes(q) || x.id.includes(q))
      // Előre azok, akiknek a neve a beírt szöveggel kezdődik.
      .sort((a, b) => (b.name.startsWith(q) - a.name.startsWith(q)) || a.c.name.localeCompare(b.c.name, SORT_LOCALE))
      .slice(0, SUGGEST_MAX)
      .map(x => x.c);
    suggestIdx = suggestions.length ? 0 : -1;

    if (!suggestions.length) {
      list.replaceChildren(textEl('li', t('search.none'), 'suggest-empty'));
    } else {
      list.replaceChildren(...suggestions.map((c, i) => {
        const li = document.createElement('li');
        li.id = `suggest-${i}`;
        li.setAttribute('role', 'option');
        const img = document.createElement('img');
        img.src = iconUrl(c.id);
        img.alt = '';
        const text = document.createElement('div');
        text.append(textEl('span', c.name), textEl('small', c.title));
        li.append(img, text);
        // mousedown, hogy a mező elhagyása (blur) előtt fusson le.
        li.addEventListener('mousedown', e => {
          e.preventDefault();
          pickChampion(c);
        });
        return li;
      }));
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlightSuggestion();
  }

  function highlightSuggestion() {
    const input = $('champSearch');
    $('champSuggest').querySelectorAll('[role="option"]').forEach((li, i) => {
      li.setAttribute('aria-selected', String(i === suggestIdx));
      if (i === suggestIdx) li.scrollIntoView({ block: 'nearest' });
    });
    if (suggestIdx >= 0) input.setAttribute('aria-activedescendant', `suggest-${suggestIdx}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function hideSuggestions() {
    $('champSuggest').hidden = true;
    $('champSearch').setAttribute('aria-expanded', 'false');
    $('champSearch').removeAttribute('aria-activedescendant');
    suggestions = [];
    suggestIdx = -1;
  }

  function onSearchKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if ($('champSuggest').hidden) updateSuggestions();
      if (!suggestions.length) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      suggestIdx = (suggestIdx + step + suggestions.length) % suggestions.length;
      highlightSuggestion();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[suggestIdx]) pickChampion(suggestions[suggestIdx]);
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  }

  // A champion kerék kimarad: a választott championnal rögtön a build kerék jön.
  function pickChampion(champ) {
    if (champWheel.spinning) return;
    if (!lane) {
      $('searchHint').textContent = t('search.needLane');
      return;
    }
    $('champSearch').value = '';
    $('searchHint').textContent = '';
    hideSuggestions();
    $('champSearch').blur();
    preloadSounds(champ);
    playSounds();
    enterBuildStage(champ);
    addChampionEntry(champ.id, lane);
  }

  // ---------- Champion sorsolás ----------
  // Pörgés közben a középső gomb a kihagyás gombja.
  function setSkipMode(btn, on) {
    btn.textContent = on ? t('skip') : t('spin');
    btn.classList.toggle('is-skip', on);
    btn.setAttribute('aria-label', on ? t('skip.aria') : t('spin.aria'));
  }

  function spinChampion() {
    if (champWheel.spinning) {
      champWheel.skip();
      return;
    }
    if (!lane) return;
    const winner = champWheel.spin(CHAMP_SPIN_MS, $('ticker'), champ => {
      setSkipMode(spinBtn, false);
      setPickersDisabled(false);
      playSounds();
      burstFromWheel(champWheel.canvas);
      showReveal({
        label: t('reveal.champ', LANE_BY_ID.get(lane).label),
        name: champ.name,
        title: champ.title,
        splash: splashUrl(champ.id),
      });
      enterBuildStage(champ);
      addChampionEntry(champ.id, lane);
    });
    if (!winner) return;
    setSkipMode(spinBtn, true);
    setPickersDisabled(true);
    preloadSounds(winner);
  }

  function enterBuildStage(champ) {
    currentChamp = champ;
    const l = LANE_BY_ID.get(lane);
    $('bannerIcon').src = iconUrl(champ.id);
    $('bannerName').textContent = champ.name;
    $('bannerTitle').textContent = champ.title;
    $('bannerTags').replaceChildren(laneTagEl(l), ...champ.tags.map(t => tagEl(ROLE_LABEL[t] || t)));
    const banner = $('champBanner');
    banner.style.setProperty('--splash', `url("${splashUrl(champ.id)}")`);
    banner.hidden = false;

    $('champStage').hidden = true;
    $('buildStage').hidden = false;
    $('buildResult').hidden = false;
    $('buildPlaceholder').hidden = false;
    $('buildCard').hidden = true;
    $('buildTicker').innerHTML = '&nbsp;';

    const builds = buildsFor(champ);
    $('buildCount').textContent = t('build.count', builds.length, champ.name, l.label);
    buildWheel.resize();
    buildWheel.setItems(builds);
    window.scrollTo({ top: 0 });
  }

  function leaveBuildStage() {
    if (buildWheel.spinning) return;
    currentChamp = null;
    currentEntryId = null;
    renderLists();
    $('champBanner').hidden = true;
    $('buildStage').hidden = true;
    $('buildResult').hidden = true;
    $('champStage').hidden = false;
    champWheel.resize();
    updateSpinState();
  }

  // ---------- Build sorsolás ----------
  function spinBuild() {
    if (buildWheel.spinning) {
      buildWheel.skip();
      return;
    }
    const champ = currentChamp;
    const laneId = lane;
    const winner = buildWheel.spin(BUILD_SPIN_MS, $('buildTicker'), build => {
      setSkipMode(buildSpinBtn, false);
      $('newChampBtn').disabled = false;
      const full = makeFullBuild(champ, build, laneId);
      const split = splitItems(full);
      burstFromWheel(buildWheel.canvas);
      const extras = [
        ...full.spells.map(s => ({ src: spellIconUrl(s.id), alt: s.name })),
        ...(full.runes ? [{ src: runeIconUrl(full.runes.keystone.icon), alt: full.runes.keystone.name, rune: true }] : []),
      ];
      showReveal({
        label: `Fun build · ${champ.name} · ${full.lane.label}`,
        name: build.name,
        title: build.desc,
        icons: [...split.special, ...split.core].map(it => ({ src: itemIconUrl(it.id), alt: it.name })),
        extras,
      });
      showBuildCard(full);
      addBuildEntry(champ.id, laneId, full);
    });
    if (!winner) return;
    setSkipMode(buildSpinBtn, true);
    $('newChampBtn').disabled = true;
  }

  function showBuildCard(full) {
    const { build } = full;
    $('buildPlaceholder').hidden = true;
    const card = $('buildCard');
    card.hidden = false;
    card.style.setProperty('--build-color', build.color);
    $('buildName').textContent = build.name;
    $('buildDesc').textContent = build.desc;

    $('buildSpells').replaceChildren(...full.spells.map(s => iconWithLabel(spellIconUrl(s.id), s.name, 'spell')));

    const runesEl = $('buildRunes');
    if (full.runes) {
      const { primary, keystone, primaryRunes, secondary, secondaryRunes } = full.runes;
      runesEl.replaceChildren(
        runeTreeEl(primary, [keystone, ...primaryRunes], true),
        runeTreeEl(secondary, secondaryRunes, false),
      );
      if (full.shards.length) runesEl.appendChild(shardListEl(full.shards));
    } else {
      runesEl.replaceChildren(textEl('p', t('runes.na'), 'muted'));
    }

    const { special, core } = splitItems(full);
    const list = [...special, ...core];
    $('buildItems').replaceChildren(...list.map((it, i) => {
      const li = document.createElement('li');
      li.dataset.itemId = it.id;
      li.tabIndex = 0;
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = '';
      const text = document.createElement('div');
      text.appendChild(textEl('span', it.name));
      if (it.note) text.appendChild(textEl('small', t(`note.${noteKey(it.note)}`)));
      li.append(img, text);
      // A speciális tárgyak (kezdő pet, support tárgy, cipő) szaggatott vonallal elválasztva, felül.
      if (i === special.length - 1 && core.length) li.className = 'special-last';
      return li;
    }));
    if (!list.length) $('buildItems').replaceChildren(textEl('li', t('items.na'), 'muted'));
    dropStaleTip();

    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }

  // Speciális tárgyak (megjegyzéssel jelölve) és a többi tárgy vásárlási sorrendben.
  function splitItems(full) {
    const all = [...(full.starter ? [full.starter] : []), ...full.items];
    return { special: all.filter(it => it.note), core: all.filter(it => !it.note) };
  }

  function runeTreeEl(tree, runes, isPrimary) {
    const wrap = document.createElement('div');
    wrap.className = `rune-tree${isPrimary ? ' primary' : ''}`;
    const head = document.createElement('div');
    head.className = 'rune-tree-head';
    const treeIcon = document.createElement('img');
    treeIcon.src = runeIconUrl(tree.icon);
    treeIcon.alt = '';
    head.append(treeIcon, textEl('span', tree.name));
    const row = document.createElement('div');
    row.className = 'rune-row';
    runes.forEach((r, i) => {
      const img = document.createElement('img');
      img.src = runeIconUrl(r.icon);
      img.alt = r.name;
      img.title = r.name;
      if (isPrimary && i === 0) img.className = 'keystone';
      row.appendChild(img);
    });
    wrap.append(head, row);
    if (isPrimary) wrap.appendChild(textEl('p', runes[0].name, 'keystone-name'));
    return wrap;
  }

  function shardListEl(shards) {
    const wrap = document.createElement('div');
    wrap.className = 'rune-tree';
    const head = document.createElement('div');
    head.className = 'rune-tree-head';
    head.appendChild(textEl('span', t('sec.shards')));
    const row = document.createElement('div');
    row.className = 'rune-row shard-row';
    for (const s of shards) {
      const img = document.createElement('img');
      img.src = s.icon;
      img.alt = s.name;
      img.title = `${s.name} (${s.desc})`;
      row.appendChild(img);
    }
    wrap.append(head, row);
    return wrap;
  }

  function iconWithLabel(src, label, cls) {
    const div = document.createElement('div');
    div.className = cls;
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    div.append(img, textEl('span', label));
    return div;
  }

  function textEl(tag, text, cls) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function tagEl(text) {
    return textEl('span', text, 'tag');
  }

  function laneTagEl(l) {
    const span = tagEl(l.label);
    span.classList.add('lane-tag');
    const img = document.createElement('img');
    img.src = laneIconUrl(l);
    img.alt = '';
    span.prepend(img);
    return span;
  }

  // ---------- Hangok ----------
  const voice = new Audio();
  const sfx = new Audio();
  voice.preload = 'auto';
  sfx.preload = 'auto';

  let soundOn = true;
  let volume = 1; // 0–1, a csúszka állása
  try {
    soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    if (localStorage.getItem(VOLUME_KEY) !== null && saved >= 0 && saved <= 1) volume = saved;
  } catch { /* nem elérhető */ }

  function updateSoundBtn() {
    const btn = $('soundBtn');
    const audible = soundOn && volume > 0;
    btn.setAttribute('aria-pressed', String(soundOn));
    btn.title = soundOn ? t('sound.off') : t('sound.on');
    btn.setAttribute('aria-label', btn.title);
    $('soundOnIcon').hidden = !audible;
    $('soundOffIcon').hidden = audible;
    $('volumeSlider').value = String(Math.round(volume * 100));
    $('volumeValue').textContent = `${Math.round(volume * 100)}%`;
  }

  // Az effekthang mindig halkabb a champion hangjánál, a csúszka mindkettőt arányosan állítja.
  function applyVolume() {
    sfx.volume = 0.45 * volume;
    voice.volume = volume;
  }

  function setVolume(percent) {
    volume = Math.min(1, Math.max(0, percent / 100));
    // Ha némítva volt, a csúszka elhúzása visszakapcsolja a hangot.
    if (volume > 0 && !soundOn) {
      soundOn = true;
      try { localStorage.setItem(SOUND_KEY, 'on'); } catch { /* nem elérhető */ }
    }
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* nem elérhető */ }
    applyVolume();
    updateSoundBtn();
  }

  function preloadSounds(champ) {
    voice.src = `${CDRAGON_AUDIO}champion-choose-vo/${champ.key}.ogg`;
    sfx.src = `${CDRAGON_AUDIO}champion-sfx-audios/${champ.key}.ogg`;
    voice.load();
    sfx.load();
  }

  function playSounds() {
    if (!soundOn) return;
    // Mint a champion-választásnál: a champion saját effekthangja és alatta a hangja.
    applyVolume();
    sfx.currentTime = 0;
    voice.currentTime = 0;
    sfx.play().catch(() => {});
    voice.play().catch(() => {});
  }

  function stopSounds() {
    voice.pause();
    sfx.pause();
  }

  // ---------- Effektek ----------
  const fxCanvas = $('fx');
  const fx = fxCanvas.getContext('2d');
  let particles = [];
  let fxRunning = false;
  const PARTICLE_COLORS = ['#f0e6d2', '#c8aa6e', '#e8c77a', '#0ac8b9', '#5be0d6', '#ffffff'];

  function resizeFx() {
    const dpr = window.devicePixelRatio || 1;
    fxCanvas.width = Math.round(window.innerWidth * dpr);
    fxCanvas.height = Math.round(window.innerHeight * dpr);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, count, speed) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.25,
        size: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        spark: Math.random() < 0.4,
      });
    }
    if (!fxRunning) {
      fxRunning = true;
      requestAnimationFrame(stepFx);
    }
  }

  function stepFx() {
    fx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.vy += 0.12;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      fx.globalAlpha = Math.max(0, p.life);
      fx.fillStyle = p.color;
      if (p.spark) {
        fx.shadowColor = p.color;
        fx.shadowBlur = 12;
        fx.beginPath();
        fx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        fx.fill();
        fx.shadowBlur = 0;
      } else {
        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(p.rot);
        fx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        fx.restore();
      }
    }
    fx.globalAlpha = 1;
    if (particles.length) {
      requestAnimationFrame(stepFx);
    } else {
      fxRunning = false;
    }
  }

  function burstFromWheel(wheelCanvas) {
    const rect = wheelCanvas.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + 8, 70, 9);
  }

  let revealTimer = 0;

  // Teljes képernyős bemutató: egy splash kép, vagy ikonsorok (tárgyak, varázslatok, rúna).
  function showReveal({ label, name, title, splash, icons, extras }) {
    hideItemTip();
    const reveal = $('reveal');
    $('revealFrame').hidden = !splash;
    if (splash) {
      $('revealSplash').src = splash;
      $('revealSplash').alt = name;
    }
    fillIconRow($('revealItems'), icons, 0.15);
    fillIconRow($('revealExtras'), extras, 0.15 + (icons ? icons.length : 0) * 0.1);
    $('revealLabel').textContent = label;
    $('revealName').textContent = name;
    $('revealTitle').textContent = title;
    reveal.hidden = false;
    reveal.classList.remove('show');
    void reveal.offsetWidth;
    reveal.classList.add('show');
    burst(window.innerWidth / 2, window.innerHeight * 0.45, 160, 14);
    setTimeout(() => {
      if (!reveal.hidden) burst(window.innerWidth / 2, window.innerHeight * 0.45, 90, 10);
    }, 450);
    clearTimeout(revealTimer);
    revealTimer = setTimeout(hideReveal, REVEAL_MS);
  }

  function fillIconRow(el, icons, delay) {
    el.hidden = !icons || !icons.length;
    el.replaceChildren(...(icons || []).map((ic, i) => {
      const img = document.createElement('img');
      img.src = ic.src;
      img.alt = ic.alt;
      img.title = ic.alt;
      if (ic.rune) img.className = 'rune';
      img.style.animationDelay = `${delay + i * 0.1}s`;
      return img;
    }));
  }

  function hideReveal() {
    clearTimeout(revealTimer);
    const reveal = $('reveal');
    if (reveal.hidden) return;
    reveal.classList.remove('show');
    reveal.hidden = true;
  }

  // ---------- Tárgy-tooltip ----------
  // Ha az egér egy tárgy fölé kerül (data-item-id), megmutatja, mit ad és milyen képességei vannak.
  // A Riot leírása saját címkéket használ (<stats>, <passive>, <magicDamage>…). A HTML-t nem
  // illeszti be közvetlenül: minden címkéből egy attribútumok nélküli span lesz tt-<címke>
  // osztállyal (a színezéshez), a <br> sortörés marad, minden más szövegként kerül be.
  // Néhány értéket a játék futás közben számol ki (pl. a manából adott sebzést); ezek a Riot
  // adataiban 0-ként (angolul üresen) szerepelnek. A félrevezető nullák kimaradnak; a szám
  // gyakran külön címkében áll (pl. <healing>0</healing> életerő), ezért a címkéken át is keres.
  const fixZeros = html => html
    .replace(/\s?\((?:<[^>]+>)*0(?:\s?mp|s)?(?:<[^>]+>)*\)/g, '')
    .replace(/(^|[\s>(])0\s(?=(?:<[^>]+>)*másodperc)/g, '$1néhány ')
    .replace(/(^|[\s>(])0(?:%(?:-kal|-os)?)?\s?(?=(?:\s|<[^>]+>)*\p{L})/gu, '$1');

  function itemDescEl(html) {
    const doc = new DOMParser().parseFromString(`<div>${fixZeros(html)}</div>`, 'text/html');
    const convert = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return document.createElement('br');
      const span = document.createElement('span');
      span.className = `tt-${tag.replace(/[^a-z]/g, '')}`;
      node.childNodes.forEach(ch => {
        const out = convert(ch);
        if (out) span.appendChild(out);
      });
      return span;
    };
    const root = document.createElement('div');
    doc.body.firstChild.childNodes.forEach(ch => {
      const out = convert(ch);
      if (out) root.appendChild(out);
    });
    // A leírás eleji és végi üres sorok (pl. a jungle peteknél üres a statlista) kimaradnak.
    const isBlank = n => n.nodeName === 'BR' || !n.textContent.trim();
    const trim = el => {
      while (el.firstChild && isBlank(el.firstChild)) el.firstChild.remove();
      while (el.lastChild && isBlank(el.lastChild)) el.lastChild.remove();
      if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.ELEMENT_NODE) trim(el.firstChild);
    };
    trim(root);
    return root;
  }

  let tipTarget = null;

  function showItemTip(target) {
    const it = getItem(target.dataset.itemId);
    if (!it) return;
    tipTarget = target;
    $('tipIcon').src = itemIconUrl(it.id);
    $('tipName').textContent = it.name;
    $('tipGold').textContent = it.gold ? t('tip.gold', it.gold) : '';
    $('tipBody').replaceChildren(itemDescEl(it.desc));
    const hint = target.dataset.itemHint || '';
    $('tipHint').textContent = hint;
    $('tipHint').hidden = !hint;
    const tip = $('itemTip');
    tip.hidden = false;
    target.setAttribute('aria-describedby', 'itemTip');
    placeItemTip(target);
  }

  function hideItemTip() {
    if (tipTarget) tipTarget.removeAttribute('aria-describedby');
    tipTarget = null;
    $('itemTip').hidden = true;
  }

  // Az elem mellé (jobbra, ha nem fér, balra; ha egyik sem, alá vagy fölé) teszi, a képernyőn belül.
  function placeItemTip(target) {
    const tip = $('itemTip');
    const r = target.getBoundingClientRect();
    const m = 10;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let x = r.right + m;
    let y = r.top;
    if (x + w > vw - m) x = r.left - m - w;
    if (x < m) {
      x = Math.min(Math.max(m, r.left), vw - w - m);
      y = r.bottom + m;
      if (y + h > vh - m) y = r.top - m - h;
    }
    y = Math.min(Math.max(m, y), vh - h - m);
    tip.style.left = `${Math.max(m, x)}px`;
    tip.style.top = `${y}px`;
  }

  // Újrarajzolás után a tooltip már egy eltűnt elemhez tartozhat.
  function dropStaleTip() {
    if (tipTarget && !tipTarget.isConnected) hideItemTip();
  }

  function onItemHover(e) {
    const target = e.target.closest ? e.target.closest('[data-item-id]') : null;
    if (target === tipTarget) return;
    if (target) showItemTip(target);
    else if (tipTarget) hideItemTip();
  }

  // ---------- Előzmények ----------
  // Egy bejegyzés: { id, c: champion id, l: lane id, b: build id vagy null, full: elmentett build vagy null }
  // Minden kisorsolt build külön bejegyzés, és a teljes build el van mentve, hogy pontosan
  // ugyanúgy vissza lehessen hívni.
  const newEntryId = () => `${Date.now().toString(36)}-${randomInt(1e6).toString(36)}`;

  function readList(key) {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) return [];
      // A legelső verzió csak champion id-ket tárolt, a korábbiak azonosító nélküliek.
      return arr
        .map(e => (typeof e === 'string' ? { c: e, b: null } : e))
        .filter(e => e && e.c)
        .map(e => ({ full: null, ...e, id: e.id || newEntryId() }));
    } catch {
      return [];
    }
  }

  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch { /* nem elérhető */ }
  }

  let history = readList(HISTORY_KEY).slice(0, HISTORY_MAX);
  let currentEntryId = null; // a most megjelenített bejegyzés

  function addChampionEntry(champId, laneId) {
    const entry = { id: newEntryId(), c: champId, l: laneId, b: null, full: null };
    history = [entry, ...history].slice(0, HISTORY_MAX);
    currentEntryId = entry.id;
    writeHistory(history);
    renderLists();
  }

  function addBuildEntry(champId, laneId, full) {
    const current = history.find(e => e.id === currentEntryId);
    if (current && current.c === champId && !current.b) {
      // A champion bejegyzése még build nélküli: ez lesz az első buildje.
      current.b = full.build.id;
      current.full = serializeBuild(full);
    } else {
      // Újrapörgetett build: külön bejegyzés ugyanahhoz a championhoz.
      const entry = { id: newEntryId(), c: champId, l: laneId, b: full.build.id, full: serializeBuild(full) };
      history = [entry, ...history].slice(0, HISTORY_MAX);
      currentEntryId = entry.id;
    }
    writeHistory(history);
    renderLists();
  }

  function serializeBuild(full) {
    return {
      items: full.items.map(it => ({ id: it.id, note: it.note ? noteKey(it.note) : null })),
      starter: full.starter ? full.starter.id : null,
      spells: full.spells.map(s => s.id),
      runes: full.runes && {
        p: full.runes.primary.key,
        k: full.runes.keystone.key,
        pr: full.runes.primaryRunes.map(r => r.key),
        s: full.runes.secondary.key,
        sr: full.runes.secondaryRunes.map(r => r.key),
      },
      shards: full.shards.map(s => s.id),
    };
  }

  // Az elmentett buildből újra felépíti a megjelenítéshez szükséges adatokat.
  function restoreBuild(entry) {
    const build = BUILD_BY_ID.get(entry.b);
    const entryLane = LANE_BY_ID.get(entry.l);
    const saved = entry.full;
    if (!build || !entryLane || !saved) return null;
    const withNote = (id, note) => {
      const it = getItem(id);
      return it && (note ? { ...it, note } : it);
    };
    const tree = key => runeTrees.find(t => t.key === key);
    const rune = (t, key) => t && t.slots.flat().find(r => r.key === key);
    let runes = null;
    if (saved.runes) {
      const primary = tree(saved.runes.p);
      const secondary = tree(saved.runes.s);
      const keystone = rune(primary, saved.runes.k);
      const primaryRunes = saved.runes.pr.map(k => rune(primary, k));
      const secondaryRunes = saved.runes.sr.map(k => rune(secondary, k));
      if (keystone && [...primaryRunes, ...secondaryRunes].every(Boolean)) {
        runes = { primary, keystone, primaryRunes, secondary, secondaryRunes };
      }
    }
    return {
      build,
      lane: entryLane,
      spells: saved.spells.map(id => spellData.get(id)).filter(Boolean),
      runes,
      shards: statShards(saved.shards),
      starter: saved.starter ? withNote(saved.starter, 'starter') : null,
      items: saved.items.map(x => withNote(x.id, x.note && noteKey(x.note))).filter(Boolean),
    };
  }

  // silent: hang nélkül (nyelvváltás utáni visszaállításnál).
  function recallEntry(id, silent = false) {
    if (champWheel.spinning || buildWheel.spinning) return;
    const entry = history.find(e => e.id === id) || favorites.find(e => e.id === id);
    const champ = entry && champions.find(c => c.id === entry.c);
    if (!champ) return;
    // A régi bejegyzésekben nincs lane: ilyenkor a mostani (vagy a Mid) lesz.
    if (!LANE_BY_ID.has(entry.l)) entry.l = lane || 'mid';
    setLane(entry.l);
    // Visszahíváskor is megszólal a champion hangja, mint a sorsolásnál.
    preloadSounds(champ);
    if (!silent) playSounds();
    enterBuildStage(champ);
    currentEntryId = entry.id;

    const build = BUILD_BY_ID.get(entry.b);
    if (build) {
      let full = restoreBuild(entry);
      if (!full) {
        // Régi bejegyzés, amihez még nem volt elmentve a teljes build.
        full = makeFullBuild(champ, build, entry.l);
        entry.full = serializeBuild(full);
      }
      showBuildCard(full);
      buildWheel.pointAt(buildWheel.items.indexOf(build));
      $('buildTicker').textContent = build.name;
    }
    writeHistory(history);
    writeFavorites();
    renderLists();
  }

  // ---------- Kedvencek ----------
  // Ugyanolyan bejegyzések, mint az előzményekben, ugyanazzal az azonosítóval,
  // így látszik, hogy egy előzmény már kedvenc-e.
  let favorites = readList(FAV_KEY);
  let activeTab = 'history';

  function writeFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch { /* nem elérhető */ }
  }

  const isFavorite = id => favorites.some(f => f.id === id);

  function toggleFavorite(id) {
    if (isFavorite(id)) {
      favorites = favorites.filter(f => f.id !== id);
    } else {
      const entry = history.find(e => e.id === id);
      if (!entry || !entry.b || !entry.full) return;
      favorites = [JSON.parse(JSON.stringify(entry)), ...favorites].slice(0, FAV_MAX);
    }
    writeFavorites();
    renderLists();
  }

  function setTab(tab) {
    activeTab = tab;
    $('historyTab').setAttribute('aria-selected', String(tab === 'history'));
    $('favTab').setAttribute('aria-selected', String(tab === 'fav'));
    $('ideaTab').setAttribute('aria-selected', String(tab === 'idea'));
    $('historyPanel').hidden = tab !== 'history';
    $('favPanel').hidden = tab !== 'fav';
    $('ideaPanel').hidden = tab !== 'idea';
    renderLists();
  }

  function renderLists() {
    const byId = new Map(champions.map(c => [c.id, c]));
    const hist = history.filter(e => byId.has(e.c));
    const favs = favorites.filter(e => byId.has(e.c));
    $('historyList').replaceChildren(...hist.map(e => entryCardEl(e, byId.get(e.c), true)));
    $('favList').replaceChildren(...favs.map(e => entryCardEl(e, byId.get(e.c), false)));
    $('historyEmpty').hidden = hist.length > 0;
    $('favEmpty').hidden = favs.length > 0;
    $('historyTab').textContent = t('tab.history', hist.length);
    $('favTab').textContent = t('tab.fav', favs.length);
    $('clearHistory').hidden = activeTab !== 'history' || hist.length === 0;

    // A build kártyán lévő csillag az éppen látható buildre vonatkozik.
    const current = history.find(e => e.id === currentEntryId) || favorites.find(e => e.id === currentEntryId);
    const favBtn = $('favBtn');
    favBtn.hidden = !current || !current.full;
    const fav = current && isFavorite(current.id);
    favBtn.setAttribute('aria-pressed', String(!!fav));
    favBtn.querySelector('.star').textContent = fav ? '★' : '☆';
    favBtn.querySelector('.fav-label').textContent = fav ? t('fav.is') : t('fav.add');
    dropStaleTip();
  }

  // Egy bejegyzés törlése az előzményekből (a kedvencekben lévő másolata megmarad).
  function deleteHistoryEntry(id) {
    history = history.filter(e => e.id !== id);
    writeHistory(history);
    renderLists();
  }

  function entryCardEl(e, c, inHistory) {
    const li = document.createElement('li');
    li.className = 'entry-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-entry';
    if (e.id === currentEntryId) btn.setAttribute('aria-current', 'true');
    const build = BUILD_BY_ID.get(e.b);
    btn.title = t('entry.recall');

    const head = document.createElement('div');
    head.className = 'history-head-row';
    const img = document.createElement('img');
    img.src = iconUrl(c.id);
    img.alt = '';
    img.loading = 'lazy';
    const text = document.createElement('div');
    text.appendChild(textEl('span', c.name));
    const l = LANE_BY_ID.get(e.l);
    const details = [l && l.label, build ? build.name : t('entry.noBuild')].filter(Boolean);
    text.appendChild(textEl('small', details.join(' · ')));
    head.append(img, text);
    btn.appendChild(head);

    if (e.full) {
      const icons = document.createElement('div');
      icons.className = 'history-items';
      const ids = [...(e.full.starter ? [e.full.starter] : []), ...e.full.items.filter(x => x.note).map(x => x.id),
        ...e.full.items.filter(x => !x.note).map(x => x.id)];
      for (const id of ids) {
        const it = getItem(id);
        if (!it) continue;
        const ic = document.createElement('img');
        ic.src = itemIconUrl(id);
        ic.alt = '';
        ic.dataset.itemId = id;
        ic.loading = 'lazy';
        icons.appendChild(ic);
      }
      btn.appendChild(icons);
    }

    btn.addEventListener('click', () => recallEntry(e.id));
    li.appendChild(btn);

    // Csillag: kedvencekhez adás / eltávolítás (csak kész buildnél).
    if (e.b && e.full) {
      const fav = isFavorite(e.id);
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'entry-star';
      star.textContent = fav ? '★' : '☆';
      star.setAttribute('aria-pressed', String(fav));
      star.title = fav ? t('entry.favRemove') : t('entry.favAdd');
      star.setAttribute('aria-label', star.title);
      star.addEventListener('click', () => toggleFavorite(e.id));
      li.appendChild(star);
    }

    if (inHistory) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'entry-delete';
      del.title = t('entry.delete');
      del.setAttribute('aria-label', t('entry.deleteAria', `${c.name}${build ? ` (${build.name})` : ''}`));
      del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      del.addEventListener('click', () => deleteHistoryEntry(e.id));
      li.appendChild(del);
    }
    return li;
  }

  // ---------- Ötletek ----------
  // A javaslatok mindig elmentődnek a böngészőben is; ha van IDEA_ENDPOINT, oda is elküldi őket.
  let ideas = (() => {
    try {
      const arr = JSON.parse(localStorage.getItem(IDEA_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  })();

  function writeIdeas() {
    try { localStorage.setItem(IDEA_KEY, JSON.stringify(ideas)); } catch { /* nem elérhető */ }
  }

  function renderIdeas() {
    $('ideaSaved').hidden = ideas.length === 0;
    $('ideaSaved').querySelector('h4').textContent = IDEA_ENDPOINT ? t('idea.sentList') : t('idea.localList');
    // A kategória magyarul van elmentve (ez az űrlap értéke); a felirat a választott nyelven.
    const catLabel = cat => {
      const opt = [...$('ideaCategory').options].find(o => o.value === cat);
      return opt ? opt.textContent : cat;
    };
    $('ideaList').replaceChildren(...ideas.map(idea => {
      const li = document.createElement('li');
      const meta = `${catLabel(idea.category)} · ${new Date(idea.date).toLocaleDateString(DATE_LOCALE)}${idea.name ? ` · ${idea.name}` : ''}`;
      li.append(textEl('small', meta), textEl('p', idea.text));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'link-btn';
      del.textContent = t('idea.delete');
      del.addEventListener('click', () => {
        ideas = ideas.filter(x => x.id !== idea.id);
        writeIdeas();
        renderIdeas();
      });
      li.appendChild(del);
      return li;
    }));
  }

  function setIdeaStatus(text, kind) {
    const el = $('ideaStatus');
    el.textContent = text;
    el.className = `idea-status${kind ? ` is-${kind}` : ''}`;
  }

  async function submitIdea(event) {
    event.preventDefault();
    const form = $('ideaForm');
    const text = $('ideaText').value.trim();
    if (text.length < 5) {
      setIdeaStatus(t('idea.tooShort'), 'error');
      $('ideaText').focus();
      return;
    }
    // Ha a rejtett mező ki van töltve, valószínűleg bot küldte: csendben eldobjuk.
    if (form.elements._gotcha.value) return;

    const idea = {
      id: newEntryId(),
      category: $('ideaCategory').value,
      text,
      name: $('ideaName').value.trim(),
      date: new Date().toISOString(),
    };

    if (IDEA_ENDPOINT) {
      $('ideaSubmit').disabled = true;
      setIdeaStatus(t('idea.sending'));
      try {
        const res = await fetch(IDEA_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ kategoria: idea.category, javaslat: idea.text, nev: idea.name || '-', nyelv: LANG }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        console.warn(err);
        setIdeaStatus(t('idea.failed'), 'error');
        $('ideaSubmit').disabled = false;
        return;
      }
      $('ideaSubmit').disabled = false;
    }

    ideas = [idea, ...ideas].slice(0, 50);
    writeIdeas();
    renderIdeas();
    form.reset();
    updateIdeaCounter();
    setIdeaStatus(IDEA_ENDPOINT ? t('idea.thanks') : t('idea.saved'), 'ok');
  }

  function updateIdeaCounter() {
    $('ideaCounter').textContent = `${$('ideaText').value.length} / 1000`;
  }

  // ---------- Build-javasló ----------
  // A felhasználó ikononként összerakja a saját buildjét (tárgyak, rúnák, varázslatok),
  // és ugyanoda küldi, ahová az ötletek is mennek (IDEA_ENDPOINT).
  const ITEM_FILTERS = ['all', 'boots', 'ad', 'ap', 'def', 'special']
    .map(id => ({ id, label: t(`filter.${id}`) }));
  // Ezekből a fajtákból (boots, support, jungle, starter) egy buildben csak egy lehet.
  const kindLabel = kind => t(`kind.${kind}`);

  const editor = {
    champ: null, lane: null, items: [],
    primary: null, keystone: null, primaryRunes: [null, null, null],
    secondary: null, secondaryRunes: [null, null, null], secondaryOrder: [],
    shards: [null, null, null], spells: [],
    filter: 'all', search: '',
  };
  let editorReturnFocus = null;

  const findRune = (tree, key) => tree && tree.slots.flat().find(r => r.key === key);
  const maxItemsFor = laneId => (laneId === 'bot' ? 7 : 6);

  function openEditor(prefill) {
    if (!champions.length) return;
    fillChampSelect();
    if (prefill) {
      if (prefill.champ) editor.champ = prefill.champ;
      if (prefill.lane) editor.lane = prefill.lane;
    }
    if (!editor.lane && lane) editor.lane = lane;
    setStatus('edStatus', '');
    renderEditor();
    editorReturnFocus = document.activeElement;
    $('buildEditor').hidden = false;
    document.body.classList.add('no-scroll');
    $('editorClose').focus();
  }

  function closeEditor() {
    if ($('buildEditor').hidden) return;
    $('buildEditor').hidden = true;
    document.body.classList.remove('no-scroll');
    if (editorReturnFocus) editorReturnFocus.focus();
  }

  function resetEditor() {
    Object.assign(editor, {
      champ: null, items: [],
      primary: null, keystone: null, primaryRunes: [null, null, null],
      secondary: null, secondaryRunes: [null, null, null], secondaryOrder: [],
      shards: [null, null, null], spells: [],
    });
    ['edTitle', 'edNote', 'edItemSearch'].forEach(id => { $(id).value = ''; });
    editor.search = '';
    setStatus('edStatus', '');
    renderEditor();
  }

  function fillChampSelect() {
    const sel = $('edChamp');
    if (sel.options.length > 1) return;
    sel.replaceChildren(new Option(t('ed.pickChamp'), ''), ...champions.map(c => new Option(c.name, c.id)));
  }

  function renderEditor() {
    // Champion és lane
    $('edChamp').value = editor.champ ? editor.champ.id : '';
    $('edChampIcon').hidden = !editor.champ;
    if (editor.champ) $('edChampIcon').src = iconUrl(editor.champ.id);
    $('edLanes').replaceChildren(...LANES.map(l => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-lane';
      b.setAttribute('aria-pressed', String(editor.lane === l.id));
      const img = document.createElement('img');
      img.src = laneIconUrl(l);
      img.alt = '';
      b.append(img, textEl('span', l.label));
      b.addEventListener('click', () => setEditorLane(l.id));
      return b;
    }));
    renderEditorItems();
    renderEditorRunes();
    renderEditorSpells();
  }

  function setEditorLane(laneId) {
    editor.lane = laneId;
    const max = maxItemsFor(laneId);
    if (editor.items.length > max) {
      editor.items = editor.items.slice(0, max);
      setStatus('edItemMsg', t('ed.laneLimit', LANE_BY_ID.get(laneId).label, max), 'error');
    }
    renderEditor();
  }

  // Miért nem lehet hozzáadni egy tárgyat? (null = hozzáadható)
  function itemBlockReason(it) {
    if (editor.items.some(x => x.id === it.id)) return t('ed.already');
    const max = maxItemsFor(editor.lane);
    if (editor.items.length >= max) return t('ed.max', max);
    if (it.kind && editor.items.some(x => x.kind === it.kind)) return t('ed.onlyOne', kindLabel(it.kind));
    const groups = itemGroups.get(it.id) || [];
    const clash = editor.items.find(x => (itemGroups.get(x.id) || []).some(g => groups.includes(g)));
    if (clash) return t('ed.clash', clash.name);
    return null;
  }

  function renderEditorItems() {
    const max = maxItemsFor(editor.lane);
    $('edItemCount').textContent = `(${editor.items.length} / ${max})`;

    $('edSlots').replaceChildren(...Array.from({ length: max }, (_, i) => {
      const li = document.createElement('li');
      const it = editor.items[i];
      if (!it) {
        li.className = 'ed-slot empty';
        li.textContent = String(i + 1);
        return li;
      }
      li.className = 'ed-slot';
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.itemId = it.id;
      b.dataset.itemHint = t('ed.slotHint');
      b.setAttribute('aria-label', t('ed.slotRemove', i + 1, it.name));
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = '';
      b.appendChild(img);
      b.addEventListener('click', () => {
        editor.items = editor.items.filter(x => x.id !== it.id);
        setStatus('edItemMsg', '');
        renderEditorItems();
      });
      li.appendChild(b);
      return li;
    }));

    $('edItemFilters').replaceChildren(...ITEM_FILTERS.map(f => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-filter';
      b.textContent = f.label;
      b.setAttribute('aria-pressed', String(editor.filter === f.id));
      b.addEventListener('click', () => {
        editor.filter = f.id;
        renderEditorItems();
      });
      return b;
    }));

    const q = normalize(editor.search);
    const shown = editorItems.filter(it => it.cats.has(editor.filter) && (!q || normalize(it.name).includes(q)));
    $('edItemGrid').replaceChildren(...shown.map(it => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-item';
      const chosen = editor.items.some(x => x.id === it.id);
      const reason = chosen ? null : itemBlockReason(it);
      if (chosen) b.classList.add('is-chosen');
      else if (reason) b.classList.add('is-blocked');
      // A tooltip alján: miért nem vehető fel, vagy hogy kattintással kivehető.
      b.dataset.itemId = it.id;
      b.dataset.itemHint = chosen ? t('ed.slotHint') : reason || '';
      b.setAttribute('aria-label', reason && !chosen ? `${it.name} – ${reason}` : it.name);
      b.setAttribute('aria-pressed', String(chosen));
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = '';
      img.loading = 'lazy';
      b.appendChild(img);
      b.addEventListener('click', () => toggleEditorItem(it));
      return b;
    }));
    if (!shown.length) $('edItemGrid').replaceChildren(textEl('p', t('ed.noItem'), 'editor-hint'));
    dropStaleTip();
  }

  function toggleEditorItem(it) {
    if (editor.items.some(x => x.id === it.id)) {
      editor.items = editor.items.filter(x => x.id !== it.id);
      setStatus('edItemMsg', '');
    } else {
      const reason = itemBlockReason(it);
      if (reason) {
        setStatus('edItemMsg', `${it.name}: ${reason}`, 'error');
        return;
      }
      editor.items.push(it);
      setStatus('edItemMsg', '');
    }
    renderEditorItems();
  }

  function runeButton(rune, selected, onClick, big) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ed-rune${big ? ' keystone' : ''}`;
    b.title = rune.name;
    b.setAttribute('aria-label', rune.name);
    b.setAttribute('aria-pressed', String(selected));
    const img = document.createElement('img');
    img.src = rune.icon.startsWith('http') ? rune.icon : runeIconUrl(rune.icon);
    img.alt = '';
    b.appendChild(img);
    b.addEventListener('click', onClick);
    return b;
  }

  function treeButtons(selectedKey, exclude, onPick) {
    return runeTrees.filter(t => t.key !== exclude).map(t => {
      const b = runeButton(t, t.key === selectedKey, () => onPick(t.key));
      b.classList.add('tree');
      return b;
    });
  }

  function runeRow(runes, selectedKey, onPick, big) {
    const row = document.createElement('div');
    row.className = 'ed-rune-row';
    row.append(...runes.map(r => runeButton(r, r.key === selectedKey, () => onPick(r.key), big)));
    return row;
  }

  function renderEditorRunes() {
    const primary = runeTrees.find(t => t.key === editor.primary);
    const secondary = runeTrees.find(t => t.key === editor.secondary);

    $('edPrimaryTrees').replaceChildren(...treeButtons(editor.primary, null, key => {
      if (key === editor.primary) return;
      Object.assign(editor, { primary: key, keystone: null, primaryRunes: [null, null, null] });
      // A másodlagos ág nem lehet ugyanaz, mint a fő ág.
      if (editor.secondary === key) Object.assign(editor, { secondary: null, secondaryRunes: [null, null, null], secondaryOrder: [] });
      renderEditorRunes();
    }));
    $('edPrimaryRows').replaceChildren(...(primary ? [
      runeRow(primary.slots[0], editor.keystone, key => { editor.keystone = key; renderEditorRunes(); }, true),
      ...primary.slots.slice(1).map((slot, i) => runeRow(slot, editor.primaryRunes[i], key => {
        editor.primaryRunes[i] = key;
        renderEditorRunes();
      })),
    ] : [textEl('p', t('ed.pickPrimary'), 'editor-hint')]));

    $('edSecondaryTrees').replaceChildren(...treeButtons(editor.secondary, editor.primary, key => {
      if (key === editor.secondary) return;
      Object.assign(editor, { secondary: key, secondaryRunes: [null, null, null], secondaryOrder: [] });
      renderEditorRunes();
    }));
    $('edSecondaryRows').replaceChildren(...(secondary ? secondary.slots.slice(1).map((slot, i) => runeRow(slot, editor.secondaryRunes[i], key => {
      // Két sorból választható egy-egy rúna; egy harmadik sor a legrégebbi választást váltja.
      editor.secondaryRunes[i] = key;
      editor.secondaryOrder = [...editor.secondaryOrder.filter(r => r !== i), i];
      if (editor.secondaryOrder.length > 2) {
        const drop = editor.secondaryOrder.shift();
        editor.secondaryRunes[drop] = null;
      }
      renderEditorRunes();
    })) : [textEl('p', t('ed.pickSecondary'), 'editor-hint')]));

    $('edShardRows').replaceChildren(...shardSlots.map((slot, i) => {
      const row = runeRow(slot.shards.map(s => ({ key: String(s.id), name: `${s.name} (${s.desc})`, icon: s.icon })),
        editor.shards[i] ? String(editor.shards[i]) : null,
        key => { editor.shards[i] = Number(key); renderEditorRunes(); });
      row.classList.add('shard');
      return row;
    }));

    const keystone = findRune(primary, editor.keystone);
    $('edRuneName').textContent = keystone ? t('ed.keystone', keystone.name) : '';
  }

  function renderEditorSpells() {
    $('edSpellCount').textContent = `(${editor.spells.length} / 2)`;
    $('edSpells').replaceChildren(...[...spellData.values()].map(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-spell';
      b.title = s.name;
      b.setAttribute('aria-pressed', String(editor.spells.includes(s.id)));
      const img = document.createElement('img');
      img.src = spellIconUrl(s.id);
      img.alt = '';
      b.append(img, textEl('span', s.name));
      b.addEventListener('click', () => {
        if (editor.spells.includes(s.id)) editor.spells = editor.spells.filter(x => x !== s.id);
        // Kettőnél több nem lehet: a harmadik a legrégebbit váltja.
        else editor.spells = [...editor.spells, s.id].slice(-2);
        renderEditorSpells();
      });
      return b;
    }));
  }

  // Olvasható összefoglaló a beküldéshez.
  function editorSummary() {
    const primary = runeTrees.find(t => t.key === editor.primary);
    const secondary = runeTrees.find(t => t.key === editor.secondary);
    const names = (tree, keys) => keys.map(k => findRune(tree, k)).filter(Boolean).map(r => r.name);
    const runeParts = [];
    if (primary) runeParts.push(`${primary.name}: ${names(primary, [editor.keystone, ...editor.primaryRunes]).join(', ') || '-'}`);
    if (secondary) runeParts.push(`${secondary.name}: ${names(secondary, editor.secondaryRunes).join(', ') || '-'}`);
    const shards = editor.shards.map((id, i) => {
      const s = shardSlots[i] && shardSlots[i].shards.find(x => x.id === id);
      return s ? s.name : null;
    }).filter(Boolean);
    return {
      targyak: editor.items.map((it, i) => `${i + 1}. ${it.name}`).join('\n'),
      runak: runeParts.join('\n') || '-',
      alap_ertekek: shards.join(', ') || '-',
      idezoi_varazslatok: editor.spells.map(id => (spellData.get(id) || {}).name).filter(Boolean).join(', ') || '-',
    };
  }

  async function submitBuildSuggestion() {
    if (!editor.champ) return setStatus('edStatus', t('ed.needChamp'), 'error');
    if (!editor.lane) return setStatus('edStatus', t('ed.needLane'), 'error');
    if (editor.items.length < 3) return setStatus('edStatus', t('ed.needItems'), 'error');
    // A játékban support nélkül nincs support tárgy, jungle-ben pedig nincs Sújtás-tárgy (pet) nélkül.
    if (editor.lane === 'support' && !editor.items.some(it => it.kind === 'support')) {
      return setStatus('edStatus', t('ed.needSupport'), 'error');
    }
    if (editor.lane === 'jungle' && !editor.items.some(it => it.kind === 'jungle')) {
      return setStatus('edStatus', t('ed.needJungle'), 'error');
    }
    if (!IDEA_ENDPOINT) return setStatus('edStatus', t('ed.disabled'), 'error');

    const l = LANE_BY_ID.get(editor.lane);
    $('edSubmit').disabled = true;
    setStatus('edStatus', t('idea.sending'));
    try {
      const res = await fetch(IDEA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          kategoria: 'Build javaslat',
          champion: `${editor.champ.name} (${l.label})`,
          build_neve: $('edTitle').value.trim() || '-',
          ...editorSummary(),
          megjegyzes: $('edNote').value.trim() || '-',
          nev: $('edName').value.trim() || '-',
          nyelv: LANG,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('edStatus', t('ed.thanks'), 'ok');
    } catch (err) {
      console.warn(err);
      setStatus('edStatus', t('idea.failed'), 'error');
    } finally {
      $('edSubmit').disabled = false;
    }
  }

  function setStatus(id, text, kind) {
    const el = $(id);
    el.textContent = text;
    el.className = `${id === 'edItemMsg' ? 'editor-msg' : 'idea-status'}${kind ? ` is-${kind}` : ''}`;
  }

  // ---------- Nyelvváltás ----------
  // A HTML-ben megjelölt szövegek lefordítása. Ha az elemben más elem is van
  // (pl. egy "(nem kötelező)" span), csak az első szövegrészét cseréli.
  function applyStaticText() {
    document.documentElement.lang = LANG;
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]').content = t('meta.desc');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const text = t(el.dataset.i18n);
      const node = el.children.length
        ? [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        : null;
      if (node) node.textContent = `${text} `;
      else el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  }

  // Az új nyelvhez az adatokat (championok, tárgyak, rúnák) is újra kell tölteni,
  // ezért az oldal újratöltődik; az épp látott build és a fül megmarad.
  function setLanguage(newLang) {
    if (newLang === LANG || champWheel.spinning || buildWheel.spinning) return;
    try {
      localStorage.setItem(LANG_KEY, newLang);
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({ entry: currentChamp ? currentEntryId : null, tab: activeTab }));
    } catch { /* nem elérhető */ }
    document.body.classList.add('lang-switching');
    location.reload();
  }

  function resumeAfterLanguageSwitch() {
    let state = null;
    try {
      state = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null');
      sessionStorage.removeItem(RESUME_KEY);
    } catch { /* nem elérhető */ }
    if (!state) return;
    if (['history', 'fav', 'idea'].includes(state.tab)) setTab(state.tab);
    if (state.entry) recallEntry(state.entry, true);
  }

  // ---------- Indítás ----------
  applyStaticText();
  document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
  spinBtn.addEventListener('click', spinChampion);
  buildSpinBtn.addEventListener('click', spinBuild);
  $('newChampBtn').addEventListener('click', leaveBuildStage);
  $('retryBtn').addEventListener('click', loadData);
  $('historyTab').addEventListener('click', () => setTab('history'));
  $('favTab').addEventListener('click', () => setTab('fav'));
  $('ideaTab').addEventListener('click', () => setTab('idea'));
  $('champSearch').addEventListener('input', updateSuggestions);
  $('champSearch').addEventListener('focus', updateSuggestions);
  $('champSearch').addEventListener('keydown', onSearchKey);
  $('champSearch').addEventListener('blur', hideSuggestions);
  $('ideaForm').addEventListener('submit', submitIdea);
  $('ideaText').addEventListener('input', updateIdeaCounter);
  $('favBtn').addEventListener('click', () => { if (currentEntryId) toggleFavorite(currentEntryId); });
  $('clearHistory').addEventListener('click', () => {
    history = [];
    writeHistory(history);
    renderLists();
  });
  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch { /* nem elérhető */ }
    if (!soundOn) stopSounds();
    if (soundOn && volume === 0) setVolume(50);
    updateSoundBtn();
  });
  $('volumeSlider').addEventListener('input', e => setVolume(Number(e.target.value)));
  $('reveal').addEventListener('click', hideReveal);
  document.addEventListener('mouseover', onItemHover);
  document.addEventListener('focusin', onItemHover);
  document.addEventListener('focusout', e => {
    if (tipTarget && e.target.closest('[data-item-id]') === tipTarget) hideItemTip();
  });
  // Ha az egér elhagyja az ablakot, vagy görget, a tooltip eltűnik.
  document.addEventListener('mouseout', e => { if (!e.relatedTarget && tipTarget) hideItemTip(); });
  window.addEventListener('scroll', () => { if (tipTarget) hideItemTip(); }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    hideItemTip();
    hideReveal();
    closeEditor();
  });
  $('openEditor').addEventListener('click', () => openEditor());
  $('suggestForChamp').addEventListener('click', () => openEditor({ champ: currentChamp, lane }));
  $('editorClose').addEventListener('click', closeEditor);
  // A sötét háttérre kattintva is bezárul.
  $('buildEditor').addEventListener('click', e => { if (e.target === $('buildEditor')) closeEditor(); });
  $('edReset').addEventListener('click', resetEditor);
  $('edSubmit').addEventListener('click', submitBuildSuggestion);
  $('edChamp').addEventListener('change', e => {
    editor.champ = champions.find(c => c.id === e.target.value) || null;
    renderEditor();
  });
  $('edItemSearch').addEventListener('input', e => {
    editor.search = e.target.value;
    renderEditorItems();
  });
  window.addEventListener('resize', () => {
    champWheel.resize();
    buildWheel.resize();
    resizeFx();
  });

  renderLaneButtons();
  renderRoleButtons();
  renderIdeas();
  updateSoundBtn();
  updateSpinState();
  champWheel.resize();
  resizeFx();
  loadData();
})();
