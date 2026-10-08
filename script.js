(() => {
  'use strict';

  const DDRAGON = 'https://ddragon.leagueoflegends.com';
  const LOCALE = 'hu_HU';
  const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/';
  const ROLE_ICON_BASE = `${CDRAGON}rcp-fe-lol-champion-details/global/default/`;
  const LANE_ICON_BASE = `${CDRAGON}rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/`;
  // A champion-választás hangjai (angol), a champion numerikus kulcsa alapján.
  const CDRAGON_AUDIO = `${CDRAGON}rcp-be-lol-game-data/global/default/v1/`;
  const HISTORY_KEY = 'lolSorsolo.history';
  const SOUND_KEY = 'lolSorsolo.sound';
  const LANE_KEY = 'lolSorsolo.lane';
  const HISTORY_MAX = 10;
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

  const SLICE_COLORS = ['#13294b', '#0b1a30', '#1d3b5e', '#102238'];

  // ---------- Fun buildek ----------
  // A champion profilja a Riot "info" értékeiből (0–10) jön; ahol ez nem tükrözi
  // a valós játékot, ezek a listák javítják.
  const AP_EXTRA = new Set(['Gwen', 'Kaisa', 'KogMaw', 'Volibear', 'Shyvana', 'Udyr', 'Varus']);
  const AP_EXCLUDE = new Set(['Belveth', 'DrMundo', 'Jhin', 'KSante', 'Senna']);
  const AD_EXTRA = new Set(['Belveth']);
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
  // pool: a tárgyak fontossági sorrendben; az első kettő mindig bekerül, a többi véletlenszerűen.
  const BUILDS = [
    {
      id: 'ap', name: 'Teljes AP', color: '#5b2f9e',
      desc: 'Minden pont varázserőbe: egy kombó, és a célpont már nincs is.',
      pool: [6655, 4645, 3089, 3135, 3157, 3165, 4646, 3137, 3100, 3118],
      boots: [3020],
      keystones: ['Electrocute', 'ArcaneComet', 'DarkHarvest', 'FirstStrike'],
      ok: p => p.ap,
    },
    {
      id: 'aponhit', name: 'AP on-hit', color: '#7a3c8f',
      desc: 'Varázserő és támadási sebesség: minden ütésed egy kis varázslat.',
      pool: [3115, 3124, 4633, 3089, 3135, 3100, 3157, 4645, 3116],
      boots: [3006, 3020],
      keystones: ['LethalTempo', 'PressTheAttack', 'HailOfBlades'],
      ok: p => (p.ap && p.attack >= 6) || AP_ONHIT_EXTRA.has(p.id),
    },
    {
      id: 'aptank', name: 'AP tank', color: '#3d4f9e',
      desc: 'Szívós vagy, mégis fáj: tankolás varázserővel megfűszerezve.',
      pool: [6653, 4633, 3116, 8010, 3157, 3068, 4401, 2502, 3075],
      boots: [3047, 3111],
      keystones: ['Conqueror', 'GraspOfTheUndying', 'PhaseRush', 'Aftershock'],
      ok: p => p.magic >= 5 && p.defense >= 5,
    },
    {
      id: 'lethality', name: 'Lethality', color: '#8f2a2a',
      desc: 'Páncéltörés és kitörő sebzés: vadászd le a puha célpontokat.',
      pool: [3142, 6697, 6698, 6696, 3814, 6694, 6676, 3156],
      boots: [3158, 3047],
      keystones: ['Electrocute', 'DarkHarvest', 'FirstStrike', 'HailOfBlades'],
      ok: p => p.ad,
    },
    {
      id: 'crit', name: 'Kritikus csapás', color: '#b5652a',
      desc: 'Minden ütés kritikus: lassan indul, de a végén minden olvad tőle.',
      pool: [3031, 6672, 3046, 3036, 3094, 3072, 6676, 3095, 3026, 3033],
      boots: [3006],
      keystones: ['LethalTempo', 'PressTheAttack', 'FleetFootwork', 'HailOfBlades'],
      ok: p => p.ad && (p.has('Marksman') || p.attack >= 7),
    },
    {
      id: 'onhit', name: 'On-hit', color: '#9e7a2a',
      desc: 'Gyors ütések ráadás-sebzéssel: a hosszú harcok királya vagy.',
      pool: [3153, 3091, 3124, 3302, 6672, 6673, 3026, 3139],
      boots: [3006],
      keystones: ['LethalTempo', 'PressTheAttack', 'Conqueror'],
      ok: p => p.ad && (p.has('Marksman') || p.has('Fighter') || p.attack >= 7),
    },
    {
      id: 'bruiser', name: 'Bruiser', color: '#7a4a2a',
      desc: 'Sebzés és túlélés egyensúlya: a csatatér közepén a helyed.',
      pool: [3078, 3053, 3071, 6333, 3748, 6610, 3181, 3161, 3073, 3065],
      boots: [3047, 3111],
      keystones: ['Conqueror', 'GraspOfTheUndying', 'PhaseRush'],
      ok: p => p.melee && p.attack >= 5 && (p.has('Fighter') || p.has('Tank') || p.has('Assassin')),
    },
    {
      id: 'tank', name: 'Teljes tank', color: '#2f6b4f',
      desc: 'Csak életerő és páncél: sebzés nélkül is te leszel a csapat fala.',
      pool: [3084, 3068, 3075, 4401, 3143, 2502, 6665, 3110, 3065],
      boots: [3047, 3111],
      keystones: ['GraspOfTheUndying', 'Aftershock', 'Guardian'],
      ok: p => p.has('Tank') || p.has('Fighter') || (p.has('Support') && p.melee),
    },
    {
      id: 'heartsteel', name: 'HP-halmozás', color: '#2a7a6b',
      desc: 'Acélos szív és Warmog: nőj óriásira, és üss a saját életerőddel.',
      pool: [3084, 3083, 6665, 3065, 2502, 3068, 3143, 4401],
      boots: [3047, 3111],
      keystones: ['GraspOfTheUndying', 'Aftershock'],
      ok: p => (p.has('Tank') || p.has('Fighter')) && p.defense >= 5,
    },
    {
      id: 'lifesteal', name: 'Vámpír', color: '#7a1f3d',
      desc: 'Életlopás mindenből: amíg ütsz, addig nem halsz meg.',
      pool: [3072, 3074, 6673, 3153, 6610, 6333, 3031, 3036],
      boots: [3008],
      keystones: ['Conqueror', 'FleetFootwork', 'LethalTempo'],
      ok: p => p.ad,
    },
    {
      id: 'enchanter', name: 'Enchanter', color: '#2a8f8a',
      desc: 'Pajzsok és gyógyítás: a csapatod lesz a fegyvered.',
      pool: [6617, 3107, 3504, 6616, 6620, 6621, 3222, 2065, 4005],
      boots: [3158, 3009],
      keystones: ['SummonAery', 'Guardian', 'UnsealedSpellbook'],
      ok: p => p.has('Support') && p.magic >= 5,
    },
    {
      id: 'tear', name: 'Mana-halmozás', color: '#2a5f9e',
      desc: 'Könnycsepp-tárgyakra építesz: lassan éled, de a végén hatalmas.',
      pool: {
        ap: [3003, 6655, 3089, 3135, 3157, 4645, 3165],
        ad: [3004, 3071, 6694, 3036, 6676, 3142, 3161],
        tank: [3119, 3084, 3068, 3075, 4401, 2502, 3143],
      },
      boots: { ap: [3020], ad: [3158], tank: [3047] },
      keystones: { ap: ['ArcaneComet', 'PhaseRush'], ad: ['Conqueror', 'FleetFootwork'], tank: ['GraspOfTheUndying'] },
      ok: p => p.mana,
    },
    {
      id: 'ms', name: 'Mozgási sebesség', color: '#1f7a9e',
      desc: 'Senki nem ér utol: te leszel a leggyorsabb a pályán.',
      pool: {
        ad: [3142, 3046, 6631, 3078, 6672, 6610],
        ap: [3152, 4629, 2065, 4646, 6655, 3089],
        tank: [3742, 4401, 3050, 3068, 3084, 3143],
      },
      boots: [3009],
      keystones: ['PhaseRush', 'FleetFootwork', 'HailOfBlades'],
      ok: () => true,
    },
    {
      id: 'haste', name: 'Képesség-gyorsítás', color: '#4a6b9e',
      desc: 'Szinte nincs töltési idő: képesség képesség hátán.',
      pool: {
        ad: [3071, 3161, 3073, 6694, 6333, 6610, 3142],
        ap: [4629, 3118, 6653, 3165, 3137, 6655, 3157],
        tank: [3110, 3050, 2504, 3068, 6665, 4401, 3084],
      },
      boots: [3158],
      keystones: ['ArcaneComet', 'UnsealedSpellbook', 'PhaseRush', 'Conqueror'],
      ok: () => true,
    },
  ];
  const BUILD_BY_ID = new Map(BUILDS.map(b => [b.id, b]));

  // Ha a build saját tárgyai elfogynak (pl. kivettek egy tárgyat a játékból), ezekből pótol.
  const FALLBACK_POOL = {
    ad: [3031, 6672, 3072, 3036, 3046, 3153, 6673, 3071, 6333, 3026],
    ap: [3089, 6655, 4645, 3135, 3157, 3165, 4646, 3116, 3100],
    tank: [3084, 3068, 3075, 4401, 3143, 2502, 6665, 3110, 3065, 3083],
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
    if (boots) items.push(boots);
    items.push(...chooseItems(byKind(build.pool), FALLBACK_POOL[p.kind], lane.items, p.melee));

    return {
      build,
      lane,
      spells: spellsFor(laneId, build),
      runes: runePage(byKind(build.keystones)),
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
      const [champJson, itemJson, runeJson, spellJson] = await Promise.all([
        fetchJson(data('champion.json')),
        optional('item.json'),
        optional('runesReforged.json'),
        optional('summoner.json'),
      ]);
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
      renderHistory();
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
        lane = l.id;
        try { localStorage.setItem(LANE_KEY, lane); } catch { /* nem elérhető */ }
        wrap.querySelectorAll('.lane-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lane === lane)));
        updateSpinState();
      });
      wrap.appendChild(btn);
    }
    $('laneButtons').classList.toggle('has-selection', !!lane);
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
    if (activeRoles.size === 0) {
      pool = champions;
      $('champCount').textContent = `Mind a ${pool.length} champion a keréken van · válassz szerepkört a szűréshez`;
    } else {
      pool = champions.filter(c => c.tags.some(t => activeRoles.has(t)));
      const labels = ROLES.filter(r => activeRoles.has(r.tag)).map(r => r.label).join(', ');
      $('champCount').textContent = `${pool.length} champion a keréken (${labels})`;
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
    document.querySelectorAll('.role-btn, .lane-btn').forEach(b => { b.disabled = disabled; });
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
      addToHistory(champ.id, lane);
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
      burstFromWheel(buildWheel.canvas);
      const extras = [
        ...full.spells.map(s => ({ src: spellIconUrl(s.id), alt: s.name })),
        ...(full.runes ? [{ src: runeIconUrl(full.runes.keystone.icon), alt: full.runes.keystone.name, rune: true }] : []),
      ];
      showReveal({
        label: `Fun build · ${champ.name} · ${full.lane.label}`,
        name: build.name,
        title: build.desc,
        icons: full.items.map(it => ({ src: itemIconUrl(it.id), alt: it.name })),
        extras,
      });
      showBuildCard(full);
      setHistoryBuild(champ.id, laneId, build.id);
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
    } else {
      runesEl.replaceChildren(textEl('p', 'A rúnák most nem érhetők el.', 'muted'));
    }

    const list = [...(full.starter ? [full.starter] : []), ...full.items];
    $('buildItems').replaceChildren(...list.map(it => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = '';
      const text = document.createElement('div');
      text.appendChild(textEl('span', it.name));
      if (it.note) text.appendChild(textEl('small', it.note));
      li.append(img, text);
      if (it.note === 'Kezdő tárgy') li.className = 'starter';
      return li;
    }));
    if (!list.length) $('buildItems').replaceChildren(textEl('li', 'A tárgyak most nem érhetők el.', 'muted'));

    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
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
  // Egy bejegyzés: { c: champion id, l: lane id, b: build id vagy null }
  function readHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      // A legelső verzió csak champion id-ket tárolt.
      return arr.map(e => (typeof e === 'string' ? { c: e, b: null } : e)).filter(e => e && e.c);
    } catch {
      return [];
    }
  }

  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch { /* nem elérhető */ }
  }

  let history = readHistory();

  function addToHistory(champId, laneId) {
    history = [{ c: champId, l: laneId, b: null }, ...history].slice(0, HISTORY_MAX);
    writeHistory(history);
    renderHistory();
  }

  function setHistoryBuild(champId, laneId, buildId) {
    if (history[0] && history[0].c === champId) history[0].b = buildId;
    else history = [{ c: champId, l: laneId, b: buildId }, ...history].slice(0, HISTORY_MAX);
    writeHistory(history);
    renderHistory();
  }

  function renderHistory() {
    const byId = new Map(champions.map(c => [c.id, c]));
    const entries = history.filter(e => byId.has(e.c));
    $('historyList').replaceChildren(...entries.map(e => {
      const c = byId.get(e.c);
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = iconUrl(c.id);
      img.alt = '';
      img.loading = 'lazy';
      const text = document.createElement('div');
      text.appendChild(textEl('span', c.name));
      const details = [LANE_BY_ID.get(e.l), BUILD_BY_ID.get(e.b)].filter(Boolean).map(x => x.label || x.name);
      if (details.length) text.appendChild(textEl('small', details.join(' · ')));
      li.append(img, text);
      return li;
    }));
    $('historyEmpty').hidden = entries.length > 0;
    $('clearHistory').hidden = entries.length === 0;
  }

  // ---------- Indítás ----------
  spinBtn.addEventListener('click', spinChampion);
  buildSpinBtn.addEventListener('click', spinBuild);
  $('newChampBtn').addEventListener('click', leaveBuildStage);
  $('retryBtn').addEventListener('click', loadData);
  $('clearHistory').addEventListener('click', () => {
    history = [];
    writeHistory(history);
    renderHistory();
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
  updateSoundBtn();
  updateSpinState();
  champWheel.resize();
  resizeFx();
  loadData();
})();
