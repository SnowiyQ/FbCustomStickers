// Custom Stickers for Messenger: page-world script.
//
// How it works: in end-to-end encrypted chats, Messenger web sends a sticker as an
// encrypted StickerMessage whose media is a WebP file it uploads itself. The composer's
// sticker callback takes an image URL, fetches it, converts it to WebP (WebP passes
// through untouched, so animated WebP stays animated) and sends it. Passing a blob: URL
// of our own image makes Messenger send that image as a real sticker, which is the same
// thing the iPhone app does with iOS stickers.
(() => {
  'use strict';
  if (window.__fbcs) return;
  const S = (window.__fbcs = { cbBySend: new WeakMap(), buttonTypes: new WeakSet() });

  const HOOK_MODULE = 'useMWV2ComposerOnStickerSelect';
  const BUTTON_MODULES = new Set(['MWXComposerStickerButton.react', 'MWV2ComposerStickerButtonModern.react']);
  const STICKER_ID = '1'; // only used locally; custom (non-REGULAR) stickers carry no id
  const MAX_SIDE = 512;
  const OUTLINE = 12;
  const MAX_FRAMES = 150;
  const ANIM_BUDGET = 900 * 1024;

  // ---------------------------------------------------------------- module hook
  // Wrap the composer's sticker-select hook so each sticker button's callback can be
  // looked up by the onSendMessage prop it was built from.
  function wrapFactory(name, factory) {
    const wrapped = function () {
      const ret = factory.apply(this, arguments);
      try {
        const exp = arguments[6];
        const def = exp && exp.default;
        if (typeof def === 'function') {
          if (name === HOOK_MODULE) {
            const hook = function (onSendMessage) {
              const cb = def.apply(this, arguments);
              if (typeof onSendMessage === 'function' && typeof cb === 'function') S.cbBySend.set(onSendMessage, cb);
              return cb;
            };
            if (def.displayName) hook.displayName = def.displayName;
            exp.default = hook;
          } else {
            S.buttonTypes.add(def);
          }
        }
      } catch (err) {
        console.warn('[fbcs] module wrap failed', name, err);
      }
      return ret;
    };
    try {
      Object.defineProperty(wrapped, 'length', { value: factory.length });
    } catch (_) {}
    return wrapped;
  }

  (function hookDefine() {
    const makeProxy = fn =>
      new Proxy(fn, {
        apply(target, self, args) {
          const name = args[0];
          const factory = args[2];
          if (typeof factory === 'function' && (name === HOOK_MODULE || BUTTON_MODULES.has(name))) {
            args = Array.from(args);
            args[2] = wrapFactory(name, factory);
          }
          return Reflect.apply(target, self, args);
        },
      });
    let real = typeof window.__d === 'function' ? window.__d : undefined;
    let proxied = real ? makeProxy(real) : undefined;
    try {
      Object.defineProperty(window, '__d', {
        configurable: true,
        enumerable: true,
        get() {
          return proxied || real;
        },
        set(v) {
          real = v;
          proxied = typeof v === 'function' ? makeProxy(v) : undefined;
        },
      });
    } catch (err) {
      console.warn('[fbcs] could not hook __d', err);
    }
  })();

  // ---------------------------------------------------------------- strings
  const TH = /^th/i.test(document.documentElement.lang || navigator.language || '');
  const T = TH
    ? {
        button: 'สติกเกอร์ของฉัน',
        title: 'สติกเกอร์ของฉัน',
        add: 'เพิ่ม',
        trim: 'ตัดขอบว่าง',
        outline: 'ขอบขาว',
        emptyTitle: 'ยังไม่มีสติกเกอร์',
        emptyBody: 'ไปที่แท็บค้นหาเพื่อหาสติกเกอร์มีมจาก GIPHY และ LINE หรือกดเพิ่ม วางรูป (Ctrl+V) หรือคลิกขวาที่รูปบนเว็บไหนก็ได้ แล้วเลือก "เพิ่มในสติกเกอร์ Messenger ของฉัน" GIF และสติกเกอร์เคลื่อนไหวจะยังขยับได้',
        tabMine: 'ของฉัน',
        tabSearch: 'ค้นหา',
        commentHint: 'ในคอมเมนต์ สติกเกอร์ GIPHY และ LINE จะโพสต์เป็น GIF (มีกรอบ) ส่วนรูปของคุณเองจะเป็นรูปภาพพื้นหลังขาว',
        staged: 'กด Enter เพื่อโพสต์',
        unstage: 'เอาออก',
        mineSearch: 'ค้นหาในสติกเกอร์ของฉัน',
        all: 'ทั้งหมด',
        myUploads: 'รูปของฉัน',
        deletePack: 'ลบชุด',
        confirmDelete: 'ยืนยันลบ',
        noMatch: 'ไม่พบสติกเกอร์ที่ตรงกัน',
        searchPlaceholder: 'ค้นหาสติกเกอร์ เช่น มีม แมว ตลก',
        suggestions: ['มีม', 'แมว', 'ตลก', 'หมี', 'สวัสดี', 'ขอบคุณ', 'รัก', 'ฮา', 'โกรธ', 'ง่วง', 'หิว', 'โอเค'],
        searching: 'กำลังค้นหา…',
        noResults: 'ไม่พบสติกเกอร์',
        loadMore: 'โหลดเพิ่ม',
        saveAll: 'บันทึกทั้งชุด',
        saveOne: 'เก็บไว้ในสติกเกอร์ของฉัน',
        animated: 'เคลื่อนไหว',
        searchHint: 'คลิกเพื่อส่ง กด + เพื่อเก็บไว้',
        back: 'กลับ',
        resolving: 'กำลังเปิดลิงก์…',
        importing: (i, n) => `กำลังนำเข้า ${i}/${n}…`,
        badLink: 'ลิงก์ไม่ถูกต้อง',
        skipped: n => `มีอยู่แล้ว ${n} รูป`,
        notE2ee: 'แชทนี้ไม่ได้เข้ารหัสแบบต้นทางถึงปลายทาง Messenger รับสติกเกอร์ที่สร้างเองได้เฉพาะในแชทที่เข้ารหัสแบบต้นทางถึงปลายทาง',
        drop: 'วางรูปเพื่อเพิ่ม',
        processing: 'กำลังเตรียมรูป…',
        added: n => `เพิ่มแล้ว ${n} รูป`,
        failed: n => `อ่านรูปไม่ได้ ${n} รูป`,
        sending: 'กำลังส่ง…',
        noComposer: 'ไม่พบช่องพิมพ์ข้อความ ลองคลิกในแชทแล้วลองใหม่',
        reload: 'รีโหลดหน้าเว็บ (ส่วนขยายถูกอัปเดต)',
        del: 'ลบ',
        remove: 'ลบสติกเกอร์',
        send: name => `ส่ง ${name}`,
      }
    : {
        button: 'Custom stickers',
        title: 'My stickers',
        add: 'Add',
        trim: 'Trim edges',
        outline: 'White outline',
        emptyTitle: 'No stickers yet',
        emptyBody: 'Find meme stickers from GIPHY and LINE in the Search tab, click Add, paste an image, or right-click any image on the web and choose "Add to my Messenger stickers". GIFs and animated stickers stay animated.',
        tabMine: 'Mine',
        tabSearch: 'Search',
        commentHint: 'In comments, GIPHY and LINE stickers post as GIFs (with a frame). Your own images post as photos with a white background.',
        staged: 'Press Enter to post',
        unstage: 'Remove',
        mineSearch: 'Search my stickers',
        all: 'All',
        myUploads: 'My uploads',
        deletePack: 'Delete pack',
        confirmDelete: 'Confirm',
        noMatch: 'No matching stickers',
        searchPlaceholder: 'Search stickers, e.g. meme, cat, lol',
        suggestions: ['meme', 'cat', 'lol', 'ok', 'thanks', 'love', 'sad', 'wow', 'dance', 'bear', 'hello', 'angry'],
        searching: 'Searching…',
        noResults: 'No stickers found',
        loadMore: 'Load more',
        saveAll: 'Save pack',
        saveOne: 'Save to my stickers',
        animated: 'Animated',
        searchHint: 'Click to send · + to keep',
        back: 'Back',
        resolving: 'Opening link…',
        importing: (i, n) => `Importing ${i}/${n}…`,
        badLink: "That doesn't look like a link",
        skipped: n => `${n} already in your stickers`,
        notE2ee: "This chat isn't end-to-end encrypted. Messenger only takes custom stickers in end-to-end encrypted chats.",
        drop: 'Drop images to add',
        processing: 'Preparing images…',
        added: n => `Added ${n} sticker${n === 1 ? '' : 's'}`,
        failed: n => `Couldn't read ${n} image${n === 1 ? '' : 's'}`,
        sending: 'Sending…',
        noComposer: 'Chat box not found. Click into the chat and try again.',
        reload: 'Reload the page (the extension was updated)',
        del: 'Delete',
        remove: 'Remove sticker',
        send: name => `Send ${name}`,
      };

  // ---------------------------------------------------------------- storage (via bridge.js)
  let seq = 0;
  const pending = new Map();
  const NET_OPS = new Set(['resolve', 'fetch', 'takePending', 'search', 'pack']);
  window.addEventListener('message', event => {
    const msg = event.data;
    if (event.source !== window || !msg) return;
    if (msg.fbcs === 'event' && msg.type === 'pending') {
      if (document.visibilityState === 'visible') drainPending();
      return;
    }
    if (msg.fbcs !== 'res') return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error));
  });
  function store(op, ...args) {
    return new Promise((resolve, reject) => {
      const id = ++seq + ':' + Math.random().toString(36).slice(2);
      pending.set(id, { resolve, reject });
      window.postMessage({ fbcs: 'req', id, op, args }, location.origin);
      setTimeout(
        () => {
          if (pending.delete(id)) reject(new Error(T.reload));
        },
        NET_OPS.has(op) ? 90000 : 10000
      );
    });
  }

  // ---------------------------------------------------------------- React fibers
  function fiberOf(el) {
    for (const k of Object.keys(el)) if (k.startsWith('__reactFiber$')) return el[k];
    return null;
  }
  function isStickerButtonFiber(f) {
    const t = f.type;
    if (!t || typeof t === 'string') return false;
    if (S.buttonTypes.has(t)) return true;
    return /ComposerStickerButton/.test(t.displayName || '');
  }
  // A DOM node's fiber may be the previous render's copy; prefer the committed one.
  function currentFiber(f) {
    if (!f.alternate) return f;
    let top = f;
    while (top.return) top = top.return;
    return top.tag === 3 && top.stateNode && top.stateNode.current === top ? f : f.alternate;
  }
  function stickerFiberFor(el) {
    let f = fiberOf(el);
    for (let d = 0; f && d < 50; d++, f = f.return) {
      if (isStickerButtonFiber(f)) return currentFiber(f);
    }
    return null;
  }
  function hostNodeOf(f) {
    let c = f.child;
    while (c && typeof c.type !== 'string') c = c.child;
    return c ? c.stateNode : null;
  }
  // Comment boxes: Facebook's "comment with sticker" (or GIF) action carries the comment
  // composer's pluginProps (composerState, setComposerState, addAttachmentMapper, editor).
  function isCommentActionFiber(f) {
    const t = f.type;
    if (!t || typeof t === 'string') return false;
    if (!/CometUFIInsert(Sticker|GIF)ComposerAction/.test(t.displayName || '')) return false;
    const pp = f.memoizedProps && f.memoizedProps.pluginProps;
    return !!(pp && typeof pp.setComposerState === 'function');
  }
  function commentFiberFor(el) {
    let f = fiberOf(el);
    for (let d = 0; f && d < 30; d++, f = f.return) {
      if (isCommentActionFiber(f)) return currentFiber(f);
    }
    return null;
  }
  function composerInfo(entry) {
    if (entry.kind === 'comment') {
      const cf = entry.native.isConnected ? commentFiberFor(entry.native) : null;
      return cf ? { comment: cf.memoizedProps.pluginProps, fiber: cf, secure: true } : null;
    }
    const f = entry.native.isConnected ? stickerFiberFor(entry.native) : null;
    const p = (f && f.memoizedProps) || null;
    if (!p || typeof p.onSendMessage !== 'function') return null;
    let secure = p.useSecureSend;
    if (typeof secure !== 'boolean') secure = p.isSecureThread;
    if (typeof secure !== 'boolean') secure = location.pathname.includes('/e2ee/');
    return { props: p, secure };
  }

  // ---------------------------------------------------------------- DOM helpers
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  function svgIcon(size, paths) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('aria-hidden', 'true');
    for (const p of paths) {
      const el = document.createElementNS(NS, 'path');
      for (const [k, v] of Object.entries(p)) el.setAttribute(k, v);
      s.append(el);
    }
    return s;
  }
  // Sticker with a peeled corner and a sparkle cut out of it.
  const stickerIcon = size =>
    svgIcon(size, [
      {
        d: 'M6 3h12a3 3 0 0 1 3 3v7.5L13.5 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM11 6.5l1.25 2.75L15 10.5l-2.75 1.25L11 14.5l-1.25-2.75L7 10.5l2.75-1.25z',
        fill: 'currentColor',
        'fill-rule': 'evenodd',
      },
      { d: 'M21 15h-4a2.5 2.5 0 0 0-2.5 2.5V21z', fill: 'currentColor', opacity: '.5' },
    ]);
  const plusIcon = () => svgIcon(16, [{ d: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z', fill: 'currentColor' }]);

  // ---------------------------------------------------------------- composer buttons
  const seen = new WeakSet();
  const entries = [];

  function makeButton(host, native, kind) {
    const hostCs = getComputedStyle(host);
    const nb = native.getBoundingClientRect();
    const iconSize = kind === 'comment' ? 16 : 20;
    const btn = h(
      'div',
      {
        role: 'button',
        tabindex: '0',
        'aria-label': T.button,
        title: T.button,
        style: `width:${Math.round(nb.width) || 36}px;height:${Math.round(nb.height) || 36}px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .1s`,
      },
      stickerIcon(iconSize)
    );
    const wrap = h(
      'div',
      {
        'data-fbcs': '',
        style: `display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:${host.offsetWidth || 40}px;height:${host.offsetHeight || 36}px;margin:${hostCs.margin}`,
      },
      btn
    );
    btn.addEventListener('mouseenter', () => (btn.style.backgroundColor = 'var(--hover-overlay, rgba(0,0,0,.05))'));
    btn.addEventListener('mouseleave', () => (btn.style.backgroundColor = ''));
    return { wrap, btn };
  }

  function syncColor(entry) {
    const svg = entry.native.querySelector('svg');
    // Comment action icons are sprite images, so use Facebook's secondary icon colour there.
    const color = svg ? getComputedStyle(svg).color : entry.kind === 'comment' ? 'var(--secondary-icon, #65676b)' : '';
    if (color && entry.btn.style.color !== color) entry.btn.style.color = color;
  }

  function attachEntry(host, el, kind, key) {
    const { wrap, btn } = makeButton(host, el, kind);
    const entry = { host, native: el, wrap, btn, kind, key };
    btn.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePanel(entry);
    });
    btn.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        togglePanel(entry);
      }
    });
    host.after(wrap);
    entries.push(entry);
    syncColor(entry);
  }

  function scan() {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (!e.host.isConnected) {
        e.wrap.remove();
        entries.splice(i, 1);
        if (ui.entry === e) closePanel();
        continue;
      }
      if (!e.wrap.isConnected) e.host.after(e.wrap);
      syncColor(e);
    }
    for (const el of document.querySelectorAll('[role="button"][aria-label]')) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (el.closest('[data-fbcs]')) continue;
      const f = stickerFiberFor(el);
      if (f) {
        const host = hostNodeOf(f);
        // Only the button that opens the sticker flyout, not stickers inside the flyout.
        const first = host && (host.matches('[role="button"]') ? host : host.querySelector('[role="button"]'));
        if (!first || first !== el) continue;
        if (entries.some(e => e.host === host)) continue;
        attachEntry(host, el, 'chat', null);
        continue;
      }
      const cf = commentFiberFor(el);
      if (cf) {
        const host = hostNodeOf(cf);
        const first = host && (host.matches('[role="button"]') ? host : host.querySelector('[role="button"]'));
        if (!first || first !== el) continue;
        // One button per comment box: next to the sticker action, or the GIF action when a
        // box has no sticker action.
        const key = cf.memoizedProps.pluginProps.addAttachmentMapper || cf.memoizedProps.pluginProps.editor;
        const isSticker = /InsertSticker/.test(cf.type.displayName);
        const same = entries.find(e => e.kind === 'comment' && e.key === key);
        if (same) {
          if (!isSticker || same.isSticker) continue;
          same.wrap.remove(); // move next to the sticker action
          entries.splice(entries.indexOf(same), 1);
        }
        attachEntry(host, el, 'comment', key);
        entries[entries.length - 1].isSticker = isSticker;
      }
    }
  }

  let scanTimer = 0;
  let lastScan = 0;
  function scheduleScan() {
    if (scanTimer) return;
    const wait = Math.max(0, 600 - (performance.now() - lastScan));
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      lastScan = performance.now();
      try {
        scan();
      } catch (err) {
        console.warn('[fbcs] scan failed', err);
      }
    }, wait);
  }
  new MutationObserver(scheduleScan).observe(document, { childList: true, subtree: true });

  // ---------------------------------------------------------------- image processing
  async function sniff(file) {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const str = String.fromCharCode(...b);
    if (str.startsWith('GIF8')) return 'image/gif';
    if (str.startsWith('RIFF') && str.slice(8, 12) === 'WEBP') return 'image/webp';
    if (b[0] === 0x89 && str.slice(1, 4) === 'PNG') return 'image/png';
    if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
    if (str.slice(4, 12) === 'ftypavif') return 'image/avif';
    return '';
  }

  async function decode(file, type) {
    if (typeof ImageDecoder === 'function' && /^image\/(gif|webp|png|avif)$/.test(type)) {
      try {
        if (await ImageDecoder.isTypeSupported(type)) {
          const dec = new ImageDecoder({ data: await file.arrayBuffer(), type });
          try {
            await dec.tracks.ready;
            await dec.completed.catch(() => {});
            const track = dec.tracks.selectedTrack;
            const count = track ? track.frameCount : 1;
            if (track && track.animated && count > 1) {
              const step = Math.ceil(count / MAX_FRAMES);
              const frames = [];
              for (let i = 0; i < count; i += step) {
                const { image } = await dec.decode({ frameIndex: i });
                let ms = Math.round((image.duration || 0) / 1000);
                if (ms < 20) ms = 100; // browsers treat 0-10 ms GIF delays as 100 ms
                frames.push({ bmp: await createImageBitmap(image), ms: ms * step });
                image.close();
              }
              return { frames, animated: true };
            }
          } finally {
            dec.close();
          }
        }
      } catch (err) {
        console.warn('[fbcs] animated decode failed, using first frame', err);
      }
    }
    return { frames: [{ bmp: await createImageBitmap(file), ms: 0 }], animated: false };
  }

  function alphaBounds(bmp) {
    const w = bmp.width;
    const hgt = bmp.height;
    const c = new OffscreenCanvas(w, hgt);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, w, hgt).data;
    let minX = w;
    let minY = hgt;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < hgt; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (d[row + x * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          maxY = y;
        }
      }
    }
    return maxX < 0 ? null : { minX, minY, maxX, maxY };
  }

  function trimBox(frames) {
    const w = frames[0].bmp.width;
    const hgt = frames[0].bmp.height;
    const sample = frames.length <= 30 ? frames : frames.filter((_, i) => i % Math.ceil(frames.length / 30) === 0);
    let u = null;
    for (const f of sample) {
      const b = alphaBounds(f.bmp);
      if (!b) continue;
      u = u
        ? { minX: Math.min(u.minX, b.minX), minY: Math.min(u.minY, b.minY), maxX: Math.max(u.maxX, b.maxX), maxY: Math.max(u.maxY, b.maxY) }
        : b;
    }
    if (!u) return { x: 0, y: 0, w, h: hgt };
    const x = Math.max(0, u.minX - 1);
    const y = Math.max(0, u.minY - 1);
    return { x, y, w: Math.min(w, u.maxX + 2) - x, h: Math.min(hgt, u.maxY + 2) - y };
  }

  function renderFrame(bmp, box, scale, pad) {
    const w = Math.max(1, Math.round(box.w * scale));
    const hgt = Math.max(1, Math.round(box.h * scale));
    const inner = new OffscreenCanvas(w, hgt);
    const ic = inner.getContext('2d');
    ic.imageSmoothingQuality = 'high';
    ic.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, w, hgt);
    if (!pad) return inner;
    // iPhone-style white outline: stamp a white silhouette around the image.
    const sil = new OffscreenCanvas(w, hgt);
    const sc = sil.getContext('2d');
    sc.drawImage(inner, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = '#fff';
    sc.fillRect(0, 0, w, hgt);
    const out = new OffscreenCanvas(w + pad * 2, hgt + pad * 2);
    const oc = out.getContext('2d');
    for (const r of [pad, pad * 0.5]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        oc.drawImage(sil, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
    }
    oc.drawImage(inner, pad, pad);
    return out;
  }

  // Animated WebP container (RIFF: VP8X + ANIM + one ANMF per frame).
  function webpChunks(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const out = [];
    for (let p = 12; p + 8 <= u8.length; ) {
      const id = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
      const size = dv.getUint32(p + 4, true);
      out.push({ id, data: u8.subarray(p + 8, p + 8 + size) });
      p += 8 + size + (size & 1);
    }
    return out;
  }
  function riffChunk(id, data) {
    const pad = data.length & 1;
    const b = new Uint8Array(8 + data.length + pad);
    for (let i = 0; i < 4; i++) b[i] = id.charCodeAt(i);
    new DataView(b.buffer).setUint32(4, data.length, true);
    b.set(data, 8);
    return b;
  }
  function u24(b, o, v) {
    b[o] = v & 255;
    b[o + 1] = (v >> 8) & 255;
    b[o + 2] = (v >> 16) & 255;
  }
  function concat(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
  function muxAnimatedWebp(frames, w, hgt) {
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x12; // alpha + animation
    u24(vp8x, 4, w - 1);
    u24(vp8x, 7, hgt - 1);
    const anim = new Uint8Array(6); // transparent background, loop forever
    const parts = [riffChunk('VP8X', vp8x), riffChunk('ANIM', anim)];
    for (const f of frames) {
      const header = new Uint8Array(16);
      u24(header, 6, w - 1);
      u24(header, 9, hgt - 1);
      u24(header, 12, f.ms);
      header[15] = 0x02; // no blending: each full frame replaces the last
      const data = webpChunks(f.bytes)
        .filter(c => c.id === 'ALPH' || c.id === 'VP8 ' || c.id === 'VP8L')
        .map(c => riffChunk(c.id, c.data));
      parts.push(riffChunk('ANMF', concat([header, ...data])));
    }
    const body = concat(parts);
    const riff = new Uint8Array(12);
    riff.set([82, 73, 70, 70]);
    new DataView(riff.buffer).setUint32(4, body.length + 4, true);
    riff.set([87, 69, 66, 80], 8);
    return new Blob([riff, body], { type: 'image/webp' });
  }

  async function toWebp(canvas, quality) {
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP');
    return blob;
  }

  async function makeSticker(file, opts) {
    const type = file.type || (await sniff(file));
    const { frames, animated } = await decode(file, type);
    try {
      const full = { x: 0, y: 0, w: frames[0].bmp.width, h: frames[0].bmp.height };
      const box = opts.trim ? trimBox(frames) : full;
      const pad = opts.outline ? OUTLINE : 0;
      let blob;
      let w;
      let hgt;
      if (!animated) {
        const c = renderFrame(frames[0].bmp, box, Math.min(1, (MAX_SIDE - 2 * pad) / Math.max(box.w, box.h)), pad);
        blob = await toWebp(c, 0.92);
        w = c.width;
        hgt = c.height;
      } else {
        let side = MAX_SIDE;
        let quality = 0.8;
        for (let attempt = 0; attempt < 4; attempt++) {
          const scale = Math.min(1, (side - 2 * pad) / Math.max(box.w, box.h));
          const encoded = [];
          for (const f of frames) {
            const c = renderFrame(f.bmp, box, scale, pad);
            w = c.width;
            hgt = c.height;
            encoded.push({ bytes: new Uint8Array(await (await toWebp(c, quality)).arrayBuffer()), ms: f.ms });
          }
          blob = muxAnimatedWebp(encoded, w, hgt);
          if (blob.size <= ANIM_BUDGET) break;
          quality = Math.max(0.45, quality - 0.15);
          side = Math.round(side * 0.8);
        }
      }
      const name = (file.name || '').replace(/\.[^.]+$/, '').slice(0, 60) || 'Sticker';
      return { name, data: await blobToDataUrl(blob), w, h: hgt, animated, size: blob.size };
    } finally {
      for (const f of frames) f.bmp.close();
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function dataUrlToBlob(url) {
    const comma = url.indexOf(',');
    const mime = url.slice(5, url.indexOf(';'));
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // ---------------------------------------------------------------- sending
  async function sendSticker(entry, sticker) {
    const info = composerInfo(entry);
    if (!info) throw new Error(T.noComposer);
    if (!info.secure) throw new Error(T.notE2ee);
    const url = URL.createObjectURL(dataUrlToBlob(sticker.data));
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    const label = sticker.name || 'Sticker';
    const cb = S.cbBySend.get(info.props.onSendMessage);
    if (cb) {
      // Messenger's own sticker-select callback: (stickerId, {uri}, label, stickerType)
      await cb(STICKER_ID, { uri: url }, label, 'CUSTOM');
      return;
    }
    // Fallback when the hook wasn't wrapped (script injected late): same arguments the
    // hook builds for onSendMessage in a secure thread.
    const I64 = typeof window.require === 'function' ? window.require('I64') : null;
    const args = new Array(18).fill(undefined);
    args[2] = { stickerId: I64 ? I64.of_string(STICKER_ID) : STICKER_ID, stickerType: 'CUSTOM' };
    args[5] = url;
    args[15] = 'MWXComposerStickerButton';
    args[17] = label;
    await info.props.onSendMessage(...args);
  }

  // ---------------------------------------------------------------- comments
  // Facebook comments only take catalog stickers, but a GIF comment is just a link
  // ({link: {external: {url}}}) that Facebook fetches itself, so any public image URL works
  // (GIPHY, LINE's CDN). Images without a public URL go in as a photo instead.
  const LINE_STICKER = 'https://stickershop.line-scdn.net/stickershop/v1/sticker/';

  function commentUrlFor(x) {
    const src = String(x.source || '');
    let m;
    if ((m = src.match(/^giphy:(\w+)$/))) return `https://media.giphy.com/media/${m[1]}/giphy.gif`;
    if (x.urls && x.urls[0] && x.urls[0].startsWith(LINE_STICKER)) return x.urls[0];
    if ((m = src.match(/^line:(\d+)$/))) return `${LINE_STICKER}${m[1]}/iPhone/${x.animated ? 'sticker_animation@2x.png' : 'sticker@2x.png'}`;
    return null;
  }

  // The comment box's own GIF plugin maps GIF attachments when it is mounted; on many pages
  // it isn't, so register the same mapping for attachments we stage.
  const mappedComposers = new WeakSet();
  function gifPluginMounted(fiber) {
    let top = fiber;
    for (let i = 0; i < 10 && top.return; i++) top = top.return;
    const stack = [top];
    for (let n = 0; stack.length && n < 5000; n++) {
      const x = stack.pop();
      if (x.type && typeof x.type !== 'string' && /GIFComposerPluginInner/.test(x.type.displayName || '')) return true;
      if (x.child) stack.push(x.child);
      if (x.sibling && x !== top) stack.push(x.sibling);
    }
    return false;
  }
  function ensureGifMapper(info) {
    const add = info.comment.addAttachmentMapper;
    if (typeof add !== 'function' || mappedComposers.has(add)) return;
    mappedComposers.add(add);
    if (gifPluginMounted(info.fiber)) return;
    add(a => (a && a.__type === 'GIF' && a.data && a.data.fbcs && a.data.source ? { link: { external: { url: a.data.source.url } } } : null));
  }

  async function stagePhoto(entry, sticker) {
    let input = null;
    for (let el = entry.native; el && !input; el = el.parentElement) input = el.querySelector('input[type="file"][accept*="image"]');
    if (!input) throw new Error(T.noComposer);
    // Facebook doesn't take WebP everywhere; send a PNG.
    const bmp = await createImageBitmap(dataUrlToBlob(sticker.data));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const png = await c.convertToBlob({ type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(new File([png], (sticker.name || 'sticker').slice(0, 40) + '.png', { type: 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Puts the sticker in the comment box; the user presses Enter to post, like a picked GIF.
  async function commentSticker(entry, item) {
    const info = composerInfo(entry);
    if (!info) throw new Error(T.noComposer);
    const url = commentUrlFor(item);
    if (!url) {
      if (!item.data) throw new Error(T.noComposer);
      await stagePhoto(entry, item);
      return;
    }
    ensureGifMapper(info);
    try {
      if (typeof window.require === 'function') {
        window.require('cometAsyncFetch')('/ufi/comment/gif_preprocess/', { data: { gif_url: url }, method: 'POST' }).catch(() => {});
      }
    } catch (_) {}
    const w = item.w || 240;
    const hgt = item.h || 240;
    const label = item.name || 'Sticker';
    info.comment.setComposerState(s => ({
      ...s,
      attachment: {
        __type: 'GIF',
        data: {
          fbcs: true,
          cursor: '',
          resultID: String(item.source || url),
          media: { preview: { durationMs: 0, width: w, height: hgt, url, label } },
          source: { durationMs: 0, gifSource: url.includes('giphy.com') ? 'GIPHY' : 'EXTERNAL', width: w, height: hgt, mimeType: 'image/gif', tags: [], title: label, url },
        },
      },
    }));
    showStaged(entry, item.thumb || item.data || url);
    try {
      info.comment.editor && info.comment.editor.focus();
    } catch (_) {}
  }

  // Facebook's GIF preview often isn't mounted, so show our own until the comment posts.
  let stagedTimer = 0;
  function showStaged(entry, thumb) {
    if (!ui.staged) return;
    const r = entry.btn.getBoundingClientRect();
    ui.stagedImg.src = thumb;
    ui.staged.style.display = 'flex';
    ui.staged.style.left = Math.round(Math.min(Math.max(8, r.left - 80), innerWidth - 230)) + 'px';
    ui.staged.style.top = Math.round(Math.max(8, r.top - 74)) + 'px';
    ui.stagedEntry = entry;
    clearInterval(stagedTimer);
    stagedTimer = setInterval(() => {
      const info = entry.native.isConnected ? composerInfo(entry) : null;
      const a = info && info.comment.composerState && info.comment.composerState.attachment;
      if (!a || !a.data || !a.data.fbcs) hideStaged();
    }, 500);
  }
  function hideStaged() {
    clearInterval(stagedTimer);
    if (ui.staged) ui.staged.style.display = 'none';
    ui.stagedEntry = null;
  }
  function unstage() {
    const entry = ui.stagedEntry;
    const info = entry && entry.native.isConnected ? composerInfo(entry) : null;
    if (info) info.comment.setComposerState(s => ({ ...s, attachment: null }));
    hideStaged();
  }

  // ---------------------------------------------------------------- picker panel
  const CSS = `
:host { all: initial; }
[hidden] { display: none !important; }
.panel { position: fixed; z-index: 2147483000; width: 352px; height: min(540px, calc(100vh - 24px)); display: flex; flex-direction: column; box-sizing: border-box;
  background: var(--card-background, var(--surface-background, #fff)); color: var(--primary-text, #050505);
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 12px 28px rgba(0,0,0,.25), 0 2px 4px rgba(0,0,0,.12), inset 0 0 0 1px var(--media-inner-border, rgba(127,127,127,.12));
  font: 14px/1.34 "Segoe UI Historic", "Segoe UI", Helvetica, Arial, "Noto Sans Thai", sans-serif;
  opacity: 0; transform: translateY(6px) scale(.98); transform-origin: 50% 100%; transition: opacity .12s ease, transform .12s ease; }
.panel.open { opacity: 1; transform: none; }
.head { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px 12px; }
.tabs { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--comment-background, rgba(127,127,127,.14)); }
.tab { height: 28px; padding: 0 12px; border: 0; border-radius: 8px; cursor: pointer; background: transparent; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--secondary-text, #65676b); }
.tab[aria-selected="true"] { background: var(--card-background, #fff); color: var(--primary-text, #050505); box-shadow: 0 1px 2px rgba(0,0,0,.18); }
.spacer { flex: 1; }
.count { margin-left: 5px; font-weight: 400; opacity: .8; }
.view { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.add { display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 12px 0 8px; border: 0; border-radius: 6px; cursor: pointer;
  background: var(--secondary-button-background, rgba(127,127,127,.16)); color: inherit; font: inherit; font-weight: 600; }
.add:hover { background: var(--secondary-button-background-floating, rgba(127,127,127,.24)); }
.opts { display: flex; gap: 6px; padding: 0 12px 10px 16px; }
.chip { height: 26px; padding: 0 10px; border-radius: 13px; cursor: pointer; font: inherit; font-size: 12px;
  border: 1px solid var(--divider, rgba(127,127,127,.25)); background: transparent; color: var(--secondary-text, #65676b); }
.chip[aria-pressed="true"] { border-color: transparent; font-weight: 600; color: var(--fbcs-accent);
  background: color-mix(in srgb, var(--fbcs-accent) 18%, transparent); }
.srow { display: flex; gap: 6px; align-items: center; padding: 0 12px 10px 12px; }
.tray { display: flex; gap: 4px; padding: 0 10px 8px; overflow-x: auto; scrollbar-width: none; flex: 0 0 auto; }
.tray::-webkit-scrollbar { display: none; }
.tray button { flex: 0 0 auto; height: 40px; min-width: 40px; padding: 0 4px; border: 0; border-radius: 8px; cursor: pointer; background: transparent;
  color: var(--secondary-text, #65676b); font: inherit; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.tray button:hover { background: var(--hover-overlay, rgba(127,127,127,.12)); }
.tray button[aria-pressed="true"] { background: color-mix(in srgb, var(--fbcs-accent) 18%, transparent); color: var(--fbcs-accent); }
.tray img { width: 32px; height: 32px; object-fit: contain; pointer-events: none; }
.ghead { display: flex; align-items: center; gap: 6px; padding: 8px 6px 4px; font-size: 12px; font-weight: 700; color: var(--secondary-text, #65676b); }
.ghead:first-child { padding-top: 2px; }
.ghead .gt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ghead .gn { font-weight: 400; }
.gdel { height: 22px; padding: 0 8px; border: 0; border-radius: 11px; cursor: pointer; font: inherit; font-size: 11px; font-weight: 600;
  background: transparent; color: var(--secondary-text, #65676b); opacity: 0; transition: opacity .1s ease; }
.ghead:hover .gdel, .gdel:focus-visible, .gdel.armed { opacity: 1; }
.gdel:hover { background: var(--hover-overlay, rgba(127,127,127,.12)); }
.gdel.armed { background: #e41e3f; color: #fff; }
.q { flex: 1; min-width: 0; height: 32px; box-sizing: border-box; padding: 0 12px; border-radius: 16px; outline: none; font: inherit; font-size: 13px;
  border: 1px solid transparent; background: var(--comment-background, rgba(127,127,127,.14)); color: inherit; }
.q::placeholder { color: var(--secondary-text, #65676b); }
.q:focus { border-color: var(--fbcs-accent); }
.go { height: 30px; padding: 0 12px; border: 0; border-radius: 15px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; flex: 0 0 auto;
  background: var(--fbcs-accent); color: #fff; }
.go:hover { filter: brightness(1.08); }
.go:disabled { opacity: .5; cursor: default; }
.sugg { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 4px; }
.hint { padding: 2px 6px 8px; font-size: 12px; color: var(--secondary-text, #65676b); }
.loading { padding: 28px 12px; text-align: center; font-size: 13px; color: var(--secondary-text, #65676b); }
.packs { display: flex; flex-direction: column; gap: 2px; }
.pack { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; cursor: pointer; outline: none; }
.pack:hover, .pack:focus-visible { background: var(--hover-overlay, rgba(127,127,127,.12)); }
.pack img { width: 52px; height: 52px; flex: 0 0 auto; object-fit: contain; }
.pack .meta { min-width: 0; }
.pack .t { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pack .a { font-size: 12px; color: var(--secondary-text, #65676b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 8px; font-size: 11px; font-weight: 700; line-height: 17px; vertical-align: 1px;
  color: var(--fbcs-accent); background: color-mix(in srgb, var(--fbcs-accent) 16%, transparent); }
.phead { display: flex; align-items: center; gap: 8px; padding: 0 2px 8px; }
.back { width: 30px; height: 30px; flex: 0 0 auto; border: 0; border-radius: 50%; cursor: pointer; font: 700 16px/30px sans-serif; color: inherit;
  background: var(--hover-overlay, rgba(127,127,127,.12)); }
.ptitle { flex: 1; min-width: 0; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.more { display: block; margin: 10px auto 4px; height: 30px; padding: 0 14px; border: 0; border-radius: 15px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600;
  background: var(--secondary-button-background, rgba(127,127,127,.16)); color: inherit; }
.plus { position: absolute; top: 2px; right: 2px; width: 22px; height: 22px; border: 0; border-radius: 11px; cursor: pointer; padding: 0;
  background: rgba(0,0,0,.62); color: #fff; font: 700 15px/22px sans-serif; opacity: 0; transition: opacity .1s ease; }
.tile:hover .plus, .tile:focus-within .plus { opacity: 1; }
.plus.done { opacity: 1; background: #31a24c; }
.tile img.wait { opacity: 0; }
.notice { margin: 0 12px 10px; padding: 8px 10px; border-radius: 8px; font-size: 13px;
  background: color-mix(in srgb, #f3425f 16%, transparent); }
.notice.info { font-size: 12px; color: var(--secondary-text, #65676b); background: color-mix(in srgb, var(--fbcs-accent) 12%, transparent); }
.staged { position: fixed; z-index: 2147483000; display: none; align-items: center; gap: 8px; padding: 6px 8px 6px 6px; border-radius: 12px;
  background: var(--card-background, #fff); color: var(--primary-text, #050505); box-shadow: 0 8px 20px rgba(0,0,0,.25), inset 0 0 0 1px var(--media-inner-border, rgba(127,127,127,.15));
  font: 600 13px/1.3 "Segoe UI Historic", "Segoe UI", Helvetica, Arial, "Noto Sans Thai", sans-serif; }
.staged img { width: 56px; height: 56px; object-fit: contain; }
.staged button { height: 26px; padding: 0 10px; border: 0; border-radius: 13px; cursor: pointer; font: inherit; font-size: 12px;
  background: var(--secondary-button-background, rgba(127,127,127,.16)); color: inherit; }
.body { position: relative; flex: 1; min-height: 0; overflow-y: auto; padding: 6px 8px 8px; border-top: 1px solid var(--divider, rgba(127,127,127,.2));
  scrollbar-width: thin; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.tile { position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; outline: none; }
.tile:hover, .tile:focus-visible { background: var(--hover-overlay, rgba(127,127,127,.12)); }
.tile:focus-visible { box-shadow: inset 0 0 0 2px var(--fbcs-accent); }
.tile img { max-width: 72px; max-height: 72px; object-fit: contain; pointer-events: none; transition: transform .1s ease; }
.tile:active img { transform: scale(.9); }
.tile.busy { opacity: .45; pointer-events: none; }
.locked .tile { cursor: not-allowed; }
.locked .tile img { opacity: .45; }
.del { position: absolute; top: 2px; right: 2px; min-width: 20px; height: 20px; padding: 0 6px; border: 0; border-radius: 10px; cursor: pointer;
  background: rgba(0,0,0,.62); color: #fff; font: 600 12px/20px "Segoe UI", sans-serif; opacity: 0; transition: opacity .1s ease; }
.tile:hover .del, .tile:focus-within .del, .del.armed { opacity: 1; }
.del.armed { background: #e41e3f; }
.empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px 28px; box-sizing: border-box;
  text-align: center; font-size: 13px; color: var(--secondary-text, #65676b); }
.empty b { font-size: 15px; color: var(--primary-text, #050505); }
.empty svg { color: var(--fbcs-accent); margin-bottom: 4px; }
.status { min-height: 17px; padding: 7px 16px 9px; font-size: 12px; color: var(--secondary-text, #65676b); border-top: 1px solid var(--divider, rgba(127,127,127,.2)); }
.status.err { color: #f3425f; }
.drop { position: absolute; inset: 6px; display: none; align-items: center; justify-content: center; border-radius: 10px; pointer-events: none;
  border: 2px dashed var(--fbcs-accent); color: var(--fbcs-accent); font-weight: 700;
  background: color-mix(in srgb, var(--card-background, #fff) 88%, transparent); }
.panel.dragging .drop { display: flex; }
`;
  const THEME_VARS = [
    '--card-background',
    '--surface-background',
    '--primary-text',
    '--secondary-text',
    '--divider',
    '--hover-overlay',
    '--media-inner-border',
    '--secondary-button-background',
    '--secondary-button-background-floating',
    '--comment-background',
  ];
  const PANEL_W = 352;
  const PANEL_H = 540;

  const ui = {
    host: null,
    panel: null,
    entry: null,
    stickers: [],
    loaded: false,
    settings: { trim: true, outline: false },
    secure: true,
    statusTimer: 0,
    view: 'mine',
    mineQ: '',
    mineGroup: null, // pack key picked in the tray, null = all
    // search tab
    source: 'giphy',
    q: '',
    results: [],
    offset: 0,
    more: false,
    pack: null, // { title, animated, items } while a LINE pack is open
    searchSeq: 0,
    searching: false,
  };

  function buildPanel() {
    const host = h('div', {
      id: 'fbcs-panel-host',
      style: 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;display:none',
    });
    const root = host.attachShadow({ mode: 'open' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (_) {
      root.append(h('style', null, CSS));
    }
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/png,image/webp,image/gif,image/jpeg,image/avif',
      multiple: true,
      hidden: true,
      onchange: e => {
        importFiles([...e.target.files]);
        e.target.value = '';
      },
    });
    const chip = (label, key) => {
      const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!ui.settings[key]) }, label);
      b.addEventListener('click', () => {
        ui.settings[key] = !ui.settings[key];
        b.setAttribute('aria-pressed', String(ui.settings[key]));
        store('setSettings', ui.settings).catch(() => {});
      });
      b.dataset.key = key;
      return b;
    };
    const count = h('span', { class: 'count' });
    const grid = h('div', { class: 'groups' });
    const empty = h('div', { class: 'empty', hidden: true }, stickerIcon(40), h('b', null, T.emptyTitle), h('div', null, T.emptyBody));
    const notice = h('div', { class: 'notice', hidden: true }, T.notE2ee);
    const status = h('div', { class: 'status', 'aria-live': 'polite' });
    const body = h('div', { class: 'body' }, grid, empty);

    const tab = (label, view, extra) => {
      const b = h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': 'false' }, label, extra);
      b.addEventListener('click', () => setView(view));
      b.dataset.view = view;
      return b;
    };
    const addBtn = h('button', { class: 'add', type: 'button', onclick: () => fileInput.click() }, plusIcon(), T.add);

    // Search tab: GIPHY stickers or LINE Store packs.
    const qInput = h('input', { class: 'q', type: 'search', placeholder: T.searchPlaceholder, spellcheck: 'false', autocomplete: 'off', enterkeyhint: 'search' });
    let qTimer = 0;
    qInput.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => runSearch(qInput.value), 450);
    });
    qInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(qTimer);
        runSearch(qInput.value);
      }
    });
    const srcChip = (label, source) => {
      const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(ui.source === source) }, label);
      b.dataset.source = source;
      b.addEventListener('click', () => {
        if (ui.source === source) return;
        ui.source = source;
        for (const c of ui.panel.querySelectorAll('[data-source]')) c.setAttribute('aria-pressed', String(c.dataset.source === ui.source));
        runSearch(qInput.value, true);
      });
      return b;
    };
    const sbox = h('div', { class: 'body' });
    // Mine tab: filter the library by sticker or pack name, or jump to a pack from the tray.
    const mineQ = h('input', { class: 'q', type: 'search', placeholder: T.mineSearch, spellcheck: 'false', autocomplete: 'off' });
    mineQ.addEventListener('input', () => {
      ui.mineQ = mineQ.value;
      render();
    });
    const tray = h('div', { class: 'tray', role: 'toolbar' });
    const mineView = h(
      'div',
      { class: 'view' },
      h('div', { class: 'srow' }, mineQ, chip(T.trim, 'trim'), chip(T.outline, 'outline')),
      tray,
      body
    );
    const searchView = h(
      'div',
      { class: 'view', hidden: true },
      h('div', { class: 'srow' }, qInput, srcChip('GIPHY', 'giphy'), srcChip('LINE', 'line')),
      sbox
    );
    const panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-label': T.title },
      h(
        'div',
        { class: 'head' },
        h('div', { class: 'tabs', role: 'tablist' }, tab(T.tabMine, 'mine', count), tab(T.tabSearch, 'search')),
        h('div', { class: 'spacer' }),
        addBtn
      ),
      notice,
      mineView,
      searchView,
      status,
      fileInput,
      h('div', { class: 'drop' }, T.drop)
    );
    let dragDepth = 0;
    panel.addEventListener('dragenter', e => {
      if (!canDrop(e.dataTransfer)) return;
      e.preventDefault();
      dragDepth++;
      panel.classList.add('dragging');
    });
    panel.addEventListener('dragover', e => {
      if (canDrop(e.dataTransfer)) e.preventDefault();
    });
    panel.addEventListener('dragleave', () => {
      if (--dragDepth <= 0) {
        dragDepth = 0;
        panel.classList.remove('dragging');
      }
    });
    panel.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth = 0;
      panel.classList.remove('dragging');
      const files = [...e.dataTransfer.files];
      if (files.length) importFiles(files);
      else {
        const url = droppedUrl(e.dataTransfer);
        if (url) importLink(url);
      }
    });
    // Keep typing in the link box away from Facebook's keyboard shortcuts.
    for (const type of ['keydown', 'keypress', 'keyup']) {
      panel.addEventListener(type, e => {
        if (e.key !== 'Escape') e.stopPropagation();
      });
    }
    const stagedImg = h('img', { alt: '' });
    const staged = h('div', { class: 'staged', role: 'status' }, stagedImg, h('span', null, T.staged), h('button', { type: 'button', onclick: () => unstage() }, T.unstage));
    panel.style.display = 'none';
    root.append(panel, staged);
    host.style.display = 'block';
    (document.body || document.documentElement).append(host);
    Object.assign(ui, { staged, stagedImg });
    Object.assign(ui, { host, panel, grid, empty, notice, status, count, body, qInput, sbox, mineView, searchView, addBtn, mineQInput: mineQ, tray });
  }

  function setView(view) {
    ui.view = view;
    for (const b of ui.panel.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.view === view));
    ui.mineView.hidden = view !== 'mine';
    ui.searchView.hidden = view !== 'search';
    ui.addBtn.hidden = view !== 'mine';
    if (view === 'search') {
      if (!ui.q && !ui.results.length && !ui.pack) runSearch(T.suggestions[0]);
      else renderSearch();
      setTimeout(() => ui.qInput.focus(), 0);
    }
  }

  function canDrop(dt) {
    if (!dt) return false;
    const types = [...dt.types];
    return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html');
  }

  // An image dragged from another tab arrives as HTML (<img src>) and/or a URL list.
  function droppedUrl(dt) {
    const html = dt.getData('text/html');
    const m = html && html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (m) return m[1].replace(/&amp;/g, '&');
    const line = (dt.getData('text/uri-list') || '').split(/\r?\n/).find(l => l && !l.startsWith('#'));
    return line ? line.trim() : '';
  }

  function setStatus(text, isError) {
    if (!ui.status) return;
    clearTimeout(ui.statusTimer);
    ui.status.textContent = text || '';
    ui.status.classList.toggle('err', !!isError);
    if (text) ui.statusTimer = setTimeout(() => setStatus(''), isError ? 6000 : 3500);
  }

  // Library grouped by pack (own uploads, GIPHY, each LINE pack), most recent group first.
  function groupsOf(stickers) {
    const groups = new Map();
    for (const s of stickers) {
      const key = s.pack || (String(s.source || '').startsWith('giphy:') ? 'GIPHY' : '');
      if (!groups.has(key)) groups.set(key, { key, title: key || T.myUploads, items: [] });
      groups.get(key).items.push(s);
    }
    return [...groups.values()];
  }

  function render() {
    if (!ui.grid) return;
    const all = groupsOf(ui.stickers);
    if (ui.mineGroup != null && !all.some(g => g.key === ui.mineGroup)) ui.mineGroup = null;

    // Tray: "All" plus one icon per pack.
    const trayBtn = (key, label, kid) => {
      const b = h('button', { type: 'button', title: label, 'aria-label': label, 'aria-pressed': String(ui.mineGroup === key) }, kid);
      b.addEventListener('click', () => {
        ui.mineGroup = ui.mineGroup === key ? null : key;
        render();
        ui.body.scrollTop = 0;
      });
      return b;
    };
    ui.tray.replaceChildren(
      trayBtn(null, T.all, T.all),
      ...all.map(g => trayBtn(g.key, `${g.title} (${g.items.length})`, h('img', { src: g.items[0].data, alt: '', loading: 'lazy' })))
    );
    ui.tray.hidden = all.length < 2;

    const q = (ui.mineQ || '').trim().toLowerCase();
    let shown = ui.mineGroup == null ? all : all.filter(g => g.key === ui.mineGroup);
    if (q) {
      shown = shown
        .map(g => ({ ...g, items: g.title.toLowerCase().includes(q) ? g.items : g.items.filter(s => (s.name || '').toLowerCase().includes(q)) }))
        .filter(g => g.items.length);
    }
    const headers = all.length > 1 || (all[0] && all[0].key);
    const kids = [];
    for (const g of shown) {
      if (headers) kids.push(groupHead(g));
      kids.push(h('div', { class: 'grid' }, g.items.map(tile)));
    }
    if (!kids.length && ui.stickers.length) kids.push(h('div', { class: 'loading' }, T.noMatch));
    ui.grid.replaceChildren(...kids);
    ui.empty.hidden = ui.stickers.length > 0;
    ui.grid.hidden = ui.stickers.length === 0;
    ui.count.textContent = ui.stickers.length ? String(ui.stickers.length) : '';
    const commentMode = !!ui.entry && ui.entry.kind === 'comment';
    ui.notice.textContent = commentMode ? T.commentHint : T.notE2ee;
    ui.notice.classList.toggle('info', commentMode);
    ui.notice.hidden = !commentMode && ui.secure;
    ui.body.classList.toggle('locked', !ui.secure);
  }

  function groupHead(g) {
    const del = h('button', { class: 'gdel', type: 'button' }, T.deletePack);
    del.addEventListener('click', () => {
      if (!del.classList.contains('armed')) {
        del.classList.add('armed');
        del.textContent = T.confirmDelete;
        setTimeout(() => {
          del.classList.remove('armed');
          del.textContent = T.deletePack;
        }, 2500);
        return;
      }
      const ids = new Set(g.items.map(s => s.id));
      ui.stickers = ui.stickers.filter(s => !ids.has(s.id));
      render();
      store('removeMany', [...ids]).catch(err => setStatus(err.message, true));
    });
    return h('div', { class: 'ghead' }, h('span', { class: 'gt', title: g.title }, g.title), h('span', { class: 'gn' }, String(g.items.length)), del);
  }

  function tile(s) {
    const del = h('button', { class: 'del', type: 'button', title: T.remove, 'aria-label': T.remove }, '×');
    const t = h(
      'div',
      { class: 'tile', role: 'button', tabindex: '0', title: s.name, 'aria-label': T.send(s.name) },
      h('img', { src: s.data, alt: '', draggable: 'false', loading: 'lazy' }),
      del
    );
    t.addEventListener('click', e => {
      if (!e.target.closest('.del')) send(s, t);
    });
    t.addEventListener('keydown', e => {
      if (e.target === t && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        send(s, t);
      }
    });
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (!del.classList.contains('armed')) {
        del.classList.add('armed');
        del.textContent = T.del;
        setTimeout(() => {
          del.classList.remove('armed');
          del.textContent = '×';
        }, 2500);
        return;
      }
      ui.stickers = ui.stickers.filter(x => x.id !== s.id);
      render();
      store('remove', s.id).catch(err => setStatus(err.message, true));
    });
    return t;
  }

  async function send(s, t) {
    if (!ui.secure) {
      setStatus(T.notE2ee, true);
      return;
    }
    t.classList.add('busy');
    setStatus(T.sending);
    try {
      if (ui.entry.kind === 'comment') await commentSticker(ui.entry, s);
      else await sendSticker(ui.entry, s);
      ui.stickers = [s, ...ui.stickers.filter(x => x.id !== s.id)];
      store('touch', s.id).catch(() => {});
      closePanel();
    } catch (err) {
      console.warn('[fbcs] send failed', err);
      setStatus(err.message || String(err), true);
    } finally {
      t.classList.remove('busy');
    }
  }

  async function ensureLoaded() {
    if (ui.loaded) return;
    const [stickers, settings] = await Promise.all([store('list'), store('getSettings')]);
    ui.stickers = stickers;
    ui.settings = settings;
    ui.loaded = true;
  }

  // items: [{ get: () => Promise<File>, name?, source?, pack? }]. Each becomes a sticker;
  // ones already in the library (same source) are skipped.
  let importing = Promise.resolve();
  function addImages(items) {
    importing = importing.then(() => addImagesNow(items)).catch(err => setStatus(err.message, true));
    return importing;
  }
  async function addImagesNow(items) {
    await ensureLoaded();
    let added = 0;
    let failed = 0;
    let skipped = 0;
    // The library lists newest first, so add a pack backwards to keep its order.
    for (let i = items.length - 1, n = 1; i >= 0; i--, n++) {
      const it = items[i];
      if (it.source && ui.stickers.some(s => s.source === it.source)) {
        skipped++;
        continue;
      }
      setStatus(items.length > 1 ? T.importing(n, items.length) : T.processing);
      try {
        const sticker = it.sticker ? { ...it.sticker } : await makeSticker(await it.get(), ui.settings);
        if (it.name) sticker.name = it.name;
        if (it.source) sticker.source = it.source;
        if (it.pack) sticker.pack = it.pack;
        ui.stickers.unshift(await store('add', sticker));
        added++;
        render();
      } catch (err) {
        console.warn('[fbcs] import failed', it.name || it.source, err);
        if (err.message === T.reload) {
          setStatus(T.reload, true);
          return;
        }
        failed++;
        if (items.length === 1) {
          setStatus(err.message || T.failed(1), true);
          return;
        }
      }
    }
    const parts = [];
    if (added) parts.push(T.added(added));
    if (skipped) parts.push(T.skipped(skipped));
    if (failed) parts.push(T.failed(failed));
    setStatus(parts.join(' · '), failed > 0 && !added);
  }

  function importFiles(files) {
    const images = files.filter(f => !f.type || f.type.startsWith('image/'));
    if (images.length) return addImages(images.map(f => ({ get: async () => f })));
  }

  function fileFrom(img, name) {
    const blob = dataUrlToBlob(img.data);
    return new File([blob], name || img.name || 'Sticker', { type: img.mime || blob.type });
  }

  async function importLink(raw) {
    let url;
    try {
      url = new URL(raw.trim());
      if (!/^(https?|data):$/.test(url.protocol)) throw new Error();
    } catch (_) {
      setStatus(T.badLink, true);
      return;
    }
    if (url.protocol === 'data:') return addImages([{ get: async () => fileFrom({ data: url.href }) }]);
    setStatus(T.resolving);
    let res;
    try {
      res = await store('resolve', url.href);
    } catch (err) {
      setStatus(err.message, true);
      return;
    }
    return addImages(
      res.items.map(it => ({
        name: it.name,
        source: it.source,
        pack: res.title,
        get: async () => {
          const img = await store('fetch', it.urls);
          return fileFrom(img, it.name || img.name);
        },
      }))
    );
  }

  // Images picked with the right-click menu on other sites wait in the background queue.
  let draining = false;
  async function drainPending() {
    if (draining) return;
    draining = true;
    try {
      const items = await store('takePending');
      if (items.length) {
        await addImages(
          items.map(it => ({ name: it.name, source: it.source, pack: it.pack, get: async () => fileFrom(it, it.name) }))
        );
      }
    } catch (err) {
      console.warn('[fbcs] pending import failed', err);
    } finally {
      draining = false;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') drainPending();
  });

  // ---------------------------------------------------------------- search tab
  async function runSearch(raw, force) {
    const q = String(raw || '').trim();
    if (ui.qInput.value.trim() !== q) ui.qInput.value = q;
    if (!force && q === ui.q && !ui.pack) return renderSearch();
    ui.q = q;
    ui.pack = null;
    ui.results = [];
    ui.offset = 0;
    ui.more = false;
    if (!q) return renderSearch();
    await fetchResults();
  }

  async function fetchResults() {
    const seq = ++ui.searchSeq;
    ui.searching = true;
    renderSearch();
    try {
      const res = await store('search', ui.source, ui.q, ui.offset);
      if (seq !== ui.searchSeq) return;
      ui.results = ui.results.concat(res.items);
      ui.more = res.more;
      ui.offset += res.items.length;
    } catch (err) {
      if (seq === ui.searchSeq) setStatus(err.message, true);
    } finally {
      if (seq === ui.searchSeq) {
        ui.searching = false;
        renderSearch();
      }
    }
  }

  async function openPack(p) {
    const seq = ++ui.searchSeq;
    ui.pack = { title: p.title, animated: p.animated, items: null };
    renderSearch();
    try {
      const pack = await store('pack', p.id);
      if (seq !== ui.searchSeq) return;
      ui.pack = pack;
    } catch (err) {
      if (seq !== ui.searchSeq) return;
      ui.pack = null;
      setStatus(err.message, true);
    }
    renderSearch();
  }

  function renderSearch() {
    if (!ui.sbox || ui.view !== 'search') return;
    const box = ui.sbox;
    const thumbs = [];
    const kids = [];
    if (ui.pack) {
      const pack = ui.pack;
      const saveAll = h('button', { class: 'go', type: 'button', disabled: !pack.items }, T.saveAll);
      saveAll.addEventListener('click', () => {
        saveAll.disabled = true;
        saveRemote(pack.items, pack.title).then(() => renderSearch());
      });
      const back = h('button', { class: 'back', type: 'button', title: T.back, 'aria-label': T.back }, '‹');
      back.addEventListener('click', () => {
        ++ui.searchSeq;
        ui.pack = null;
        renderSearch();
      });
      kids.push(h('div', { class: 'phead' }, back, h('div', { class: 'ptitle', title: pack.title }, pack.title), saveAll));
      if (!pack.items) kids.push(h('div', { class: 'loading' }, T.searching));
      else kids.push(h('div', { class: 'grid' }, pack.items.map(it => remoteTile({ ...it, pack: pack.title }, thumbs))));
    } else if (!ui.q) {
      kids.push(h('div', { class: 'sugg' }, T.suggestions.map(s => h('button', { class: 'chip', type: 'button', onclick: () => runSearch(s) }, s))));
    } else if (ui.source === 'line') {
      kids.push(
        h(
          'div',
          { class: 'packs' },
          ui.results.map(p => {
            const img = h('img', { alt: '', class: 'wait' });
            thumbs.push([img, p.icon]);
            const row = h(
              'div',
              { class: 'pack', role: 'button', tabindex: '0', title: p.title },
              img,
              h('div', { class: 'meta' }, h('div', { class: 't' }, p.title, p.animated ? h('span', { class: 'badge' }, T.animated) : null), h('div', { class: 'a' }, p.author))
            );
            row.addEventListener('click', () => openPack(p));
            row.addEventListener('keydown', e => {
              if (e.key === 'Enter') openPack(p);
            });
            return row;
          })
        )
      );
    } else {
      if (ui.results.length) kids.push(h('div', { class: 'hint' }, T.searchHint));
      kids.push(h('div', { class: 'grid' }, ui.results.map(it => remoteTile({ ...it, name: it.title, direct: true }, thumbs))));
    }
    if (!ui.pack && ui.q) {
      if (ui.searching) kids.push(h('div', { class: 'loading' }, T.searching));
      else if (!ui.results.length) kids.push(h('div', { class: 'loading' }, T.noResults));
      else if (ui.more) kids.push(h('button', { class: 'more', type: 'button', onclick: () => fetchResults() }, T.loadMore));
    }
    box.replaceChildren(...kids);
    ui.body.classList.toggle('locked', !ui.secure);
    box.classList.toggle('locked', !ui.secure);
    for (const [img, url, direct] of thumbs) loadThumb(img, url, direct);
  }

  // A search result tile: click sends it, + keeps it in My stickers.
  function remoteTile(it, thumbs) {
    const img = h('img', { alt: '', draggable: 'false', class: 'wait' });
    thumbs.push([img, it.thumb, it.direct]);
    const saved = ui.stickers.some(s => s.source === it.source);
    const plus = h('button', { class: 'plus' + (saved ? ' done' : ''), type: 'button', title: T.saveOne, 'aria-label': T.saveOne }, saved ? '✓' : '+');
    const t = h('div', { class: 'tile', role: 'button', tabindex: '0', title: it.name || '', 'aria-label': T.send(it.name || 'sticker') }, img, plus);
    t.addEventListener('click', e => {
      if (!e.target.closest('.plus')) sendRemote(it, t);
    });
    t.addEventListener('keydown', e => {
      if (e.target === t && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        sendRemote(it, t);
      }
    });
    plus.addEventListener('click', async e => {
      e.stopPropagation();
      if (plus.classList.contains('done')) return;
      plus.textContent = '…';
      await saveRemote([it], it.pack);
      const ok = ui.stickers.some(s => s.source === it.source);
      plus.classList.toggle('done', ok);
      plus.textContent = ok ? '✓' : '+';
    });
    return t;
  }

  // GIPHY thumbnails load straight from its CDN (Facebook allows it); others come
  // through the background worker because Facebook's CSP blocks their hosts.
  const thumbCache = new Map();
  const thumbQueue = [];
  let thumbActive = 0;
  function loadThumb(img, url, direct) {
    if (!url) return;
    const show = src => {
      img.src = src;
      img.classList.remove('wait');
    };
    if (direct) return show(url);
    if (thumbCache.has(url) && typeof thumbCache.get(url) === 'string') return show(thumbCache.get(url));
    thumbQueue.push({ img, url, show });
    pumpThumbs();
  }
  function pumpThumbs() {
    while (thumbActive < 6 && thumbQueue.length) {
      const job = thumbQueue.shift();
      if (!job.img.isConnected) continue;
      thumbActive++;
      const p = thumbCache.get(job.url) || store('fetch', [job.url]).then(img => URL.createObjectURL(dataUrlToBlob(img.data)));
      thumbCache.set(job.url, p);
      p.then(
        src => {
          thumbCache.set(job.url, src);
          job.show(src);
        },
        () => thumbCache.delete(job.url)
      ).finally(() => {
        thumbActive--;
        pumpThumbs();
      });
    }
  }

  // Search results become stickers on demand; keep the result so a re-send is instant.
  const remoteCache = new Map();
  async function remoteSticker(it) {
    const have = remoteCache.get(it.source) || ui.stickers.find(s => s.source === it.source);
    if (have) return have;
    const img = await store('fetch', it.urls);
    const sticker = await makeSticker(fileFrom(img, it.name), { trim: true, outline: false });
    sticker.name = it.name || sticker.name;
    sticker.source = it.source;
    if (it.pack) sticker.pack = it.pack;
    remoteCache.set(it.source, sticker);
    return sticker;
  }

  async function sendRemote(it, t) {
    if (!ui.secure) {
      setStatus(T.notE2ee, true);
      return;
    }
    t.classList.add('busy');
    setStatus(T.sending);
    try {
      if (ui.entry.kind === 'comment') await commentSticker(ui.entry, it);
      else await sendSticker(ui.entry, await remoteSticker(it));
      closePanel();
    } catch (err) {
      console.warn('[fbcs] send failed', err);
      setStatus(err.message || String(err), true);
    } finally {
      t.classList.remove('busy');
    }
  }

  function saveRemote(items, pack) {
    return addImages(
      items.map(it => ({
        name: it.name,
        source: it.source,
        pack: pack || it.pack,
        get: async () => fileFrom(await store('fetch', it.urls), it.name),
        sticker: remoteCache.get(it.source),
      }))
    );
  }

  function applyTheme(entry) {
    const cs = getComputedStyle(entry.native);
    for (const v of THEME_VARS) {
      const val = cs.getPropertyValue(v).trim();
      if (val) ui.host.style.setProperty(v, val);
      else ui.host.style.removeProperty(v);
    }
    const svg = entry.native.querySelector('svg');
    ui.host.style.setProperty('--fbcs-accent', (svg && getComputedStyle(svg).color) || '#0866ff');
  }

  function place() {
    if (!ui.entry) return;
    const r = ui.entry.btn.getBoundingClientRect();
    const W = PANEL_W;
    const H = ui.panel.offsetHeight || PANEL_H;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), innerWidth - W - 8);
    let top = r.top - H - 10;
    if (top < 8) top = Math.min(innerHeight - H - 8, r.bottom + 10);
    ui.panel.style.left = Math.round(left) + 'px';
    ui.panel.style.top = Math.round(Math.max(8, top)) + 'px';
    ui.panel.style.transformOrigin = top < r.top ? '50% 100%' : '50% 0';
  }

  async function openPanel(entry) {
    if (!ui.host) buildPanel();
    ui.entry = entry;
    const info = composerInfo(entry);
    ui.secure = !info || info.secure;
    applyTheme(entry);
    render();
    hideStaged();
    ui.panel.style.display = 'flex';
    place();
    requestAnimationFrame(() => ui.panel.classList.add('open'));
    setStatus('');
    try {
      ui.loaded = false; // another tab may have changed the library
      await ensureLoaded();
      if (ui.entry !== entry) return;
      for (const c of ui.panel.querySelectorAll('[data-key]')) c.setAttribute('aria-pressed', String(!!ui.settings[c.dataset.key]));
      render();
      // Nothing saved yet: start on Search so there is something to send right away.
      setView(ui.view === 'mine' && !ui.stickers.length ? 'search' : ui.view);
      drainPending();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function closePanel() {
    if (!ui.entry) return;
    ui.entry = null;
    ui.panel.classList.remove('open');
    ui.panel.style.display = 'none';
  }

  function togglePanel(entry) {
    if (ui.entry === entry) closePanel();
    else openPanel(entry);
  }

  document.addEventListener(
    'pointerdown',
    e => {
      if (!ui.entry) return;
      const path = e.composedPath();
      if (path.includes(ui.host) || path.includes(ui.entry.wrap)) return;
      closePanel();
    },
    true
  );
  document.addEventListener(
    'keydown',
    e => {
      if (ui.entry && e.key === 'Escape') {
        e.stopPropagation();
        closePanel();
      }
    },
    true
  );
  // While the panel is open, a pasted image or sticker link goes straight into the library
  // (except when pasting into the link box itself).
  document.addEventListener(
    'paste',
    e => {
      if (!ui.entry || !e.clipboardData) return;
      const target = e.composedPath()[0];
      if (target === ui.qInput || target === ui.mineQInput) return;
      const files = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'));
      const text = (e.clipboardData.getData('text/plain') || '').trim();
      if (files.length) {
        e.preventDefault();
        e.stopPropagation();
        importFiles(files);
      } else if (/^https?:\/\/\S+$/.test(text)) {
        e.preventDefault();
        e.stopPropagation();
        importLink(text);
      }
    },
    true
  );
  addEventListener('resize', place);
})();
