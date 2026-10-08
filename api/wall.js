// Közös üzenőfal (Ötletek fül): Vercel szerverfüggvény, Upstash Redis tárolóval.
//
// GET  /api/wall?client=<id>                    → a legújabb üzenetek, lájkokkal
// POST /api/wall { action: 'post', name, category, text, website }
// POST /api/wall { action: 'like', id, client } → lájk be/ki
// POST /api/wall { action: 'delete', id, adminKey }
// POST /api/wall { action: 'checkAdmin', adminKey }
//
// Környezeti változók (Vercel → Settings → Environment Variables):
//   KV_REST_API_URL / KV_REST_API_TOKEN (vagy UPSTASH_REDIS_REST_URL / _TOKEN) – az Upstash integráció adja
//   ADMIN_KEY – a moderáláshoz használt titkos kód

const crypto = require('crypto');

const PAGE_SIZE = 50;
const MAX_POSTS = 200;
const POST_COOLDOWN_S = 30;
const MAX_TEXT = 1000;
const MIN_TEXT = 3;
const MAX_NAME = 40;
const CATEGORIES = ['Új funkció', 'Build javaslat', 'Hiba', 'Egyéb'];
const ID_RE = /^[a-z0-9-]{6,40}$/i;
const CLIENT_RE = /^[a-z0-9-]{8,64}$/i;

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const postKey = id => `wall:post:${id}`;
const likesKey = id => `wall:likes:${id}`;
const IDS_KEY = 'wall:ids';

// Több Redis parancs egy kérésben (Upstash REST pipeline).
async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const out = await res.json();
  return out.map(r => {
    if (r.error) throw new Error(`Redis: ${r.error}`);
    return r.result;
  });
}

// Vezérlő- és láthatatlan karakterek kiszűrése, felesleges szóközök levágása.
function clean(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏ - ﻿]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function isAdmin(key) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || typeof key !== 'string' || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function listPosts(client) {
  const [ids] = await redis([['ZREVRANGE', IDS_KEY, '0', String(PAGE_SIZE - 1)]]);
  if (!ids || !ids.length) return [];
  const viewer = CLIENT_RE.test(client || '') ? client : '-';
  const results = await redis(ids.flatMap(id => [
    ['GET', postKey(id)],
    ['SCARD', likesKey(id)],
    ['SISMEMBER', likesKey(id), viewer],
  ]));
  return ids.map((id, i) => {
    const raw = results[i * 3];
    if (!raw) return null;
    const post = JSON.parse(raw);
    return { ...post, likes: Number(results[i * 3 + 1]) || 0, liked: Number(results[i * 3 + 2]) === 1 };
  }).filter(Boolean);
}

async function createPost(body, ip) {
  // Spam-csapda: ezt a rejtett mezőt csak a botok töltik ki.
  if (body.website) return { status: 200, data: { ok: true } };

  const text = clean(body.text, MAX_TEXT);
  if (text.length < MIN_TEXT) return { status: 400, data: { error: 'too-short' } };
  const name = clean(body.name, MAX_NAME).replace(/\s+/g, ' ') || 'Névtelen';
  const category = CATEGORIES.includes(body.category) ? body.category : 'Egyéb';

  // Egy címről legfeljebb 30 másodpercenként egy üzenet.
  const [allowed] = await redis([['SET', `wall:rate:${ip}`, '1', 'EX', String(POST_COOLDOWN_S), 'NX']]);
  if (allowed !== 'OK') return { status: 429, data: { error: 'too-fast' } };

  const ts = Date.now();
  const id = `${ts.toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const post = { id, name, category, text, ts };
  await redis([['SET', postKey(id), JSON.stringify(post)], ['ZADD', IDS_KEY, String(ts), id]]);

  // A legrégebbi üzenetek törlése, ha túl sok gyűlt össze.
  const [old] = await redis([['ZRANGE', IDS_KEY, '0', String(-(MAX_POSTS + 1))]]);
  if (old && old.length) {
    await redis(old.flatMap(oldId => [['DEL', postKey(oldId), likesKey(oldId)], ['ZREM', IDS_KEY, oldId]]));
  }
  return { status: 201, data: { post: { ...post, likes: 0, liked: false } } };
}

async function toggleLike(body) {
  const { id, client } = body;
  if (!ID_RE.test(id || '') || !CLIENT_RE.test(client || '')) return { status: 400, data: { error: 'bad-request' } };
  const [exists, liked] = await redis([['EXISTS', postKey(id)], ['SISMEMBER', likesKey(id), client]]);
  if (!Number(exists)) return { status: 404, data: { error: 'not-found' } };
  const nowLiked = !Number(liked);
  const [, count] = await redis([
    [nowLiked ? 'SADD' : 'SREM', likesKey(id), client],
    ['SCARD', likesKey(id)],
  ]);
  return { status: 200, data: { likes: Number(count) || 0, liked: nowLiked } };
}

async function deletePost(body) {
  if (!isAdmin(body.adminKey)) return { status: 403, data: { error: 'forbidden' } };
  if (!ID_RE.test(body.id || '')) return { status: 400, data: { error: 'bad-request' } };
  await redis([['DEL', postKey(body.id), likesKey(body.id)], ['ZREM', IDS_KEY, body.id]]);
  return { status: 200, data: { ok: true } };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) {
    res.status(503).json({ error: 'not-configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      res.status(200).json({ posts: await listPosts(req.query.client) });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const ip = String(req.headers['x-forwarded-for'] || 'ismeretlen').split(',')[0].trim();
    let result;
    switch (body.action) {
      case 'post': result = await createPost(body, ip); break;
      case 'like': result = await toggleLike(body); break;
      case 'delete': result = await deletePost(body); break;
      case 'checkAdmin': result = { status: isAdmin(body.adminKey) ? 200 : 403, data: { ok: isAdmin(body.adminKey) } }; break;
      default: result = { status: 400, data: { error: 'unknown-action' } };
    }
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server-error' });
  }
};
