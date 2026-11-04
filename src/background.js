// Custom Stickers for Messenger: background service worker.
// Fetches sticker images for the panel's link import and for the right-click menu.
// It has host permissions, so it can read images from any site (Facebook's CSP would
// stop the panel from fetching them itself). Images picked from other sites wait in a
// queue until a Facebook tab turns them into stickers.
const TH = /^th/i.test(chrome.i18n.getUILanguage());
const T = TH
  ? {
      image: 'เพิ่มในสติกเกอร์ Messenger ของฉัน',
      pack: 'นำเข้าชุดสติกเกอร์ LINE นี้ไปที่สติกเกอร์ Messenger',
      action: 'สติกเกอร์ Messenger ของฉัน',
      noImage: 'ไม่พบรูปในลิงก์นี้ ลองคลิกขวาที่รูปแล้วเลือก "เพิ่มในสติกเกอร์ Messenger ของฉัน"',
      telegram: 'ยังไม่รองรับชุดสติกเกอร์ Telegram',
      tooBig: 'ไฟล์ใหญ่เกินไป',
    }
  : {
      image: 'Add to my Messenger stickers',
      pack: 'Import this LINE sticker pack to my Messenger stickers',
      action: 'My Messenger stickers',
      noImage: 'No image found at that link. Right-click the image and choose "Add to my Messenger stickers".',
      telegram: "Telegram sticker packs aren't supported yet",
      tooBig: 'That file is too big',
    };

const PENDING = 'fbcs:pending';
const MAX_BYTES = 15 * 1024 * 1024;
const LINE_CDN = 'https://stickershop.line-scdn.net/stickershop/v1';
const LINE_PACK_PATTERNS = ['*://store.line.me/stickershop/product/*', '*://line.me/S/sticker/*'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'fbcs-image', title: T.image, contexts: ['image'] });
    chrome.contextMenus.create({ id: 'fbcs-pack-link', title: T.pack, contexts: ['link'], targetUrlPatterns: LINE_PACK_PATTERNS });
    chrome.contextMenus.create({ id: 'fbcs-pack-page', title: T.pack, contexts: ['page'], documentUrlPatterns: LINE_PACK_PATTERNS });
  });
  chrome.action.setTitle({ title: T.action });
  chrome.action.setBadgeBackgroundColor({ color: '#a033ff' });
  updateBadge();
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: 'https://www.facebook.com/messages/' }));

// ---------------------------------------------------------------- pending queue
// Only this worker writes the queue, one change at a time, so pushes and takes never race.
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));

function pushPending(item) {
  return serial(async () => {
    const list = (await chrome.storage.local.get(PENDING))[PENDING] || [];
    list.push(item);
    await chrome.storage.local.set({ [PENDING]: list });
    updateBadge(list.length);
  });
}
function takePending() {
  return serial(async () => {
    const list = (await chrome.storage.local.get(PENDING))[PENDING] || [];
    if (list.length) await chrome.storage.local.set({ [PENDING]: [] });
    updateBadge(0);
    return list;
  });
}
async function updateBadge(n) {
  if (n == null) n = ((await chrome.storage.local.get(PENDING))[PENDING] || []).length;
  chrome.action.setBadgeText({ text: n ? String(n) : '' });
}
function flashBadge(text) {
  chrome.action.setBadgeText({ text });
  setTimeout(() => updateBadge(), 4000);
}

async function queueFrom(url) {
  const { title, items } = await resolve(url);
  chrome.action.setBadgeText({ text: '…' });
  let added = 0;
  for (const it of items) {
    try {
      const img = await fetchImage(it.urls);
      await pushPending({ ...img, name: it.name || img.name, source: it.source || it.urls[0], pack: title || '' });
      added++;
    } catch (err) {
      console.warn('[fbcs] fetch failed', it.urls[0], err);
    }
  }
  if (!added) flashBadge('!');
  else updateBadge();
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'fbcs-image') {
      if (info.srcUrl.startsWith('blob:') && tab && tab.id >= 0) {
        // A blob: URL can only be read by the page that made it (e.g. a sticker in an
        // encrypted Messenger chat), so read it inside that frame.
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [info.frameId || 0] },
          func: async url => {
            const blob = await (await fetch(url)).blob();
            return await new Promise((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve({ data: r.result, mime: blob.type });
              r.onerror = () => reject(r.error);
              r.readAsDataURL(blob);
            });
          },
          args: [info.srcUrl],
        });
        if (!res || !res.result) throw new Error('could not read image');
        await pushPending({ ...res.result, name: 'Sticker', source: '', pack: '' });
        return;
      }
      await queueFrom(info.srcUrl);
    } else if (info.menuItemId === 'fbcs-pack-link') {
      await queueFrom(info.linkUrl);
    } else if (info.menuItemId === 'fbcs-pack-page') {
      await queueFrom(info.pageUrl);
    }
  } catch (err) {
    console.warn('[fbcs] context menu import failed', err);
    flashBadge('!');
  }
});

// ---------------------------------------------------------------- link resolving
// Returns { title, items: [{ urls: [best, ...fallbacks], name, source }] }.
async function resolve(raw) {
  const u = new URL(raw);
  let m;
  if (
    (u.hostname === 'store.line.me' && (m = u.pathname.match(/\/stickershop\/product\/(\d+)/))) ||
    (u.hostname === 'line.me' && (m = u.pathname.match(/\/S\/sticker\/(\d+)/)))
  ) {
    return linePack(m[1]);
  }
  if (u.hostname.endsWith('line-scdn.net') && (m = u.pathname.match(/\/stickershop\/v1\/sticker\/(\d+)\//))) {
    return { title: '', items: [{ urls: lineStickerUrls(m[1], 'unknown'), source: 'line:' + m[1] }] };
  }
  if (/(^|\.)giphy\.com$/.test(u.hostname)) {
    const id = giphyId(u);
    if (id) {
      const base = `https://media.giphy.com/media/${id}/`;
      return { title: '', items: [{ urls: [base + 'giphy.webp', base + 'giphy.gif'], source: 'giphy:' + id, name: giphyName(u) }] };
    }
  }
  if (/(^|\.)(t|telegram)\.me$/.test(u.hostname)) throw new Error(T.telegram);
  return { title: '', items: [{ urls: [u.href], source: u.href }] };
}

function lineStickerUrls(id, kind) {
  const base = `${LINE_CDN}/sticker/${id}/iPhone/`;
  const still = [base + 'sticker@2x.png', `${LINE_CDN}/sticker/${id}/android/sticker.png`];
  if (kind === 'static') return still;
  if (kind === 'popup') return [base + 'sticker_animation@2x.png', base + 'sticker_popup.png', ...still];
  return [base + 'sticker_animation@2x.png', ...still]; // animated or unknown: static ones 404 here
}

async function linePack(id) {
  const res = await fetch(`${LINE_CDN}/product/${id}/iphone/productInfo.meta`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`LINE pack ${id}: HTTP ${res.status}`);
  const meta = await res.json();
  const type = meta.stickerResourceType || '';
  const kind = /POPUP/.test(type) ? 'popup' : meta.hasAnimation || /ANIMATION/.test(type) ? 'anim' : 'static';
  const t = meta.title || {};
  const title = (TH && t.th) || t.en || t.th || Object.values(t)[0] || 'LINE ' + id;
  return {
    title,
    animated: kind !== 'static',
    items: (meta.stickers || []).map((s, i) => ({
      urls: lineStickerUrls(s.id, kind),
      thumb: `${LINE_CDN}/sticker/${s.id}/iPhone/sticker_key@2x.png`,
      name: `${title} ${i + 1}`,
      source: 'line:' + s.id,
    })),
  };
}

// ---------------------------------------------------------------- search
const PAGE = 36;

async function search(source, q, offset = 0) {
  q = String(q || '').trim();
  if (!q) return { items: [], more: false };
  if (source === 'line') return searchLine(q, offset);
  return searchGiphy(q);
}

// LINE Store's own search API (sticker packs).
async function searchLine(q, offset) {
  const url = `https://store.line.me/api/search/sticker?query=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE}&type=ALL&includeFacets=false`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`LINE search: HTTP ${res.status}`);
  const data = await res.json();
  const items = (data.items || [])
    .filter(it => it.type === 'STICKER' && it.id)
    .map(it => ({
      id: String(it.id),
      title: it.title || '',
      author: it.authorName || '',
      icon: (it.listIcon && it.listIcon.src) || `${LINE_CDN}/product/${it.id}/LINEStorePC/main.png`,
      animated: !!it.hasAnimation || /ANIMATION|POPUP/.test(it.stickerResourceType || ''),
    }));
  return { items, more: offset + PAGE < (data.totalCount || 0) && items.length > 0 };
}

// GIPHY's sticker search page carries its results in the HTML.
async function searchGiphy(q) {
  const slug = q.replace(/\s+/g, '-');
  const res = await fetch(`https://giphy.com/search/${encodeURIComponent(slug)}-stickers`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`GIPHY search: HTTP ${res.status}`);
  const text = (await res.text()).replace(/\\"/g, '"');
  const hits = [...text.matchAll(/"id":"([A-Za-z0-9]{8,40})"/g)];
  const seen = new Set();
  const items = [];
  for (let i = 0; i < hits.length; i++) {
    const id = hits[i][1];
    const at = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index : at + 4000;
    const win = text.slice(at, Math.min(end, at + 6000));
    if (seen.has(id) || !/"is_sticker":(true|1)\b/.test(win)) continue;
    seen.add(id);
    const title = (win.match(/"title":"([^"]{0,100})"/) || [])[1] || '';
    const base = `https://media.giphy.com/media/${id}/`;
    items.push({
      id,
      title: title.replace(/\s*Sticker(\s+by\s+.*)?$/i, '').trim() || 'GIPHY',
      thumb: base + '200w_d.webp',
      urls: [base + 'giphy.webp', base + 'giphy.gif'],
      source: 'giphy:' + id,
    });
  }
  return { items, more: false };
}

function giphyId(u) {
  let m = u.pathname.match(/\/media\/(?:v1\.[^/]+\/)?([A-Za-z0-9]+)\//);
  if (m) return m[1];
  if ((m = u.pathname.match(/^\/([A-Za-z0-9]+)\.(?:gif|webp)$/))) return m[1];
  if ((m = u.pathname.match(/^\/(?:stickers|gifs)\/(?:[^/]*-)?([A-Za-z0-9]{6,})\/?$/))) return m[1];
  return null;
}
function giphyName(u) {
  const m = u.pathname.match(/^\/(?:stickers|gifs)\/(.+)-[A-Za-z0-9]+\/?$/);
  return m ? decodeURIComponent(m[1]).replace(/-/g, ' ').slice(0, 60) : '';
}

// ---------------------------------------------------------------- fetching
async function fetchImage(urls, depth = 0) {
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (type === 'text/html' || type === 'application/xhtml+xml') {
        // A web page: use the image it advertises (og:image and friends).
        if (depth) throw new Error(T.noImage);
        const found = pageImage((await res.text()).slice(0, 2000000), res.url);
        if (!found) throw new Error(T.noImage);
        const img = await fetchImage([found.url], depth + 1);
        return { ...img, name: found.title || img.name };
      }
      const buf = await res.arrayBuffer();
      if (!buf.byteLength) throw new Error('empty file');
      if (buf.byteLength > MAX_BYTES) throw new Error(T.tooBig);
      const mime = type.startsWith('image/') ? type : sniff(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
      if (!mime) throw new Error(T.noImage);
      return { data: `data:${mime};base64,${base64(buf)}`, mime, name: nameFromUrl(res.url) };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(T.noImage);
}

function pageImage(html, base) {
  const tags = html.match(/<meta\s[^>]*>/gi) || [];
  const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return m ? (m[1] != null ? m[1] : m[2]) : null;
  };
  const pick = keys => {
    for (const k of keys) {
      for (const tag of tags) {
        const key = (attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop') || '').toLowerCase();
        const content = key === k && attr(tag, 'content');
        if (content && !/\.(mp4|webm|mov)(\?|$)/i.test(content)) return decodeEntities(content);
      }
    }
    return null;
  };
  const src = pick(['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src', 'contenturl']);
  if (!src) return null;
  try {
    return { url: new URL(src, base).href, title: (pick(['og:title', 'twitter:title']) || '').slice(0, 60) };
  } catch (_) {
    return null;
  }
}

function decodeEntities(s) {
  return s.replace(/&(amp|quot|#39|lt|gt);/g, (_, e) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' })[e]);
}

function sniff(b) {
  const s = String.fromCharCode(...b);
  if (s.startsWith('GIF8')) return 'image/gif';
  if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'image/webp';
  if (b[0] === 0x89 && s.slice(1, 4) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (s.slice(4, 12) === 'ftypavif') return 'image/avif';
  return '';
}

function nameFromUrl(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
    const name = last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    return /^(giphy|sticker(@2x)?|sticker animation@2x|image|img|\d+)$/i.test(name) ? 'Sticker' : name.slice(0, 60) || 'Sticker';
  } catch (_) {
    return 'Sticker';
  }
}

function base64(buf) {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------------------------------------------------------------- messages from bridge.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.fbcs !== 'bg') return;
  const run = {
    resolve: () => resolve(msg.url),
    fetch: () => fetchImage(msg.urls),
    takePending: () => takePending(),
    search: () => search(msg.source, msg.q, msg.offset),
    pack: () => linePack(msg.id),
  }[msg.op];
  if (!run) {
    sendResponse({ ok: false, error: 'unknown op ' + msg.op });
    return;
  }
  run().then(
    result => sendResponse({ ok: true, result }),
    err => sendResponse({ ok: false, error: String((err && err.message) || err) })
  );
  return true;
});
