// Custom Stickers for Messenger: storage bridge (isolated world).
// page.js runs in the page world and has no chrome.* access, so it asks this script
// over window.postMessage to read and write the sticker library in chrome.storage.local.
(() => {
  'use strict';
  const INDEX = 'fbcs:index';
  const SETTINGS = 'fbcs:settings';
  const key = id => 'fbcs:s:' + id;
  const local = chrome.storage.local;

  async function ids() {
    return (await local.get(INDEX))[INDEX] || [];
  }

  const ops = {
    async list() {
      const order = await ids();
      if (!order.length) return [];
      const got = await local.get(order.map(key));
      return order.map(id => got[key(id)]).filter(Boolean);
    },
    async add(sticker) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const saved = { ...sticker, id, added: Date.now() };
      const order = await ids();
      await local.set({ [key(id)]: saved, [INDEX]: [id, ...order] });
      return saved;
    },
    async remove(id) {
      const order = await ids();
      await local.set({ [INDEX]: order.filter(x => x !== id) });
      await local.remove(key(id));
      return true;
    },
    async removeMany(list) {
      const drop = new Set(list);
      const order = await ids();
      await local.set({ [INDEX]: order.filter(x => !drop.has(x)) });
      await local.remove(list.map(key));
      return true;
    },
    // Most recently sent first, like the iPhone sticker drawer.
    async touch(id) {
      const order = await ids();
      if (!order.includes(id)) return false;
      await local.set({ [INDEX]: [id, ...order.filter(x => x !== id)] });
      return true;
    },
    async getSettings() {
      return { trim: true, outline: false, ...((await local.get(SETTINGS))[SETTINGS] || {}) };
    },
    async setSettings(settings) {
      await local.set({ [SETTINGS]: settings });
      return settings;
    },
  };

  // Network work and the pending queue live in the background worker.
  function background(op, extra) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ fbcs: 'bg', op, ...extra }, res => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else if (!res) reject(new Error('no answer from background'));
        else if (res.ok) resolve(res.result);
        else reject(new Error(res.error));
      });
    });
  }
  const netOps = {
    resolve: url => background('resolve', { url }),
    fetch: urls => background('fetch', { urls }),
    takePending: () => background('takePending'),
    search: (source, q, offset) => background('search', { source, q, offset }),
    pack: id => background('pack', { id }),
  };

  // One storage op at a time so index read-modify-write never races.
  let chain = Promise.resolve();

  window.addEventListener('message', event => {
    const msg = event.data;
    if (event.source !== window || !msg || msg.fbcs !== 'req') return;
    const reply = body => window.postMessage({ fbcs: 'res', id: msg.id, ...body }, location.origin);
    const run = async table => {
      try {
        reply({ ok: true, result: await table[msg.op](...(msg.args || [])) });
      } catch (err) {
        reply({ ok: false, error: String((err && err.message) || err) });
      }
    };
    if (Object.prototype.hasOwnProperty.call(netOps, msg.op)) run(netOps);
    else if (Object.prototype.hasOwnProperty.call(ops, msg.op)) chain = chain.then(() => run(ops));
    else reply({ ok: false, error: 'unknown op ' + msg.op });
  });

  // Tell the page when images picked on other sites are waiting.
  chrome.storage.onChanged.addListener((changes, area) => {
    const c = changes['fbcs:pending'];
    if (area === 'local' && c && (c.newValue || []).length) window.postMessage({ fbcs: 'event', type: 'pending' }, location.origin);
  });
})();
