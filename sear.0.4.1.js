/*
 * Sear.js v0.4
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

'use strict';
class Sear {
  constructor(options) {
    this._store = options.persist || false;
    if (typeof options.format === 'object')
      this._format = {
        number: options.format.version,
        handler: options.format.handler || function () {
          return {}
        }
      };
    this._raw = this.deepmerge(options.data, this.retrieve(options.persist));
    this._cache = this.clone(this._raw, ['function', undefined]);

    this.ObservableArray = class ObservableArray extends Array {
      constructor(args, path, parent) {
        super(...args);
        this.__proto__.path = path;
        this.__proto__.parent = parent;
      }
      _update(type, ...args) {
        const duplicate = Array.from(this),
          update = duplicate[type](...args);
        this.__proto__.parent.set(
          this.__proto__.parent._proxied,
          this.__proto__.path,
          duplicate
        );
        return update;
      }
      copyWithin(...args) {
        return this._update('copyWithin', ...args);
      }
      fill(...args) {
        return this._update('fill', ...args);
      }
      pop(...args) {
        return this._update('pop', ...args);
      }
      push(...args) {
        return this._update('push', ...args);
      }
      reverse(...args) {
        return this._update('reverse', ...args);
      }
      sort(...args) {
        return this._update('sort', ...args);
      }
      shift(...args) {
        return this._update('shift', ...args);
      }
      unshift(...args) {
        return this._update('unshift', ...args);
      }
      splice(...args) {
        return this._update('splice', ...args);
      }
    };
    this._dependency = {
      // current evaluation
      targets: [null],
      tracking: {}
    };
    this._proxied = new Proxy(this._raw, this.trapper());

    const loadcomputed = (obj, path = []) => {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          return loadcomputed(obj[key], [...path, key]);
        }
        if (typeof obj[key] === 'function')
          this.get(this._proxied, [...path, key]);
      });
    };
    loadcomputed(this._raw);

    this._signals = {};
    this._watchers = options.watch || {};
    for (let key in this._watchers)
      if (this._watchers.hasOwnProperty(key)) {
        if (typeof this._watchers[key] !== 'function')
          throw new Error(
            `[Sear] Watchers must be functions! Offender: <${key}>`
          );
        this.observe(key, this._watchers[key].bind(this._proxied));
        this.get(this._proxied, key);
      }

    this._elemIDs = [];
    this.booleanAttributes = [
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
    document.addEventListener('DOMContentLoaded', () => {
      this._frame = options.el || document.body;
      this.parseDOM();
    });

    return this._proxied;
  }

  deepmerge(...objs) {
    if (!objs.length) return {};
    const merged = {},
      process = (obj, path = []) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            return process(obj[key], [...path, key]);
          }
          this.set(merged, [...path, key], obj[key]);
        });
      };
    objs.forEach(obj => process(obj));
    return merged;
  }
  // from https://stackoverflow.com/questions/728360/how-do-i-correctly-clone-a-javascript-object
  clone(obj, intercept) {
    let copy;
    if (intercept && typeof obj === intercept[0]) return intercept[1];
    if (obj == null || typeof obj != 'object') return obj;
    if (obj instanceof Date) {
      copy = new Date();
      copy.setTime(obj.getTime());
      return copy;
    }
    if (Array.isArray(obj)) {
      copy = [];
      for (let i = 0; i < obj.length; i++)
        copy[i] = this.clone(obj[i], intercept);
      return copy;
    }
    if (obj.constructor === Object) {
      copy = {};
      for (let attr in obj)
        if (obj.hasOwnProperty(attr))
          copy[attr] = this.clone(obj[attr], intercept);
      return copy;
    }
    throw new Error(
      `[Sear] <${obj.constructor.name}> is an unsupported data type!\n
Supported data types are: (Basic) Objects, Functions, Arrays, Dates, Strings, Numbers, and Booleans.\n`
    );
  }
  // from https://gomakethings.com/check-if-two-arrays-or-objects-are-equal-with-javascript/
  isEqual(value, other) {
    const type = Object.prototype.toString.call(value);
    if (type !== Object.prototype.toString.call(other)) return false;
    if (['[object Array]', '[object Object]'].indexOf(type) < 0)
      return value == other;
    const lengthA =
        type === '[object Array]' ? value.length : Object.keys(value).length,
      lengthB =
        type === '[object Array]' ? other.length : Object.keys(other).length;
    if (lengthA !== lengthB) return false;
    function compare(itemA, itemB) {
      const type = Object.prototype.toString.call(itemA);
      if (['[object Array]', '[object Object]'].indexOf(type) >= 0) {
        if (!this.isEqual(itemA, itemB)) return false;
      } else {
        if (type !== Object.prototype.toString.call(itemB)) return false;
        if (type === '[object Function]') {
          if (itemA.toString() !== itemB.toString()) return false;
        } else if (itemA !== itemB) return false;
      }
      return true;
    }
    if (type === '[object Array]') {
      for (let i = 0; i < lengthA; i++)
        if (compare(value[i], other[i]) === false) return false;
    } else
      for (let key in value)
        if (value.hasOwnProperty(key))
          if (compare(value[key], other[key]) === false) return false;
    return true;
  }

  persist(ident, store) {
    if (!ident) return false;
    const data = this.clone(store),
      computed = {};
    const process = (obj, path = []) => {
      Object.keys(obj)
        .filter(key => typeof obj[key] === 'object')
        .forEach(key => {
          this.set(computed, [...path, key], {});
          process(obj[key], [...path, key]);
        });
      Object.keys(obj)
        .filter(key => typeof obj[key] === 'function')
        .forEach(key => {
          this.set(computed, [...path, key], obj[key].toString().trim());
          delete obj[key];
        });
    };
    process(data);
    const parsed = {
      data,
      computed
    };
    if ('_version' in this) parsed.version = this._version;
    return (localStorage[ident] = JSON.stringify(parsed));
  }
  retrieve(store) {
    if (!store) return {};
    try {
      store = JSON.parse(localStorage[store] || '{}');
      if (store && typeof store === 'object') {
        if ('version' in this && store.version !== this._version) return {};
        store.data = store.data || {};
        store.computed = store.computed || {};
        const process = (obj, path = []) => {
          Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'object')
              return process(obj[key], [...path, key]);
            try {
              return eval(
                `this.set(store.computed, [...path, key], (${
                  obj[key].startsWith('function') ? '' : 'function'
                } ${obj[key]})`
              );
            } catch (e) {
              return this.set(
                store.computed,
                [...path, key],
                new Function(
                  `return (${
                    obj[key].startsWith('function') ? '' : 'function'
                  } ${obj[key]})`
                )()
              );
            }
          });
        };
        process(store.computed);
        return this.deepmerge(store.data, store.computed);
      }
    } catch (e) {
      return {};
    }
  }

  observe(prop, handler) {
    if (!this._signals[prop]) this._signals[prop] = [];
    this._signals[prop].push(handler);
  }
  notify(signal) {
    this.persist(this._store, this._raw);
    signal = Array.isArray(signal) ? signal : signal.split('.');
    const id = signal.join('.'),
      raw = this.get(this._raw, id);
    while (signal.length) {
      let current = signal.join('.');
      if (this._signals[current])
        this._signals[current].forEach(handler => {
          const old = this.clone(this.get(this._cache, current));
          if (typeof old === 'function')
            this.set(this._cache, current, undefined);
          handler(old);
        });
      signal.pop();
    }
    if (typeof raw !== 'function') this.set(this._cache, id, this.clone(raw));
    return true;
  }

  trapper(path = []) {
    const parent = this;
    return {
      get(obj, prop) {
        if (!(prop in obj)) return undefined;
        const id = [...path, prop].join('.'),
          target =
            parent._dependency.targets[parent._dependency.targets.length - 1];
        if (typeof obj[prop] === 'function') {
          if (target && !parent._dependency.tracking[target].includes(id))
            parent._dependency.tracking[target].push(id);
          parent._dependency.targets.push(id);
          if (!parent.get(parent._cache, id)) {
            parent._dependency.tracking[id] = [];
            parent.set(
              parent._cache,
              id,
              parent.clone(obj[prop].call(parent._proxied))
            );
          }
          const value = parent.get(parent._cache, id);
          parent._dependency.targets.pop();
          return value;
        } else {
          if (target && !parent._dependency.tracking[target].includes(id))
            parent._dependency.tracking[target].push(id);

          if (Array.isArray(obj[prop]))
            return new parent.ObservableArray(
              obj[prop],
              [...path, prop],
              parent
            );
          if (typeof obj[prop] === 'object' && obj[prop] !== null)
            return new Proxy(obj[prop], parent.trapper([...path, prop]));
          return obj[prop];
        }
      },
      set(obj, prop, value) {
        if (parent.isEqual(obj[prop], value)) return true;
        const id = [...path, prop].join('.');
        obj[prop] = value;
        Object.keys(parent._dependency.tracking).forEach(key => {
          if (parent._dependency.tracking[key].includes(id)) parent.notify(key);
        });
        parent.notify([...path, prop]);
        return true;
      }
    };
  }
  arraytrapper(path = []) {
    const parent = this;
    return {
      get(obj, prop) {
        return obj[prop];
      },
      set(obj, prop, value) {
        if (parent.isEqual(obj[prop], value)) return true;
        obj[prop] = value;
        parent.notify([...path]);
        return true;
      }
    };
  }

  get(obj, key) {
    key = Array.isArray(key) ? key : key.split('.');
    while (key.length > 1) {
      obj = obj[key.shift()];
      if (!obj) return undefined;
    }
    return obj[key];
  }
  set(obj, key, val) {
    key = Array.isArray(key) ? key : key.split('.');
    while (key.length > 1) {
      const next = key.shift();
      if (!obj[next]) obj[next] = {};
      obj = obj[next];
    }
    obj[key.shift()] = val;
    return val;
  }

  eID(el) {
    let id;
    if (!el.attributes['_id']) {
      do {
        id = Math.random()
          .toString(36)
          .substr(2, 9);
      } while (this._elemIDs.includes(id));
      el.setAttribute('_id', id);
      this._elemIDs.push(id);
    } else id = el.attributes['_id'].value;
    return id;
  }
  parseDOM(node = this._frame) {
    if (node === document) node = node.body;
    const parent = this;

    // take out preserved elems during parsing
    const preserve = {};
    node.querySelectorAll('[\\:pre]').forEach(el => {
      const id = parent.eID(el);
      preserve[id] = el.outerHTML;
      el.outerHTML = `<span :pre _id="${id}"></span>`;
    });

    // moustache! (or mustache for you americans, i guess)
    node.innerHTML = node.innerHTML.replace(
      /{{([^{}]+)}}/g,
      '<span :text="$1"></span>'
    );

    node.querySelectorAll('[\\:text]').forEach(el => {
      const prop = el.attributes[':text'].value.trim();
      el.textContent = parent.get(parent._proxied, prop);
      if (!el.attributes[':unbound']) {
        parent.observe(
          prop,
          () => (el.textContent = parent.get(parent._proxied, prop))
        );
        // mutations.observe(element, config);
      }
    });
    node.querySelectorAll('[\\:html]').forEach(el => {
      const prop = el.attributes[':html'].value.trim();
      el.innerHTML = parent.get(parent._proxied, prop);
      parent.parseDOM(el);
      if (!el.attributes[':unbound']) {
        parent.observe(
          prop,
          () => (el.innerHTML = parent.get(parent._proxied, prop))
        );
        // mutations.observe(element, config);
      }
    });
    node.querySelectorAll('[\\:value]').forEach(el => {
      const prop = el.attributes[':value'].value.trim();
      let value = parent.get(parent._proxied, prop);
      if (
        el.attributes['type'] &&
        ['radio', 'checkbox'].includes(el.attributes['type'].value.trim())
      ) {
        el.checked = value ? value : false;
        if (!el.attributes[':unbound']) {
          parent.observe(prop, () => {
            value = parent.get(parent._proxied, prop);
            el.checked = value ? value : false;
          });
          el.onchange = event =>
            parent.set(parent._proxied, prop, event.target.checked);
        }
      } else {
        el.value = value;
        if (!el.attributes[':unbound']) {
          parent.observe(
            prop,
            () => (el.value = parent.get(parent._proxied, prop))
          );
          el.oninput = event =>
            parent.set(parent._proxied, prop, event.target.value);
        }
      }
    });

    // unnecessary? can be done via
    // :bind:style="condition,display:inline" style="display:none"
    node.querySelectorAll('[\\:if]').forEach(el => {
      const prop = el.attributes[':if'].value.trim(),
        id = parent.eID(el),
        html = el.outerHTML,
        unbound = el.attributes[':unbound'];
      function update() {
        el.outerHTML = parent.get(parent._proxied, prop)
          ? html
          : `<span _id="${id}"></span>`;
        el = node.querySelector(`[_id="${id}"]`);
      }
      update();
      if (!unbound) parent.observe(prop, update);
    });
    // :bind:style="condition,display:none" style="display:inline"
    node.querySelectorAll('[\\:else]').forEach(el => {
      const prop = el.attributes[':else'].value.trim(),
        id = parent.eID(el),
        html = el.outerHTML,
        unbound = el.attributes[':unbound'];
      function update() {
        el.outerHTML = parent.get(parent._proxied, prop)
          ? `<span _id="${id}"></span>`
          : html;
        el = node.querySelector(`[_id="${id}"]`);
      }
      update();
      if (!unbound) parent.observe(prop, update);
    });

    node.querySelectorAll('[\\:each]').forEach(el => {
      const prop = el.attributes[':each'].value.trim(),
        html = el.firstElementChild.cloneNode(true);
      function update() {
        const array = parent.get(parent._proxied, prop);
        if (!array) return;
        el.innerHTML = '';
        for (let i = 0; i < array.length; i++) {
          const child = html.cloneNode(true);
          child.innerHTML = child.innerHTML
            .replace(/\[\[:each:id]]/g, i + 1)
            .replace(/\[\[:each:value:html]]/g, array[i]);
          parent.parseDOM(child);
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
      if (!el.attributes[':unbound']) parent.observe(prop, update);
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
                  const val = parent.get(parent._proxied, prop[0]);
                  if (prop[1]) return val ? prop[1] : undefined;
                  return val;
                })
                .filter(prop => ![null, undefined].includes(prop))
                .join(' ');
              if (value) {
                if (parent.booleanAttributes.includes(name)) {
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
              props.forEach(prop => parent.observe(prop[0], update));
          });
      });

    // restore preserved elems
    node
      .querySelectorAll('[\\:pre]')
      .forEach(el => (el.outerHTML = preserve[parent.eID(el)]));
  }
}
