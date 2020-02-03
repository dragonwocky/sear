/*
 * Sear.js v0.5.3
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

'use strict';
class Sear {
  constructor(options) {
    this._format = {};
    if (options.format.version) {
      this._format = {
        'version': options.format.version,
        handler:
          options.format['handler'] ||
          function() {
            return {};
          }
      };
    }
    if (options.format.name) this._format.name = options.format.name;
    this._raw = this.deepmerge(options.data, {
      'client': this.retrieve(this._format.name)
    });
    this._cache = this.clone(this._raw, [['function', () => undefined]]);

    this.ObservableArray = class ObservableArray extends Array {
      constructor(args, path, parent) {
        super(...args);
        this.__proto__.path = path;
        this.__proto__.parent = parent;
        for (let method of [
          'copyWithin',
          'fill',
          'pop',
          'push',
          'reverse',
          'sort',
          'shift',
          'unshift',
          'splice'
        ])
          this[method] = (...args) => this._update(method, ...args);
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
    };
    this._dependency = {
      // current evaluation
      targets: [null],
      tracking: {}
    };
    this._proxied = new Proxy(this._raw, this.trapper());

    const loadcomputed = (obj, path = []) => {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key]))
          return loadcomputed(obj[key], [...path, key]);
        if (typeof obj[key] === 'function') this.get(this._proxied, [...path, key]);
      });
    };
    loadcomputed(this._raw);

    this._signals = {};
    this._watchers = options.watch || {};
    for (let key in this._watchers) {
      if (typeof this._watchers[key] != 'function')
        throw new Error(`[Sear] Watchers must be functions! Offender: <<${key}>>`);
      this.observe(key, this._watchers[key].bind(this._proxied));
      this.get(this._proxied, key);
    }

    this._elemIDs = [];
    this._preserve = {};
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
      if ('el' in options) {
        if (
          typeof options['el'] === 'string' &&
          options.el.startsWith('#') &&
          !options.el.includes(' ')
        ) {
          this._frame = document.getElementById(options.el.slice(1));
          if (!this._frame)
            throw new Error(`[Sear] Element <<${options.el}>> does not exist!`);
        }
        if (!this._frame)
          throw new Error(
            `[Sear] Element <<${options.el}>> is invalid!
Element must be passed as a single ID in a string (e.g. '#app').`
          );
      } else this._frame = document.body;
      this.parseDOM();
    });

    return this._proxied;
  }

  compare(itemA, itemB) {
    if (typeof itemA != typeof itemB || Array.isArray(itemA) != Array.isArray(itemB))
      return false;
    if (typeof itemA === 'object') {
      if (Array.isArray(itemA)) {
        if (itemA.length !== itemB.length) return false;
        for (let i = 0; i < itemA.length; i++)
          if (!this.compare(itemA[i], itemB[i])) return false;
      } else {
        if (Object.keys(itemA).length !== Object.keys(itemB).length) return false;
        for (let key in itemA) if (!this.compare(itemA[key], itemB[key])) return false;
      }
    } else {
      if (typeof itemA === 'function') {
        if (itemA.toString() !== itemB.toString()) return false;
      } else if (itemA !== itemB) return false;
    }
    return true;
  }
  deepmerge(...objs) {
    if (!objs.length) return {};
    const merged = {},
      process = (obj, path = []) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && !Array.isArray(obj[key]))
            return process(obj[key], [...path, key]);
          this.set(merged, [...path, key], obj[key]);
        });
      };
    objs.forEach(obj => process(this.clone(obj)));
    return merged;
  }
  // modified from https://stackoverflow.com/questions/728360/how-do-i-correctly-clone-a-javascript-object
  clone(obj, intercept) {
    let copy;
    if (typeof intercept === 'object')
      for (let [type, callback] of intercept)
        if (typeof obj === type) return callback(obj);
    if (obj === null || typeof obj != 'object') return obj;
    if (obj instanceof Date) return new Date(new Date().setTime(obj.getTime()));
    if (Array.isArray(obj)) {
      copy = [];
      for (let i = 0; i < obj.length; i++) copy[i] = this.clone(obj[i], intercept);
      return copy;
    }
    if (obj.constructor === Object) {
      copy = {};
      for (let attr in obj) copy[attr] = this.clone(obj[attr], intercept);
      return copy;
    }
    throw new Error(
      `[Sear] <<${obj.constructor.name}>> is an unsupported data type!\n
Supported data types are: (Basic) Objects, Functions, Arrays, Dates, Strings, Numbers, and Booleans.\n`
    );
  }

  persist(ident, store) {
    if (!ident) return false;
    const parsed = {
        'data': this.clone(store).client,
        'computed': {}
      },
      process = (obj, path = []) => {
        Object.keys(obj)
          .filter(key => typeof obj[key] === 'object')
          .forEach(key => {
            this.set(parsed.computed, [...path, key], {});
            process(obj[key], [...path, key]);
          });
        Object.keys(obj)
          .filter(key => typeof obj[key] === 'function')
          .forEach(key => {
            this.set(parsed.computed, [...path, key], obj[key]);
            delete obj[key];
          });
      };
    process(parsed.data);
    if ('version' in this._format) parsed.version = this._format.version;
    return (localStorage[ident] = JSON.stringify(parsed));
  }
  retrieve(store) {
    if (!store) return {};
    try {
      store = JSON.parse(localStorage[store] || '{}');
      if (store && typeof store === 'object') {
        store['data'] = store.data || {};
        store['computed'] = store.computed || {};
        const process = (obj, path = []) => {
          Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'object') return process(obj[key], [...path, key]);
            /* eval is faster, but not necessary
              try {
                return eval(
                  `this.set(store.computed, [...path, key], (${
                    obj[key].startsWith('function') ? '' : 'function'
                  } ${obj[key]})`
                );
              } catch (e) {}
            */
            return this.set(
              store.computed,
              [...path, key],
              new Function(
                `return (${obj[key].startsWith('function') ? '' : 'function'} ${
                  obj[key]
                })`
              )()
            );
          });
        };
        process(store.computed);
        const parsed = this.deepmerge(store.data, store.computed);
        return store.version !== this._format.version
          ? this._format.handler(parsed)
          : parsed;
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
    this.persist(this._format.name, this._raw);
    signal = Array.isArray(signal) ? signal : signal.split('.');
    const id = signal.join('.'),
      raw = this.get(this._raw, id);
    while (signal.length) {
      let current = signal.join('.');
      if (this._signals[current])
        this._signals[current].forEach(handler => {
          if (typeof this.get(this._raw, current) === 'function')
            this.set(this._cache, current, undefined);
          handler(this.clone(this.get(this._cache, current)));
        });
      signal.pop();
    }
    if (typeof raw !== 'function') this.set(this._cache, id, this.clone(raw));
    return true;
  }

  trapper(path = []) {
    const $ = this;
    return {
      get(obj, prop) {
        if (!(prop in obj)) return undefined;
        const id = [...path, prop].join('.'),
          target = $._dependency.targets[$._dependency.targets.length - 1],
          tracking = $._dependency.tracking[target];
        if (typeof obj[prop] === 'function') {
          if (target && !tracking.includes(id)) tracking.push(id);
          $._dependency.targets.push(id);
          if (!$.get($._cache, id)) {
            $._dependency.tracking[id] = [];
            $.set($._cache, id, $.clone(obj[prop].call($._proxied)));
          }
          $._dependency.targets.pop();
          return $.get($._cache, id);
        } else {
          if (target && !tracking.includes(id)) tracking.push(id);
          if (Array.isArray(obj[prop]))
            return new $.ObservableArray(obj[prop], [...path, prop], $);
          if (typeof obj[prop] === 'object' && obj[prop] !== null)
            return new Proxy(obj[prop], $.trapper([...path, prop]));
          return obj[prop];
        }
      },
      set(obj, prop, value) {
        if ($.compare(obj[prop], value)) return true;
        obj[prop] = value;
        Object.keys($._dependency.tracking).forEach(key => {
          if ($._dependency.tracking[key].includes([...path, prop].join('.')))
            $.notify(key);
        });
        $.notify([...path, prop]);
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
  reactive(container, el) {
    if (!container || !el) return undefined;
    return {
      id: this.eID(el),
      node() {
        return container.querySelector(`[_id="${this.id}"]`);
      }
    };
  }
  parseDOM(node = this._frame) {
    if (node === document) node = node.body;

    // take out preserved elems during parsing
    node.querySelectorAll('[\\:pre]').forEach(el => {
      const id = this.eID(el);
      if (this._preserve[id]) return;
      this._preserve[id] = el.outerHTML;
      el.outerHTML = `<span :pre _id="${id}"></span>`;
    });

    // moustache!
    node.innerHTML = node.innerHTML.replace(/{{([^{}]+)}}/g, '<span :text="$1"></span>');
    node.querySelectorAll('[\\:text]').forEach(el => {
      el = this.reactive(node, el);
      const prop = el.node().attributes[':text'].value.trim(),
        update = () => {
          if (!el.node()) return;
          el.node().textContent = this.get(this._proxied, prop);
        };
      if (!el.node().attributes[':unbound']) this.observe(prop, update);
      update();
    });
    node.querySelectorAll('[\\:html]').forEach(el => {
      el = this.reactive(node, el);
      const prop = el.node().attributes[':html'].value.trim(),
        update = () => {
          if (!el.node()) return;
          el.node().innerHTML = this.get(this._proxied, prop);
          this.parseDOM(el.node());
        };
      if (!el.node().attributes[':unbound']) this.observe(prop, update);
      update();
    });
    node.querySelectorAll('[\\:value]').forEach(el => {
      el = this.reactive(node, el);
      const prop = el.node().attributes[':value'].value.trim(),
        update = () => {
          if (!el.node()) return;
          if (['radio', 'checkbox'].includes(el.node().type)) {
            el.node().checked = this.get(this._proxied, prop) == true;
            el.node().onchange = event =>
              this.set(this._proxied, prop, event.target.checked);
          } else {
            el.node().value = this.get(this._proxied, prop);
            el.node().oninput = event =>
              this.set(this._proxied, prop, event.target.value);
          }
        };
      if (!el.node().attributes[':unbound']) this.observe(prop, update);
      update();
    });

    node.querySelectorAll('[\\:each]').forEach(el => {
      el = this.reactive(node, el);
      const prop = el.node().attributes[':each'].value.trim(),
        content = el.node().firstElementChild.cloneNode(true),
        update = () => {
          if (!el.node()) return;
          el.node().innerHTML = '';
          const array = this.get(this._proxied, prop);
          if (!Array.isArray(array)) return;
          for (let i = 0; i < array.length; i++) {
            const child = content.cloneNode(true);
            child.innerHTML = child.innerHTML
              .replace(/\[\[:each:id]]/g, i + 1)
              .replace(/\[\[:each:value:html]]/g, array[i]);
            this.parseDOM(child);
            child.innerHTML = child.innerHTML.replace(
              /\[\[:each:value]]/g,
              '<span :each:value></span>'
            );
            child
              .querySelectorAll('[\\:each\\:value]')
              .forEach(elem => (elem.textContent = array[i]));
            el.node().appendChild(child);
          }
        };
      if (!el.node().attributes[':unbound']) this.observe(prop, update);
      update();
    });

    // :bind:attr
    Array.from(node.getElementsByTagName('*'))
      .filter(el => {
        const attr = Array.from(el.attributes);
        for (let i = 0; i < attr.length; i++)
          if (/^:bind:.+/.test(attr[i].name)) return true;
        return false;
      })
      .forEach(el => {
        el = this.reactive(node, el);
        const initial = {};
        Array.from(el.node().attributes)
          .filter(attr => /^:bind:.+/.test(attr.name))
          .forEach(attr => {
            const name = attr.name.slice(6),
              props = attr.value
                .trim()
                .split(' ')
                .map(prop => prop.split('='));
            if (el.node().attributes[name])
              initial[name] = el.node().attributes[name].value;
            const update = () => {
              if (!el.node()) return;
              let value = props
                .map(prop => {
                  const val = this.get(this._proxied, prop[0]);
                  if (prop[1]) return val ? prop[1] : undefined;
                  return val;
                })
                .filter(prop => ![null, undefined].includes(prop))
                .join(' ');
              if (value !== '') {
                if (this.booleanAttributes.includes(name)) {
                  if (value.trim() === 'false') return el.node().removeAttribute(name);
                  return el.node().setAttribute(name, true);
                }
                return el
                  .node()
                  .setAttribute(name, `${initial[name] ? initial[name] : ''} ${value}`);
              }
              if (![null, undefined].includes(initial[name]))
                return el.node().setAttribute(name, initial[name]);
              el.node().removeAttribute(name);
            };
            if (!el.node().attributes[':unbound'])
              props.forEach(prop => this.observe(prop[0], update));
            update();
          });
      });

    // unnecessary? can be done via
    // :bind:style="condition,display:inline" style="display:none"
    node.querySelectorAll('[\\:if]').forEach(el => {
      el = this.reactive(node, el);
      const prop = el.node().attributes[':if'].value.trim(),
        content = el.node().outerHTML,
        update = () => {
          const value = this.get(this._proxied, prop);
          if (!el.node()) return;
          el.node().outerHTML = (value.length
          ? value.length
          : value == true)
            ? content
            : `<span _id="${el.id}"></span>`;
          this.parseDOM(el.node());
        };
      if (!el.node().attributes[':unbound']) this.observe(prop, update);
      update();
    });
    // :bind:style="condition,display:none" style="display:inline"
    node.querySelectorAll('[\\:else]').forEach(el => {
      el = this.reactive(node, el);
      const prop = el.node().attributes[':else'].value.trim(),
        content = el.node().outerHTML,
        update = () => {
          const value = this.get(this._proxied, prop);
          if (!el.node()) return;
          el.node().outerHTML = (value.length
          ? value.length
          : value == true)
            ? `<span _id="${el.id}"></span>`
            : content;
          this.parseDOM(el.node());
        };
      if (!el.node().attributes[':unbound']) this.observe(prop, update);
      update();
    });

    // restore preserved elems
    node
      .querySelectorAll('[\\:pre]')
      .forEach(el => (el.outerHTML = this._preserve[this.eID(el)]));
  }
}
