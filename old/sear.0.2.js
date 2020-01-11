/*
 * Sear.js v0.2
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

function Sear(options) {
  class ObservableArray extends Array {
    constructor(args, path) {
      super(...args);
      this.__proto__.path = path;
    }
    copyWithin(...args) {
      super.copyWithin(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    fill(...args) {
      super.fill(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    pop(...args) {
      super.pop(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    push(...args) {
      super.push(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    reverse(...args) {
      super.reverse(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    sort(...args) {
      super.sort(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    shift(...args) {
      super.shift(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    unshift(...args) {
      const clone = Array.from(this);
      super.unshift(...args);
      notify(this.__proto__.path, { old: clone, new: this });
    }
    splice(...args) {
      const clone = Array.from(this);
      clone.splice(...args);
      set(data, this.__proto__.path, clone);
    }
  }
  const booleanAttributes = [
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

  let signals = {};
  const frame = options.el || document,
    persist = options.persist,
    data = cleanStore(retrieveStore(persist), options.data),
    watchers = options.watch,
    elemIDs = [],
    DEP = {
      // current evaluation
      target: null,
      // keys of computed values
      subs: {},
      depend(deps, dep) {
        // add computed value as dependency
        if (!deps.includes(this.target)) deps.push(this.target);
        // add this as dependency of computed value
        if (!this.subs[this.target].includes(dep))
          this.subs[this.target].push(dep);
      },
      getValid(deps, key) {
        // filters out dead dependencies
        return deps.filter(dep => this.subs[dep].includes(key));
      },
      notify(deps) {
        deps.forEach(notify);
      }
    };

  // data
  construct(data);
  parseDOM();
  // watchers
  for (let key in watchers)
    if (watchers.hasOwnProperty(key)) observe(key, watchers[key].bind(data));

  return data;
  // return { data, observe, notify };

  function retrieveStore(store) {
    try {
      store = JSON.parse(localStorage[store] || '{}');
      if (store && typeof store === 'object') return store;
    } catch (e) {
      return '{}';
    }
  }
  function cleanStore(store, original) {
    // potential issue: highly strict type checking.
    // e.g. if saved number 3 as "3" - will remove
    // * have decided to temporarily disable
    if (!original || typeof original !== 'object') return store;
    if (!store || typeof store !== 'object') return original;
    store = { ...original, ...store };
    Object.keys(store).forEach(key => {
      if (
        !Object.keys(original).includes(key) ||
        // typeof store[key] !== typeof original[key] ||
        typeof original[key] === 'function'
      )
        delete store[key];
    });
    store = { ...original, ...store };
    return store;
  }

  function observe(property, handler) {
    if (!signals[property]) signals[property] = [];
    signals[property].push(handler);
  }
  function notify(signal, update) {
    if (!signals[signal] || signals[signal].length < 1) return;
    signals[signal].forEach(signalHandler => signalHandler(update));

    if (persist) localStorage[persist] = JSON.stringify(data);
  }

  // this is only run on-initialisation!
  // a fully constructed object must be passed (regardless of population)
  // will not understand a change in types (simple || object || function)
  function construct(obj, path = []) {
    for (let key in obj)
      if (obj.hasOwnProperty(key)) {
        const val = obj[key];
        if (typeof val === 'function') {
          computed(obj, key, val);
        } else {
          if (Array.isArray(val)) {
            reactive(obj, key, path, true);
          } else if (typeof val === 'object' && val !== null) {
            construct(val, path.concat(key));
          } else reactive(obj, key, path);
        }
      }
  }
  function reactive(obj, key, path, isArray) {
    path = path.concat([key]).join('.');
    let deps = [],
      val = isArray ? new ObservableArray(obj[key], path) : obj[key];
    Object.defineProperty(obj, key, {
      get() {
        // will run only in context of a computed value
        if (DEP.target) DEP.depend(deps, key);
        return val;
      },
      set(input) {
        const old = val;
        val = isArray ? new ObservableArray(input, path) : input;
        // clean up deps
        deps = DEP.getValid(deps, key);
        DEP.notify(deps, key);
        notify(path, { old, new: val });
      }
    });
  }
  function computed(obj, key, func) {
    let cache = null,
      deps = [];
    // clean up after self
    observe(key, () => {
      cache = null;
      deps = DEP.getValid(deps, key);
      DEP.notify(deps, key);
    });
    Object.defineProperty(obj, key, {
      get() {
        // make computed value dependency of context
        if (DEP.target) DEP.depend(deps, key);
        DEP.target = key;
        if (!cache) {
          DEP.subs[key] = [];
          // call function to provide access to <this>
          cache = func.call(obj);
        }
        DEP.target = null;
        return cache;
      },
      set() {
        // nothing
      }
    });
  }

  // allows for referencing object properties from a string (e.g. 'user.name')
  function get(obj, key) {
    key = key.split('.');
    while (key.length > 1) {
      obj = obj[key.shift()];
      if (!obj) return undefined;
    }
    return obj[key];
  }
  function set(obj, key, val) {
    key = key.split('.');
    while (key.length > 1) {
      obj = obj[key.shift()];
      if (!obj) return undefined;
    }
    obj[key.shift()] = val;
    if (persist) localStorage[persist] = JSON.stringify(data);
    return val;
  }
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
    //     if (get(data, property) !== value) set(data, property, value);
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
      el.textContent = get(data, prop);
      if (!el.attributes[':unbound']) {
        observe(prop, () => (el.textContent = get(data, prop)));
        // mutations.observe(element, config);
      }
    });
    node.querySelectorAll('[\\:html]').forEach(el => {
      const prop = el.attributes[':html'].value.trim();
      el.innerHTML = get(data, prop);
      parseDOM(el);
      if (!el.attributes[':unbound']) {
        observe(prop, () => (el.innerHTML = get(data, prop)));
        // mutations.observe(element, config);
      }
    });
    node.querySelectorAll('[\\:value]').forEach(el => {
      const prop = el.attributes[':value'].value.trim();
      let value = get(data, prop);
      if (
        el.attributes['type'] &&
        ['radio', 'checkbox'].includes(el.attributes['type'].value.trim())
      ) {
        el.checked = value ? value : false;
        if (!el.attributes[':unbound']) {
          observe(prop, () => {
            value = get(data, prop);
            el.checked = value ? value : false;
          });
          el.onchange = event => set(data, prop, event.target.checked);
        }
      } else {
        el.value = value;
        if (!el.attributes[':unbound']) {
          observe(prop, () => (el.value = get(data, prop)));
          el.oninput = event => set(data, prop, event.target.value);
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
        el.outerHTML = get(data, prop) ? html : `<span _id="${id}"></span>`;
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
        el.outerHTML = get(data, prop) ? `<span _id="${id}"></span>` : html;
        el = node.querySelector(`[_id="${id}"]`);
      }
      update();
      if (!unbound) observe(prop, update);
    });

    node.querySelectorAll('[\\:each]').forEach(el => {
      const prop = el.attributes[':each'].value.trim(),
        cache = el.firstElementChild.cloneNode(true);
      function update() {
        const array = get(data, prop);
        if (!array) return;
        el.innerHTML = '';
        for (let i = 0; i < array.length; i++) {
          const child = cache.cloneNode(true);
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
        const cache = {};
        Array.from(el.attributes)
          .filter(attr => /^:bind:.+/.test(attr.name))
          .forEach(attr => {
            const name = attr.name.slice(6),
              props = attr.value
                .trim()
                .split(' ')
                .map(prop => prop.split(','));
            if (el.attributes[name]) cache[name] = el.attributes[name].value;
            function update() {
              let value = props
                .map(prop => {
                  const val = get(data, prop[0]);
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
              if (![null, undefined].includes(cache[name]))
                return el.setAttribute(name, cache[name]);
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
}
