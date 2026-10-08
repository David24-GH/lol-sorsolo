(() => {
  'use strict';

  const DDRAGON = 'https://ddragon.leagueoflegends.com';
  const LOCALE = 'hu_HU';
  const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/';
  const ROLE_ICON_BASE = `${CDRAGON}rcp-fe-lol-champion-details/global/default/`;
  const LANE_ICON_BASE = `${CDRAGON}rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/`;
  // A champion-választás hangjai (angol), a champion numerikus kulcsa alapján.
  const CDRAGON_AUDIO = `${CDRAGON}rcp-be-lol-game-data/global/default/v1/`;
  // A rúnaoldal alap értékei (shardok) magyarul; a Data Dragon ezeket nem tartalmazza.
  const CDRAGON_DATA_HU = `${CDRAGON}rcp-be-lol-game-data/global/hu_hu/v1/`;
  const CDRAGON_ASSETS = `${CDRAGON}rcp-be-lol-game-data/global/default/`;
  const HISTORY_KEY = 'lolSorsolo.history';
  const SOUND_KEY = 'lolSorsolo.sound';
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

  const ROLES = [
    { tag: 'Fighter', label: 'Harcos' },
    { tag: 'Tank', label: 'Tank' },
    { tag: 'Mage', label: 'Mágus' },
    { tag: 'Assassin', label: 'Orgyilkos' },
    { tag: 'Marksman', label: 'Lövész' },
    { tag: 'Support', label: 'Támogató' },
  ];
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
  const AP_EXTRA = new Set(['Gwen', 'Kaisa', 'KogMaw', 'Volibear', 'Shyvana', 'Udyr', 'Varus']);
  const AP_EXCLUDE = new Set(['Belveth', 'DrMundo', 'Jhin', 'KSante', 'Senna']);
  const AD_EXTRA = new Set(['Belveth', 'Nidalee']);
  const CRIT_EXTRA = new Set(['Nidalee']);
  const AD_EXCLUDE = new Set(['Azir', 'Diana', 'Elise', 'Gwen', 'Hwei', 'Kennen']);
  const AP_ONHIT_EXTRA = new Set(['Kayle', 'Teemo', 'Kaisa', 'Gwen', 'KogMaw', 'Varus', 'Katarina']);
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
      pool: [6655, 4645, 4646, 3118, 3100, 3089, 3165, 3157, 3137, 3135],
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
      ok: p => p.magic >= 5 && p.defense >= 5,
    },
    {
      id: 'lethality', name: 'Lethality', color: '#8f2a2a',
      desc: 'Páncéltörés és kitörő sebzés: vadászd le a puha célpontokat.',
      pool: [3142, 6697, 6698, 6696, 3814, 6676, 6694, 3156],
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
      ok: p => p.ad,
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
      pool: {
        ap: [3003, 6655, 4645, 3089, 3165, 3157, 3135],
        ad: [3004, 3071, 3161, 3142, 6676, 3036, 6694],
        tank: [3119, 3084, 3068, 3075, 4401, 3143, 2502],
      },
      boots: { ap: [3020], ad: [3158], tank: [3047] },
      keystones: { ap: ['ArcaneComet', 'PhaseRush'], ad: ['Conqueror', 'FleetFootwork'], tank: ['GraspOfTheUndying'] },
      shards: { ap: [5007, 5008, 5001], ad: [5007, 5008, 5001], tank: [5007, 5001, 5013] },
      ok: p => p.mana,
    },
    {
      id: 'ms', name: 'Mozgási sebesség', color: '#1f7a9e',
      desc: 'Senki nem ér utol: te leszel a leggyorsabb a pályán.',
      pool: {
        ad: [3142, 6631, 3078, 3046, 6610, 6672],
        ap: [3152, 4646, 4629, 2065, 6655, 3089],
        tank: [3742, 3068, 3050, 4401, 3084, 3143],
      },
      boots: [3009],
      keystones: ['PhaseRush', 'FleetFootwork', 'HailOfBlades'],
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
  const BUILD_BY_ID = new Map(BUILDS.map(b => [b.id, b]));

  // Ha a build saját tárgyai elfogynak (pl. kivettek egy tárgyat a játékból), ezekből pótol.
  const FALLBACK_POOL = {
    ad: [6672, 3153, 3031, 3071, 3046, 3072, 6673, 6333, 3036, 3026],
    ap: [6655, 4645, 4646, 3100, 3116, 3089, 3165, 3157, 3135],
    tank: [3084, 3068, 6665, 3075, 4401, 3143, 3083, 2502, 3110, 3065],
  };
  // Ezekből a csoportokból egyszerre csak egy tárgy lehet nálad.
  const ITEM_GROUPS = [
    [3053, 6673, 3156],       // Életmentő
    [3074, 3748, 6698],       // Hidrák
    [3036, 3033, 6694],       // Utolsó suttogás
    [3135, 3137],             // Pusztítás
    [3078, 3100, 6662, 3508], // Varázspenge
    [3003, 3004, 3119],       // Könnycsepp
  ];
  const GROUP_OF = new Map(ITEM_GROUPS.flatMap((g, i) => g.map(id => [id, i])));
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

  function chooseItems(pool, fallback, count, melee) {
    const order = [...pool.slice(0, 2), ...shuffle(pool.slice(2)), ...shuffle(fallback)];
    const out = [];
    const seen = new Set();
    const usedGroups = new Set();
    for (const id of order) {
      if (out.length >= count) break;
      if (seen.has(id)) continue;
      seen.add(id);
      const it = getItem(id);
      // Ha egy tárgy kikerült a játékból, egyszerűen kimarad.
      if (!it || (!melee && MELEE_ONLY.has(id))) continue;
      const g = GROUP_OF.get(id);
      if (g !== undefined) {
        if (usedGroups.has(g)) continue;
        usedGroups.add(g);
      }
      out.push(it);
    }
    // Vásárlási sorrend: előbb a build saját tárgyai a megadott sorrendben, utána a pótlások.
    const rank = id => {
      const i = pool.indexOf(id);
      return i >= 0 ? i : pool.length + fallback.indexOf(id);
    };
    return out.sort((a, b) => rank(a.id) - rank(b.id));
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
      if (sup) items.push({ ...sup, note: 'Support tárgy' });
    }
    let boots = getItem(pick(byKind(build.boots)));
    const upgraded = boots && laneId === 'mid' && getItem(bootUpgrade.get(boots.id));
    if (upgraded) {
      boots = { ...upgraded, note: 'Fejlesztett cipő' };
    } else if (boots) {
      boots = { ...boots, note: 'Cipő' };
    }
    const core = chooseItems(byKind(build.pool), FALLBACK_POOL[p.kind], lane.items, p.melee);
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
      starter: starter && { ...starter, note: 'Kezdő tárgy' },
      items,
    };
  }

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

      const frame = now => {
        const t = Math.min(1, (now - t0) / duration);
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
          this.rotation = mod(endRot, Math.PI * 2);
          this.spinning = false;
          const won = this.indexAtPointer();
          this.flash(won);
          onDone(this.items[won]);
        }
      };
      requestAnimationFrame(frame);
      return this.items[winner];
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
  let itemData = new Map();   // megvásárolható tárgyak: id -> { id, name }
  let bootUpgrade = new Map(); // cipő id -> fejlesztett cipő id
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
    $('champCount').textContent = 'Championok betöltése…';
    try {
      const versions = await fetchJson(`${DDRAGON}/api/versions.json`);
      version = versions[0];
      const data = path => `${DDRAGON}/cdn/${version}/data/${LOCALE}/${path}`;
      // A tárgyak, rúnák és varázslatok nélkül is működik a sorsolás, csak a build lesz hiányos.
      const optional = p => fetchJson(data(p)).catch(err => { console.warn(err); return null; });
      const cdragon = p => fetchJson(CDRAGON_DATA_HU + p).catch(err => { console.warn(err); return null; });
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
        .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
      loadItems(itemJson ? itemJson.data : {});
      runeTrees = (runeJson || []).map(t => ({
        key: t.key, name: t.name, icon: t.icon,
        slots: t.slots.map(s => s.runes.map(r => ({ key: r.key, name: r.name, icon: r.icon }))),
      }));
      spellData = new Map(Object.values(spellJson ? spellJson.data : {})
        .filter(s => s.modes.includes('CLASSIC'))
        .map(s => [s.id, { id: s.id, name: s.name }]));
      $('versionInfo').textContent = `Adatok: Riot Data Dragon, ${version} verzió · ${champions.length} champion`;
      applyFilter();
      renderLists();
    } catch (err) {
      console.error(err);
      $('champCount').textContent = '';
      showError('Nem sikerült betölteni a championok listáját. Ellenőrizd az internetkapcsolatot, majd próbáld újra.');
    }
  }

  function loadItems(raw) {
    const entries = Object.entries(raw).filter(([, it]) => it.gold && it.gold.purchasable && it.maps && it.maps['11']);
    itemData = new Map(entries.map(([id, it]) => [id, { id: Number(id), name: it.name }]));
    // Fejlesztett cipő: az a tárgy, ami egyetlen (2. szintű) cipőből épül.
    const boots = new Set(entries
      .filter(([, it]) => (it.tags || []).includes('Boots') && (it.from || []).includes('1001'))
      .map(([id]) => id));
    bootUpgrade = new Map(entries
      .filter(([, it]) => it.from && it.from.length === 1 && boots.has(it.from[0]))
      .map(([id, it]) => [Number(it.from[0]), Number(id)]));
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
    const banNote = banned ? ` · ${banned} kizárva, mert ${LANE_BY_ID.get(lane).label} lane-en nem játszható` : '';
    if (activeRoles.size === 0) {
      pool = playable;
      $('champCount').textContent = `${pool.length} champion a keréken${banNote}`;
    } else {
      pool = playable.filter(c => c.tags.some(t => activeRoles.has(t)));
      const labels = ROLES.filter(r => activeRoles.has(r.tag)).map(r => r.label).join(', ');
      $('champCount').textContent = `${pool.length} champion a keréken (${labels})${banNote}`;
    }
    champWheel.setItems(pool);
    updateSpinState();
  }

  function updateSpinState() {
    $('laneButtons').classList.toggle('has-selection', !!lane);
    spinBtn.disabled = champWheel.spinning || pool.length === 0 || !lane;
    if (!champWheel.spinning) {
      $('ticker').textContent = lane ? ' ' : 'Válaszd ki a lane-ed a pörgetéshez!';
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
      .sort((a, b) => (b.name.startsWith(q) - a.name.startsWith(q)) || a.c.name.localeCompare(b.c.name, 'hu'))
      .slice(0, SUGGEST_MAX)
      .map(x => x.c);
    suggestIdx = suggestions.length ? 0 : -1;

    if (!suggestions.length) {
      list.replaceChildren(textEl('li', 'Nincs ilyen champion.', 'suggest-empty'));
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
      $('searchHint').textContent = 'Előbb válaszd ki fent a lane-ed!';
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
  function spinChampion() {
    if (!lane) return;
    const winner = champWheel.spin(CHAMP_SPIN_MS, $('ticker'), champ => {
      spinBtn.disabled = false;
      setPickersDisabled(false);
      playSounds();
      burstFromWheel(champWheel.canvas);
      showReveal({
        label: `A te championod · ${LANE_BY_ID.get(lane).label}`,
        name: champ.name,
        title: champ.title,
        splash: splashUrl(champ.id),
      });
      enterBuildStage(champ);
      addChampionEntry(champ.id, lane);
    });
    if (!winner) return;
    spinBtn.disabled = true;
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
    $('buildCount').textContent = `${builds.length} játszható build ${champ.name} (${l.label}) számára`;
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
    const champ = currentChamp;
    const laneId = lane;
    const winner = buildWheel.spin(BUILD_SPIN_MS, $('buildTicker'), build => {
      buildSpinBtn.disabled = false;
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
    buildSpinBtn.disabled = true;
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
      runesEl.replaceChildren(textEl('p', 'A rúnák most nem érhetők el.', 'muted'));
    }

    const { special, core } = splitItems(full);
    const list = [...special, ...core];
    $('buildItems').replaceChildren(...list.map((it, i) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = '';
      const text = document.createElement('div');
      text.appendChild(textEl('span', it.name));
      if (it.note) text.appendChild(textEl('small', it.note));
      li.append(img, text);
      // A speciális tárgyak (kezdő pet, support tárgy, cipő) szaggatott vonallal elválasztva, felül.
      if (i === special.length - 1 && core.length) li.className = 'special-last';
      return li;
    }));
    if (!list.length) $('buildItems').replaceChildren(textEl('li', 'A tárgyak most nem érhetők el.', 'muted'));

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
    head.appendChild(textEl('span', 'Alap értékek'));
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
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* nem elérhető */ }

  function updateSoundBtn() {
    const btn = $('soundBtn');
    btn.setAttribute('aria-pressed', String(soundOn));
    btn.title = soundOn ? 'Hang kikapcsolása' : 'Hang bekapcsolása';
    btn.setAttribute('aria-label', btn.title);
    $('soundOnIcon').hidden = !soundOn;
    $('soundOffIcon').hidden = soundOn;
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
    sfx.volume = 0.45;
    voice.volume = 1;
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
      items: full.items.map(it => ({ id: it.id, note: it.note || null })),
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
      starter: saved.starter ? withNote(saved.starter, 'Kezdő tárgy') : null,
      items: saved.items.map(x => withNote(x.id, x.note)).filter(Boolean),
    };
  }

  function recallEntry(id) {
    if (champWheel.spinning || buildWheel.spinning) return;
    const entry = history.find(e => e.id === id) || favorites.find(e => e.id === id);
    const champ = entry && champions.find(c => c.id === entry.c);
    if (!champ) return;
    // A régi bejegyzésekben nincs lane: ilyenkor a mostani (vagy a Mid) lesz.
    if (!LANE_BY_ID.has(entry.l)) entry.l = lane || 'mid';
    setLane(entry.l);
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
    $('historyList').replaceChildren(...hist.map(e => entryCardEl(e, byId.get(e.c))));
    $('favList').replaceChildren(...favs.map(e => entryCardEl(e, byId.get(e.c))));
    $('historyEmpty').hidden = hist.length > 0;
    $('favEmpty').hidden = favs.length > 0;
    $('historyTab').textContent = `Előzmények (${hist.length})`;
    $('favTab').textContent = `Kedvencek (${favs.length})`;
    $('clearHistory').hidden = activeTab !== 'history' || hist.length === 0;

    // A build kártyán lévő csillag az éppen látható buildre vonatkozik.
    const current = history.find(e => e.id === currentEntryId) || favorites.find(e => e.id === currentEntryId);
    const favBtn = $('favBtn');
    favBtn.hidden = !current || !current.full;
    const fav = current && isFavorite(current.id);
    favBtn.setAttribute('aria-pressed', String(!!fav));
    favBtn.querySelector('.star').textContent = fav ? '★' : '☆';
    favBtn.querySelector('.fav-label').textContent = fav ? 'Kedvenc' : 'Kedvencekhez';
  }

  function entryCardEl(e, c) {
    const li = document.createElement('li');
    li.className = 'entry-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-entry';
    if (e.id === currentEntryId) btn.setAttribute('aria-current', 'true');
    const build = BUILD_BY_ID.get(e.b);
    btn.title = 'Kattints a visszahíváshoz';

    const head = document.createElement('div');
    head.className = 'history-head-row';
    const img = document.createElement('img');
    img.src = iconUrl(c.id);
    img.alt = '';
    img.loading = 'lazy';
    const text = document.createElement('div');
    text.appendChild(textEl('span', c.name));
    const l = LANE_BY_ID.get(e.l);
    const details = [l && l.label, build ? build.name : 'Nincs még build'].filter(Boolean);
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
        ic.title = it.name;
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
      star.title = fav ? 'Eltávolítás a kedvencek közül' : 'Mentés a kedvencek közé';
      star.setAttribute('aria-label', star.title);
      star.addEventListener('click', () => toggleFavorite(e.id));
      li.appendChild(star);
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
    $('ideaSaved').querySelector('h4').textContent = IDEA_ENDPOINT
      ? 'Általad elküldött ötletek'
      : 'Ebben a böngészőben mentett ötletek';
    $('ideaList').replaceChildren(...ideas.map(idea => {
      const li = document.createElement('li');
      const meta = `${idea.category} · ${new Date(idea.date).toLocaleDateString('hu-HU')}${idea.name ? ` · ${idea.name}` : ''}`;
      li.append(textEl('small', meta), textEl('p', idea.text));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'link-btn';
      del.textContent = 'Törlés';
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
    el.className = `idea-status${kind ? ` ${kind}` : ''}`;
  }

  async function submitIdea(event) {
    event.preventDefault();
    const form = $('ideaForm');
    const text = $('ideaText').value.trim();
    if (text.length < 5) {
      setIdeaStatus('Írj legalább pár szót a javaslatodról!', 'error');
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
      setIdeaStatus('Küldés…');
      try {
        const res = await fetch(IDEA_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ kategoria: idea.category, javaslat: idea.text, nev: idea.name || '-' }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        console.warn(err);
        setIdeaStatus('Nem sikerült elküldeni. Ellenőrizd az internetkapcsolatot, és próbáld újra.', 'error');
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
    setIdeaStatus(IDEA_ENDPOINT ? 'Köszönjük, megkaptuk az ötletedet!' : 'Elmentve! Köszönöm az ötletet.', 'ok');
  }

  function updateIdeaCounter() {
    $('ideaCounter').textContent = `${$('ideaText').value.length} / 1000`;
  }

  // ---------- Indítás ----------
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
    updateSoundBtn();
  });
  $('reveal').addEventListener('click', hideReveal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideReveal(); });
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
