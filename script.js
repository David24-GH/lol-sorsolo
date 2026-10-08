(() => {
  'use strict';

  const DDRAGON = 'https://ddragon.leagueoflegends.com';
  const LOCALE = 'hu_HU';
  const ROLE_ICON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champion-details/global/default/';
  // A champion-választás hangjai (angol), a champion numerikus kulcsa alapján.
  const CDRAGON_AUDIO = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/';
  const HISTORY_KEY = 'lolSorsolo.history';
  const SOUND_KEY = 'lolSorsolo.sound';
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

  const SLICE_COLORS = ['#13294b', '#0b1a30', '#1d3b5e', '#102238'];

  // ---------- Fun buildek ----------
  // A champion profilja a Riot "info" értékeiből (0–10) jön; ahol ez nem tükrözi
  // a valós játékot, ezek a listák javítják.
  const AP_EXTRA = new Set(['Gwen', 'Kaisa', 'KogMaw', 'Volibear', 'Shyvana', 'Udyr', 'Varus']);
  const AP_EXCLUDE = new Set(['Belveth', 'DrMundo', 'Jhin', 'KSante', 'Senna']);
  const AD_EXTRA = new Set(['Belveth']);
  const AD_EXCLUDE = new Set(['Azir', 'Diana', 'Elise', 'Gwen', 'Hwei', 'Kennen']);
  // Néhány championnál a Riot adataiban minden érték 0.
  const INFO_FIX = {
    Akshan: { attack: 8, defense: 3, magic: 2 },
    Qiyana: { attack: 9, defense: 2, magic: 2 },
    Rell: { attack: 3, defense: 8, magic: 6 },
    Seraphine: { attack: 1, defense: 3, magic: 8 },
    Vex: { attack: 1, defense: 3, magic: 9 },
  };
  const AP_ONHIT_EXTRA = new Set(['Kayle', 'Teemo', 'Kaisa', 'Gwen', 'KogMaw', 'Varus', 'Katarina']);

  // Az items mező vagy egy tárgylista, vagy profilonként ({ ad, ap, tank }) külön lista.
  const BUILDS = [
    {
      id: 'ap', name: 'Teljes AP', color: '#5b2f9e',
      desc: 'Minden pont varázserőbe: egy kombó, és a célpont már nincs is.',
      items: [6655, 4645, 3089, 3135, 3157],
      ok: p => p.ap,
    },
    {
      id: 'aponhit', name: 'AP on-hit', color: '#7a3c8f',
      desc: 'Varázserő és támadási sebesség: minden ütésed egy kis varázslat.',
      items: [3115, 3124, 4633, 3089],
      ok: p => (p.ap && p.attack >= 6) || AP_ONHIT_EXTRA.has(p.id),
    },
    {
      id: 'aptank', name: 'AP tank', color: '#3d4f9e',
      desc: 'Szívós vagy, mégis fáj: tankolás varázserővel megfűszerezve.',
      items: [6653, 4633, 3116, 3157, 8010],
      ok: p => p.magic >= 5 && p.defense >= 5,
    },
    {
      id: 'lethality', name: 'Lethality', color: '#8f2a2a',
      desc: 'Páncéltörés és kitörő sebzés: vadászd le a puha célpontokat.',
      items: [3142, 6697, 6698, 6696, 3814, 6694],
      ok: p => p.ad,
    },
    {
      id: 'crit', name: 'Kritikus csapás', color: '#b5652a',
      desc: 'Minden ütés kritikus: lassan indul, de a végén minden olvad tőle.',
      items: [3031, 6672, 3046, 3036, 3094],
      ok: p => p.ad && (p.has('Marksman') || p.attack >= 7),
    },
    {
      id: 'onhit', name: 'On-hit', color: '#9e7a2a',
      desc: 'Gyors ütések ráadás-sebzéssel: a hosszú harcok királya vagy.',
      items: [3153, 3091, 3124, 3302],
      ok: p => p.ad && (p.has('Marksman') || p.has('Fighter') || p.attack >= 7),
    },
    {
      id: 'bruiser', name: 'Bruiser', color: '#7a4a2a',
      desc: 'Sebzés és túlélés egyensúlya: a csatatér közepén a helyed.',
      items: [3078, 3053, 3071, 6333, 3748],
      ok: p => p.melee && p.attack >= 5 && (p.has('Fighter') || p.has('Tank') || p.has('Assassin')),
    },
    {
      id: 'tank', name: 'Teljes tank', color: '#2f6b4f',
      desc: 'Csak életerő és páncél: sebzés nélkül is te leszel a csapat fala.',
      items: [3084, 3068, 3075, 4401, 3143, 2502],
      ok: p => p.has('Tank') || p.has('Fighter') || (p.has('Support') && p.melee),
    },
    {
      id: 'heartsteel', name: 'HP-halmozás', color: '#2a7a6b',
      desc: 'Acélos szív és Warmog: nőj óriásira, és üss a saját életerőddel.',
      items: [3084, 3083, 6665, 3065],
      ok: p => (p.has('Tank') || p.has('Fighter')) && p.defense >= 5,
    },
    {
      id: 'lifesteal', name: 'Vámpír', color: '#7a1f3d',
      desc: 'Életlopás mindenből: amíg ütsz, addig nem halsz meg.',
      items: [3072, 3074, 6673, 3153],
      ok: p => p.ad,
    },
    {
      id: 'enchanter', name: 'Enchanter', color: '#2a8f8a',
      desc: 'Pajzsok és gyógyítás: a csapatod lesz a fegyvered.',
      items: [6617, 3107, 3504, 6616, 6620, 6621],
      ok: p => p.has('Support') && p.magic >= 5,
    },
    {
      id: 'tear', name: 'Mana-halmozás', color: '#2a5f9e',
      desc: 'Könnycsepp-tárgyakra építesz: lassan éled, de a végén hatalmas.',
      items: { ap: [3003, 6655, 3089], ad: [3004, 3071, 6694], tank: [3119, 3084, 3068] },
      ok: p => p.mana,
    },
    {
      id: 'ms', name: 'Mozgási sebesség', color: '#1f7a9e',
      desc: 'Senki nem ér utol: te leszel a leggyorsabb a pályán.',
      items: { ad: [3009, 3142, 3046, 6631], ap: [3009, 3152, 4629, 2065], tank: [3009, 3742, 4401, 3050] },
      ok: () => true,
    },
    {
      id: 'haste', name: 'Képesség-gyorsítás', color: '#4a6b9e',
      desc: 'Szinte nincs töltési idő: képesség képesség hátán.',
      items: { ad: [3158, 3071, 3161, 3073], ap: [3158, 4629, 3118, 6653], tank: [3158, 3110, 3050, 2504] },
      ok: () => true,
    },
  ];

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

  function itemsOf(build, champ) {
    const ids = Array.isArray(build.items) ? build.items : build.items[profileOf(champ).kind];
    // Ha egy tárgy kikerült a játékból, egyszerűen kimarad.
    return ids.map(id => itemData.get(String(id))).filter(Boolean);
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
  let champions = [];       // összes champion
  let pool = [];            // a szűrés után a keréken lévők
  let itemData = new Map(); // megvásárolható tárgyak: id -> { id, name }
  let currentChamp = null;
  const activeRoles = new Set(); // üres = minden champion a keréken van

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
      const [champJson, itemJson] = await Promise.all([
        fetchJson(`${DDRAGON}/cdn/${version}/data/${LOCALE}/champion.json`),
        // A tárgyak nélkül is működik az oldal, csak a buildek tárgyai maradnak el.
        fetchJson(`${DDRAGON}/cdn/${version}/data/${LOCALE}/item.json`).catch(() => ({ data: {} })),
      ]);
      champions = Object.values(champJson.data)
        .map(c => ({
          id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags,
          info: c.info, partype: c.partype, range: c.stats.attackrange,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
      itemData = new Map(Object.entries(itemJson.data)
        .filter(([, it]) => it.gold && it.gold.purchasable && it.maps && it.maps['11'])
        .map(([id, it]) => [id, { id, name: it.name }]));
      $('versionInfo').textContent = `Adatok: Riot Data Dragon, ${version} verzió · ${champions.length} champion`;
      applyFilter();
      renderHistory();
    } catch (err) {
      console.error(err);
      $('champCount').textContent = '';
      showError('Nem sikerült betölteni a championok listáját. Ellenőrizd az internetkapcsolatot, majd próbáld újra.');
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} – ${url}`);
    return res.json();
  }

  const iconUrl = id => `${DDRAGON}/cdn/${version}/img/champion/${id}.png`;
  const splashUrl = id => `${DDRAGON}/cdn/img/champion/splash/${id}_0.jpg`;
  const itemIconUrl = id => `${DDRAGON}/cdn/${version}/img/item/${id}.png`;

  function showError(message) {
    $('errorBox').hidden = !message;
    $('errorText').textContent = message || '';
  }

  // ---------- Szűrés ----------
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
    spinBtn.disabled = pool.length === 0;
    $('ticker').innerHTML = '&nbsp;';
    champWheel.setItems(pool);
  }

  function setRoleButtonsDisabled(disabled) {
    document.querySelectorAll('.role-btn').forEach(b => { b.disabled = disabled; });
  }

  // ---------- Champion sorsolás ----------
  function spinChampion() {
    const winner = champWheel.spin(CHAMP_SPIN_MS, $('ticker'), champ => {
      spinBtn.disabled = false;
      setRoleButtonsDisabled(false);
      playSounds();
      burstFromWheel(champWheel.canvas);
      showReveal({
        label: 'A te championod',
        name: champ.name,
        title: champ.title,
        splash: splashUrl(champ.id),
      });
      enterBuildStage(champ);
      addToHistory(champ.id);
    });
    if (!winner) return;
    spinBtn.disabled = true;
    setRoleButtonsDisabled(true);
    preloadSounds(winner);
  }

  function enterBuildStage(champ) {
    currentChamp = champ;
    $('bannerIcon').src = iconUrl(champ.id);
    $('bannerName').textContent = champ.name;
    $('bannerTitle').textContent = champ.title;
    $('bannerTags').replaceChildren(...champ.tags.map(t => tagEl(ROLE_LABEL[t] || t)));
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
    $('buildCount').textContent = `${builds.length} játszható build ${champ.name} számára`;
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
    $('ticker').innerHTML = '&nbsp;';
    champWheel.resize();
  }

  // ---------- Build sorsolás ----------
  function spinBuild() {
    const champ = currentChamp;
    const winner = buildWheel.spin(BUILD_SPIN_MS, $('buildTicker'), build => {
      buildSpinBtn.disabled = false;
      $('newChampBtn').disabled = false;
      const items = itemsOf(build, champ);
      burstFromWheel(buildWheel.canvas);
      showReveal({
        label: `Fun build · ${champ.name}`,
        name: build.name,
        title: build.desc,
        items,
      });
      showBuildCard(build, items);
      setHistoryBuild(champ.id, build.id);
    });
    if (!winner) return;
    buildSpinBtn.disabled = true;
    $('newChampBtn').disabled = true;
  }

  function showBuildCard(build, items) {
    $('buildPlaceholder').hidden = true;
    const card = $('buildCard');
    card.hidden = false;
    card.style.setProperty('--build-color', build.color);
    $('buildName').textContent = build.name;
    $('buildDesc').textContent = build.desc;
    $('buildItems').replaceChildren(...items.map(it => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = '';
      const span = document.createElement('span');
      span.textContent = it.name;
      li.append(img, span);
      return li;
    }));
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }

  function tagEl(text) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = text;
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

  // Teljes képernyős bemutató: vagy egy splash kép, vagy tárgyikonok sora.
  function showReveal({ label, name, title, splash, items }) {
    const reveal = $('reveal');
    $('revealFrame').hidden = !splash;
    if (splash) {
      $('revealSplash').src = splash;
      $('revealSplash').alt = name;
    }
    const itemsEl = $('revealItems');
    itemsEl.hidden = !items || !items.length;
    itemsEl.replaceChildren(...(items || []).map((it, i) => {
      const img = document.createElement('img');
      img.src = itemIconUrl(it.id);
      img.alt = it.name;
      img.title = it.name;
      img.style.animationDelay = `${0.15 + i * 0.12}s`;
      return img;
    }));
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

  function hideReveal() {
    clearTimeout(revealTimer);
    const reveal = $('reveal');
    if (reveal.hidden) return;
    reveal.classList.remove('show');
    reveal.hidden = true;
  }

  // ---------- Előzmények ----------
  // Egy bejegyzés: { c: champion id, b: build id vagy null }
  function readHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      // A korábbi verzió csak champion id-ket tárolt.
      return arr.map(e => (typeof e === 'string' ? { c: e, b: null } : e)).filter(e => e && e.c);
    } catch {
      return [];
    }
  }

  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch { /* nem elérhető */ }
  }

  let history = readHistory();

  function addToHistory(champId) {
    history = [{ c: champId, b: null }, ...history].slice(0, HISTORY_MAX);
    writeHistory(history);
    renderHistory();
  }

  function setHistoryBuild(champId, buildId) {
    if (history[0] && history[0].c === champId) history[0].b = buildId;
    else history = [{ c: champId, b: buildId }, ...history].slice(0, HISTORY_MAX);
    writeHistory(history);
    renderHistory();
  }

  function renderHistory() {
    const byId = new Map(champions.map(c => [c.id, c]));
    const buildById = new Map(BUILDS.map(b => [b.id, b]));
    const entries = history.filter(e => byId.has(e.c));
    $('historyList').replaceChildren(...entries.map(e => {
      const c = byId.get(e.c);
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = iconUrl(c.id);
      img.alt = '';
      img.loading = 'lazy';
      const text = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = c.name;
      text.appendChild(name);
      const build = buildById.get(e.b);
      if (build) {
        const small = document.createElement('small');
        small.textContent = build.name;
        text.appendChild(small);
      }
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

  renderRoleButtons();
  updateSoundBtn();
  champWheel.resize();
  resizeFx();
  loadData();
})();
