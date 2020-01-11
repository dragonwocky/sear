/*
 * Sear.js v0.3
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

function Sear(options) {
  'use strict';
  // data
  const raw = { ...options.data, ...retrieve(options.persist) },
    cache = {};
  clone(cache, raw);
  function clone(to, from) {
    Object.keys(from).forEach(key => {
      if (Array.isArray(from[key])) {
        to[key] = [];
        return clone(to[key], from[key]);
      }
      if (typeof from[key] === 'object') {
        to[key] = {};
        return clone(to[key], from[key]);
      }
      if (typeof from[key] === 'function') return (to[key] = undefined);
      to[key] = from[key];
    });
    return true;
  }
  const proxied = new Proxy(raw, validator()),
    dependency = {
      // current evaluation
      target: null,
      tracking: {}
    },
    signals = {},
    watchers = options.watch || {};
  function persist() {
    const data = {};
    clone(data, raw);
    const computed = {};
    Object.keys(raw)
      .filter(key => typeof data[key] === 'function')
      .forEach(key => {
        computed[key] = data[key].toString().trim();
        delete data[key];
      });
    localStorage[options.persist] = JSON.stringify({
      data,
      computed
    });
  }
  function retrieve(store) {
    try {
      store = JSON.parse(localStorage[store] || '{}');
      if (store && typeof store === 'object') {
        store.data = store.data || {};
        store.computed = store.computed || {};
        Object.keys(store.computed).forEach(key => {
          try {
            eval(
              `store.computed[key] = (${
                store.computed[key].startsWith('function') ? '' : 'function'
              } ${store.computed[key]})`
            );
          } catch (e) {
            store.computed[key] = new Function(
              `return (${
                store.computed[key].startsWith('function') ? '' : 'function'
              } ${store.computed[key]})`
            )();
          }
        });
        return { ...store.data, ...store.computed };
      }
    } catch (e) {
      return {};
    }
  }
  // potential issue: highly strict type checking.
  // e.g. if saved number 3 as "3" - will remove
  // also, "new" properties will be filtered out
  // * have decided to temporarily disable
  // function cleanStore(store, original) {
  //   if (!original || typeof original !== 'object') return store;
  //   if (!store || typeof store !== 'object') return original;
  //   store = { ...original, ...store };
  //   Object.keys(store).forEach(key => {
  //     if (
  //       !Object.keys(original).includes(key) ||
  //       typeof store[key] !== typeof original[key] ||
  //       typeof original[key] === 'function'
  //     )
  //       delete store[key];
  //   });
  //   store = { ...original, ...store };
  //   return store;
  // }
  function arrayHandler(path = []) {
    return {
      get(obj, prop) {
        return obj[prop];
      },
      set(obj, prop, value) {
        obj[prop] = value;
        notify([...path]);
        return true;
      }
    };
  }
  function validator(path = []) {
    return {
      get(obj, prop) {
        if (!(prop in obj)) return undefined;
        const id = [...path, prop].join('.');

        if (typeof obj[prop] === 'function') {
          if (!dependency.target) dependency.target = id;
          observe(id, () => set(cache, id, ''));
          if (!get(cache, id)) {
            set(cache, id, obj[prop].call(proxied));
          }
          const value = get(cache, id);
          dependency.target = null;
          return value;
        } else {
          if (dependency.target) {
            if (!dependency.tracking[dependency.target])
              dependency.tracking[dependency.target] = [];
            if (!dependency.tracking[dependency.target].includes(id))
              dependency.tracking[dependency.target].push(id);
          }

          if (Array.isArray(obj[prop]))
            return new Proxy(obj[prop], arrayHandler([...path, prop]));
          if (typeof obj[prop] === 'object' && obj[prop] !== null)
            return new Proxy(obj[prop], validator([...path, prop]));
          return obj[prop];
        }
      },
      set(obj, prop, value) {
        const id = [...path, prop].join('.');
        obj[prop] = value;
        Object.keys(dependency.tracking).forEach(key => {
          if (dependency.tracking[key].includes(id)) notify(key);
        });

        notify([...path, prop]);
        return true;
      }
    };
  }
  function get(obj, key) {
    key = Array.isArray(key) ? key : key.split('.');
    while (key.length > 1) {
      obj = obj[key.shift()];
      if (!obj) return undefined;
    }
    return obj[key];
  }
  function set(obj, key, val) {
    key = Array.isArray(key) ? key : key.split('.');
    while (key.length > 1) {
      obj = obj[key.shift()];
      if (!obj) return undefined;
    }
    obj[key.shift()] = val;
    return val;
  }

  // watchers
  for (let key in watchers) {
    if (watchers.hasOwnProperty(key)) {
      observe(key, watchers[key].bind(proxied));
      get(proxied, key);
    }
  }
  function observe(property, handler) {
    if (!signals[property]) signals[property] = [];
    signals[property].push(handler);
  }
  function notify(signal) {
    if (options.persist) persist();
    signal = Array.isArray(signal) ? signal : signal.split('.');
    const id = signal.join('.');
    while (signal.length > 0) {
      let current = signal.join('.');
      if (!signals[current] || signals[current].length < 1) return;
      signals[current].forEach(signalHandler =>
        signalHandler({ old: get(cache, current), new: get(raw, current) })
      );
      signal.pop();
    }
    if (typeof get(raw, id) !== 'function') set(cache, id, get(proxied, id));
  }

  // html
  const frame = options.el || document,
    elemIDs = [],
    booleanAttributes = [
      'async',
      'autofocus',
      'autoplay',
      'checked',
      'contenteditable',
      'controls',
      'default',
      'defer',
      'disabled',
      'formnovalidate',
      'frameborder',
      'hidden',
      'ismap',
      'itemscope',
      'loop',
      'multiple',
      'muted',
      'nomodule',
      'novalidate',
      'open',
      'readonly',
      'required',
      'reversed',
      'scoped',
      'selected',
      'typemustmatch'
    ];
  function eID(el) {
    let id;
    if (!el.attributes['_id']) {
      do {
        id = Math.random()
          .toString(36)
          .substr(2, 9);
      } while (elemIDs.includes(id));
      el.setAttribute('_id', id);
      elemIDs.push(id);
    } else id = el.attributes['_id'].value;
    return id;
  }
  function parseDOM(node = frame) {
    if (node === document) node = node.body;

    // take out preserved elems during parsing
    const preserve = {};
    node.querySelectorAll('[\\:pre]').forEach(el => {
      const id = eID(el);
      preserve[id] = el.outerHTML;
      el.outerHTML = `<span :pre _id="${id}"></span>`;
    });

    // 2-way syncing for :text + :html (can get buggy with contentEditable
    // ....but then again doesn't everything?)
    // function onMutate(records) {
    //   records.forEach(mutation => {
    //     if (mutation.type !== 'characterData') return;
    //     let element = mutation.target;
    //     const attr =
    //       element.attributes && element.attributes[':html'] ? ':html' : ':text';
    //     while (!element.attributes || !element.attributes[attr]) {
    //       if (!element.parentElement) return;
    //       element = element.parentElement;
    //     }
    //     const property = element.attributes[attr].value,
    //       value = mutation.target.innerHTML || mutation.target.data;
    //     if (get(proxied, property) !== value) set(proxied, property, value);
    //   });
    // }
    // const config = {
    //     characterData: true,
    //     characterDataOldValue: true,
    //     childList: true,
    //     subtree: true
    //   },
    //   mutations = new MutationObserver(onMutate);

    // moustache! (or mustache for you americans, i guess)
    node.innerHTML = node.innerHTML.replace(
      /{{([^{}]+)}}/g,
      '<span :text="$1"></span>'
    );

    node.querySelectorAll('[\\:text]').forEach(el => {
      const prop = el.attributes[':text'].value.trim();
      el.textContent = get(proxied, prop);
      if (!el.attributes[':unbound']) {
        observe(prop, () => (el.textContent = get(proxied, prop)));
        // mutations.observe(element, config);
      }
    });
    node.querySelectorAll('[\\:html]').forEach(el => {
      const prop = el.attributes[':html'].value.trim();
      el.innerHTML = get(proxied, prop);
      parseDOM(el);
      if (!el.attributes[':unbound']) {
        observe(prop, () => (el.innerHTML = get(proxied, prop)));
        // mutations.observe(element, config);
      }
    });
    node.querySelectorAll('[\\:value]').forEach(el => {
      const prop = el.attributes[':value'].value.trim();
      let value = get(proxied, prop);
      if (
        el.attributes['type'] &&
        ['radio', 'checkbox'].includes(el.attributes['type'].value.trim())
      ) {
        el.checked = value ? value : false;
        if (!el.attributes[':unbound']) {
          observe(prop, () => {
            value = get(proxied, prop);
            el.checked = value ? value : false;
          });
          el.onchange = event => set(proxied, prop, event.target.checked);
        }
      } else {
        el.value = value;
        if (!el.attributes[':unbound']) {
          observe(prop, () => (el.value = get(proxied, prop)));
          el.oninput = event => set(proxied, prop, event.target.value);
        }
      }
    });

    // unnecessary? can be done via
    // :bind:style="condition,display:inline" style="display:none"
    node.querySelectorAll('[\\:if]').forEach(el => {
      const prop = el.attributes[':if'].value.trim(),
        id = eID(el),
        html = el.outerHTML,
        unbound = el.attributes[':unbound'];
      function update() {
        el.outerHTML = get(proxied, prop) ? html : `<span _id="${id}"></span>`;
        el = node.querySelector(`[_id="${id}"]`);
      }
      update();
      if (!unbound) observe(prop, update);
    });
    // :bind:style="condition,display:none" style="display:inline"
    node.querySelectorAll('[\\:else]').forEach(el => {
      const prop = el.attributes[':else'].value.trim(),
        id = eID(el),
        html = el.outerHTML,
        unbound = el.attributes[':unbound'];
      function update() {
        el.outerHTML = get(proxied, prop) ? `<span _id="${id}"></span>` : html;
        el = node.querySelector(`[_id="${id}"]`);
      }
      update();
      if (!unbound) observe(prop, update);
    });

    node.querySelectorAll('[\\:each]').forEach(el => {
      const prop = el.attributes[':each'].value.trim(),
        html = el.firstElementChild.cloneNode(true);
      function update() {
        const array = get(proxied, prop);
        if (!array) return;
        el.innerHTML = '';
        for (let i = 0; i < array.length; i++) {
          const child = html.cloneNode(true);
          child.innerHTML = child.innerHTML
            .replace(/\[\[:each:id]]/g, i + 1)
            .replace(/\[\[:each:value:html]]/g, array[i]);
          parseDOM(child);
          child.innerHTML = child.innerHTML.replace(
            /\[\[:each:value]]/g,
            '<span :each:value></span>'
          );
          child
            .querySelectorAll('[\\:each\\:value]')
            .forEach(elem => (elem.textContent = array[i]));
          el.appendChild(child);
        }
      }
      update();
      if (!el.attributes[':unbound']) observe(prop, update);
    });

    // :bind:attr
    Array.from(node.getElementsByTagName('*'))
      .filter(el => {
        const attr = Array.from(el.attributes);
        for (let j = 0; j < attr.length; j++)
          if (/^:bind:.+/.test(attr[j].name)) return true;
        return false;
      })
      .forEach(el => {
        const html = {};
        Array.from(el.attributes)
          .filter(attr => /^:bind:.+/.test(attr.name))
          .forEach(attr => {
            const name = attr.name.slice(6),
              props = attr.value
                .trim()
                .split(' ')
                .map(prop => prop.split(','));
            if (el.attributes[name]) html[name] = el.attributes[name].value;
            function update() {
              let value = props
                .map(prop => {
                  const val = get(proxied, prop[0]);
                  if (prop[1]) return val ? prop[1] : undefined;
                  return val;
                })
                .filter(prop => ![null, undefined].includes(prop))
                .join(' ');
              if (value) {
                if (booleanAttributes.includes(name)) {
                  if (['false', false].includes(value))
                    return el.removeAttribute(name);
                  return el.setAttribute(name, true);
                }
                return el.setAttribute(name, value);
              }
              if (![null, undefined].includes(html[name]))
                return el.setAttribute(name, html[name]);
              el.removeAttribute(name);
            }
            update();
            if (!el.attributes[':unbound'])
              props.forEach(prop => observe(prop[0], update));
          });
      });

    // restore preserved elems
    node
      .querySelectorAll('[\\:pre]')
      .forEach(el => (el.outerHTML = preserve[eID(el)]));
  }
  parseDOM(frame);

  return proxied;
  // return { data: proxied, observe, notify };
}
