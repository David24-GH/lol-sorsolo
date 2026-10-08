(() => {
  'use strict';

  const DDRAGON = 'https://ddragon.leagueoflegends.com';
  const LOCALE = 'hu_HU';
  const ROLE_ICON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champion-details/global/default/';
  // A champion-választás hangjai (angol), a champion numerikus kulcsa alapján.
  const CDRAGON_AUDIO = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/';
  const SOUND_KEY = 'lolSorsolo.sound';
  const REVEAL_MS = 5000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HISTORY_KEY = 'lolSorsolo.history';
  const HISTORY_MAX = 10;
  const SPIN_MS = 5500;
  const LABEL_LIMIT = 40;

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

  const $ = id => document.getElementById(id);
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = $('spinBtn');
  const ticker = $('ticker');

  let version = '';
  let champions = [];       // összes champion
  let pool = [];            // a szűrés után a keréken lévők
  const activeRoles = new Set(); // üres = minden champion a keréken van
  let rotation = 0;         // a kerék aktuális elforgatása radiánban
  let spinning = false;
  let highlightIdx = -1;    // a nyertes szelet kiemelése
  let highlightAlpha = 0;

  // ---------- Adatok ----------
  async function loadChampions() {
    showError(null);
    $('champCount').textContent = 'Championok betöltése…';
    try {
      const versions = await fetchJson(`${DDRAGON}/api/versions.json`);
      version = versions[0];
      const data = await fetchJson(`${DDRAGON}/cdn/${version}/data/${LOCALE}/champion.json`);
      champions = Object.values(data.data)
        .map(c => ({ id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags }))
        .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
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
        if (spinning) return;
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
    spinBtn.disabled = spinning || pool.length === 0;
    rotation = 0;
    highlightIdx = -1;
    ticker.innerHTML = '&nbsp;';
    drawWheel();
  }

  // ---------- Kerék rajzolása ----------
  function resizeCanvas() {
    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    drawWheel();
  }

  function drawWheel() {
    const w = canvas.width;
    if (!w) return;
    const r = w / 2;
    const n = pool.length;
    ctx.clearRect(0, 0, w, w);

    if (!n) {
      ctx.fillStyle = SLICE_COLORS[1];
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const seg = (Math.PI * 2) / n;
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(rotation);

    for (let i = 0; i < n; i++) {
      // A 0. szelet a 12 óránál kezdődik.
      const start = i * seg - Math.PI / 2;
      const labeled = n <= LABEL_LIMIT;
      let color;
      if (labeled) {
        color = SLICE_COLORS[i % SLICE_COLORS.length];
        if (i === n - 1 && n % SLICE_COLORS.length === 1) color = SLICE_COLORS[2];
      } else {
        // Sok szeletnél színátmenet, hogy a forgás jól látsszon.
        color = `hsl(${(i / n) * 360}, 45%, ${i % 2 ? 26 : 32}%)`;
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, start + seg);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (labeled) {
        ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
        ctx.lineWidth = Math.max(1, w / 900);
        ctx.stroke();
      }

      if (labeled) {
        ctx.save();
        ctx.rotate(start + seg / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f0e6d2';
        const fontSize = Math.min(w * 0.034, (seg * r * 0.8) * 0.75);
        ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(pool[i].name, r * 0.93, 0, r * 0.6);
        ctx.restore();
      }
    }

    if (highlightIdx >= 0 && highlightIdx < n) {
      // A nyertes szelet felvillan és arany keretet kap.
      const start = highlightIdx * seg - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, start + seg);
      ctx.closePath();
      ctx.fillStyle = `rgba(240, 230, 210, ${highlightAlpha})`;
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
  function indexAtPointer(rot) {
    const n = pool.length;
    const seg = (Math.PI * 2) / n;
    const a = mod(-rot, Math.PI * 2);
    return Math.min(n - 1, Math.floor(a / seg));
  }

  const mod = (a, m) => ((a % m) + m) % m;

  // ---------- Sorsolás ----------
  function randomInt(max) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  function spin() {
    const n = pool.length;
    if (spinning || !n) return;
    spinning = true;
    spinBtn.disabled = true;
    setRoleButtonsDisabled(true);
    highlightIdx = -1;

    const seg = (Math.PI * 2) / n;
    const winner = randomInt(n);
    preloadSounds(pool[winner]);
    // Véletlen eltolás a szeleten belül, hogy ne mindig középen álljon meg.
    const jitter = (Math.random() - 0.5) * seg * 0.7;
    const targetMod = mod(-((winner + 0.5) * seg + jitter), Math.PI * 2);
    const startRot = rotation;
    const delta = mod(targetMod - startRot, Math.PI * 2);
    const turns = 6 + randomInt(3);
    const endRot = startRot + turns * Math.PI * 2 + delta;
    const t0 = performance.now();
    let lastIdx = -1;

    function frame(now) {
      const t = Math.min(1, (now - t0) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      rotation = startRot + (endRot - startRot) * eased;
      drawWheel();
      const idx = indexAtPointer(rotation);
      if (idx !== lastIdx) {
        ticker.textContent = pool[idx].name;
        lastIdx = idx;
      }
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = mod(endRot, Math.PI * 2);
        finishSpin(pool[indexAtPointer(rotation)]);
      }
    }
    requestAnimationFrame(frame);
  }

  function finishSpin(champ) {
    spinning = false;
    spinBtn.disabled = pool.length === 0;
    setRoleButtonsDisabled(false);
    playSounds();
    flashWinner(pool.indexOf(champ));
    burstFromWheel();
    showReveal(champ);
    showResult(champ);
    addToHistory(champ.id);
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
  function flashWinner(idx) {
    highlightIdx = idx;
    if (reducedMotion) {
      highlightAlpha = 0.35;
      drawWheel();
      return;
    }
    const t0 = performance.now();
    const DURATION = 2400;
    function frame(now) {
      if (highlightIdx !== idx || spinning) return;
      const t = Math.min(1, (now - t0) / DURATION);
      // Négyszer felvillan, majd halvány kiemelésben marad.
      const pulse = (Math.sin(t * Math.PI * 8 - Math.PI / 2) + 1) / 2;
      highlightAlpha = 0.25 + pulse * 0.45 * (1 - t);
      drawWheel();
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

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

  function burstFromWheel() {
    const rect = canvas.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + 8, 70, 9);
  }

  let revealTimer = 0;

  function showReveal(champ) {
    const reveal = $('reveal');
    $('revealSplash').src = splashUrl(champ.id);
    $('revealSplash').alt = champ.name;
    $('revealName').textContent = champ.name;
    $('revealTitle').textContent = champ.title;
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

  function setRoleButtonsDisabled(disabled) {
    document.querySelectorAll('.role-btn').forEach(b => { b.disabled = disabled; });
  }

  function showResult(champ) {
    $('resultPlaceholder').hidden = true;
    const card = $('resultCard');
    card.hidden = false;
    $('resultSplash').src = splashUrl(champ.id);
    $('resultSplash').alt = champ.name;
    $('resultName').textContent = champ.name;
    $('resultTitle').textContent = champ.title;
    const tags = $('resultTags');
    tags.replaceChildren(...champ.tags.map(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = ROLE_LABEL[t] || t;
      return span;
    }));
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }

  // ---------- Előzmények ----------
  function readHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch { /* nem elérhető */ }
  }

  let history = readHistory();

  function addToHistory(id) {
    history = [id, ...history].slice(0, HISTORY_MAX);
    writeHistory(history);
    renderHistory();
  }

  function renderHistory() {
    const byId = new Map(champions.map(c => [c.id, c]));
    const items = history.map(id => byId.get(id)).filter(Boolean);
    const list = $('historyList');
    list.replaceChildren(...items.map(c => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = iconUrl(c.id);
      img.alt = '';
      img.loading = 'lazy';
      const span = document.createElement('span');
      span.textContent = c.name;
      li.append(img, span);
      return li;
    }));
    $('historyEmpty').hidden = items.length > 0;
    $('clearHistory').hidden = items.length === 0;
  }

  // ---------- Indítás ----------
  spinBtn.addEventListener('click', spin);
  $('retryBtn').addEventListener('click', loadChampions);
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
  window.addEventListener('resize', () => { resizeCanvas(); resizeFx(); });

  renderRoleButtons();
  updateSoundBtn();
  resizeCanvas();
  resizeFx();
  loadChampions();
})();
