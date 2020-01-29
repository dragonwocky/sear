/*
 * Sear.js v0.1
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

function Sear(options) {
  class ObservableArray extends Array {
    constructor(args, path) {
      super(...args);
      this.__proto__.path = path;
    }
    push(...args) {
      super.push(...args);
      notify(this.__proto__.path);
    }
    fill(...args) {
      super.fill(...args);
      notify(this.__proto__.path);
    }
    sort(...args) {
      super.sort(...args);
      notify(this.__proto__.path);
    }
    unshift(...args) {
      super.unshift(...args);
      notify(this.__proto__.path);
    }
    reverse() {
      super.reverse();
      notify(this.__proto__.path);
    }
    shift() {
      super.shift();
      notify(this.__proto__.path);
    }
    pop() {
      super.pop();
      notify(this.__proto__.path);
    }
    splice(...args) {
      const clone = Array.from(this);
      clone.splice(...args);
      data[this.__proto__.path] = clone;
    }
  }

  const DEP = {
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

  let signals = {};
  const frame = options.el || document,
    persist = options.persist,
    data = cleanStore(JSON.parse(localStorage[persist] || '{}'), options.data),
    watchers = options.watch,
    caches = {
      each: {},
      if: {},
      attribute: {}
    };

  // data
  construct(data);
  parseDOM();
  // watchers
  for (let key in watchers)
    if (watchers.hasOwnProperty(key)) observe(key, watchers[key].bind(data));

  return data;
  // return { data, observe, notify };

  function cleanStore(data, original) {
    // potential issue: highly strict type checking.
    // e.g. save number 3 as "3" - will remove
    // * have decided to temporarily disable
    if (!original || typeof original !== 'object') return data;
    if (!data || typeof data !== 'object') return original;
    data = { ...original, ...data };
    Object.keys(data).forEach(key => {
      if (
        !Object.keys(original).includes(key) ||
        // || typeof data[key] !== typeof original[key]
        typeof original[key] === 'function'
      )
        delete data[key];
    });
    data = { ...original, ...data };
    return data;
  }

  function observe(property, handler) {
    if (!signals[property]) signals[property] = [];
    signals[property].push(handler);
  }
  function notify(signal) {
    if (!signals[signal] || signals[signal].length < 1) return;
    signals[signal].forEach(signalHandler => signalHandler());

    if (persist) localStorage[persist] = JSON.stringify(data);
  }

  // this is only run on-initialisation!
  // a fully constructed object must be passed (regardless of population)
  // will not understand a change in types (simple || object || function)
  function construct(obj, path = []) {
    for (let key in obj)
      if (obj.hasOwnProperty(key)) {
        let val = obj[key];
        if (typeof val === 'function') {
          computed(obj, key, val);
        } else {
          if (Array.isArray(val)) {
            reactive(obj, key, path, true);
          } else if (typeof val === 'object' && val !== null) {
            construct(val, path.concat(key));
          } else {
            reactive(obj, key, path);
          }
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

  function parseDOM(node = frame) {
    // allows for referencing object properties from a string (e.g. 'user.name')
    function get(obj, key) {
      key = key.split('.');
      for (let i = 0; i < key.length; i++) obj = obj[key[i]];
      return obj;
    }
    function set(obj, key, val) {
      key = key.split('.');
      while (key.length > 1) obj = obj[key.shift()];
      obj[key.shift()] = val;
      if (persist) localStorage[persist] = JSON.stringify(data);
      return obj[key.shift()];
    }
    function eID(element) {
      let id;
      if (!element.attributes['_id']) {
        id = Math.random()
          .toString(36)
          .substr(2, 9);
        element.setAttribute('_id', id);
      } else id = element.attributes['_id'].value;
      return id;
    }

    const preserve = {};
    node.querySelectorAll('[\\:pre]').forEach(element => {
      let id = eID(element);
      preserve[id] = element.outerHTML;
      element.outerHTML = `<span :pre _id="${id}"></span>`;
    });

    // 2-way syncing for :text (can get buggy with contentEditable
    // ....but then again doesn't everything?)
    function onMutate(records) {
      records.forEach(mutation => {
        if (mutation.type !== 'characterData') return;
        let element = mutation.target;
        const attr =
          element.attributes && element.attributes[':html'] ? ':html' : ':text';
        while (!element.attributes || !element.attributes[attr]) {
          if (!element.parentElement) return;
          element = element.parentElement;
        }
        const property = element.attributes[attr].value,
          value = mutation.target.innerHTML || mutation.target.data;
        if (get(data, property) !== value) set(data, property, value);
      });
    }
    const config = {
        characterData: true,
        characterDataOldValue: true,
        childList: true,
        subtree: true
      },
      mutations = new MutationObserver(onMutate);

    (node.innerHTML ? node : node.body).innerHTML = (node.innerHTML
      ? node
      : node.body
    ).innerHTML.replace(/{{([^{}]+)}}/g, '<span :text="$1"></span>');

    node.querySelectorAll('[\\:text]').forEach(element => {
      const property = element.attributes[':text'].value.trim();
      element.textContent = get(data, property);
      if (!element.attributes[':unbound']) {
        observe(property, () => (element.textContent = get(data, property)));
        mutations.observe(element, config);
      }
    });

    node.querySelectorAll('[\\:html]').forEach(element => {
      const property = element.attributes[':html'].value.trim();
      element.innerHTML = get(data, property);
      parseDOM(element);
      if (!element.attributes[':unbound']) {
        observe(property, () => (element.innerHTML = get(data, property)));
        mutations.observe(element, config);
      }
    });

    node.querySelectorAll('[\\:value]').forEach(element => {
      const property = element.attributes[':value'].value.trim();
      element.value = get(data, property);
      if (!element.attributes[':unbound']) {
        observe(property, () => (element.value = get(data, property)));
        element.oninput = event => set(data, property, event.target.value);
      }
    });

    // unnecessary? can be done via
    // :bind:style="blue,display:inline" style="display: none"
    node.querySelectorAll('[\\:if]').forEach(element => {
      const property = element.attributes[':if'].value.trim();
      let id = eID(element);
      const html = element.outerHTML;
      element.outerHTML = get(data, property)
        ? html
        : `<span _id="${id}"></span>`;
      element = node.querySelector(`[_id="${id}"]`);
      if (!element.attributes[':unbound'])
        observe(property, () => {
          element.outerHTML = get(data, property)
            ? html
            : `<span _id="${id}"></span>`;
          element = node.querySelector(`[_id="${id}"]`);
        });
    });

    node.querySelectorAll('[\\:each]').forEach(element => {
      const property = element.attributes[':each'].value.trim();
      let id = eID(element);
      if (!caches.each[id])
        caches.each[id] = element.firstElementChild.cloneNode(true);
      function update(element, property) {
        const array = get(data, property);
        element.innerHTML = '';
        for (let i = 0; i < array.length; i++) {
          const child = caches.each[id].cloneNode(true);
          child.innerHTML = child.innerHTML
            .replace(/\[\[:each:id]]/g, i + 1)
            .replace(/\[\[:each:value]]/g, array[i]);
          parseDOM(child);
          element.appendChild(child);
        }
      }
      update(element, property);

      if (!element.attributes[':unbound'])
        observe(property, () => update(element, property));
    });

    const boolAttributes = [
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
    Array.from(node.getElementsByTagName('*'))
      .filter(element => {
        const attributes = Array.from(element.attributes);
        for (let j = 0; j < attributes.length; j++)
          if (/^:bind:.+/.test(attributes[j].name)) return true;
        return false;
      })
      .forEach(element => {
        let id = eID(element);
        Array.from(element.attributes)
          .filter(attr => /^:bind:.+/.test(attr.name))
          .forEach(attr => {
            const name = attr.name.slice(6),
              props = attr.value
                .trim()
                .split(' ')
                .map(prop => prop.split(','));
            if (element.attributes[name]) {
              if (!caches.attribute[id]) caches.attribute[id] = {};
              caches.attribute[id][name] = element.attributes[name].value;
            }
            function update() {
              let value = [];
              props.forEach(prop => {
                if (get(data, prop[0])) value.push([prop[1] || prop[0]]);
              });
              value = value.join('');
              if (value) {
                if (boolAttributes.includes(name)) {
                  if (['false', false].includes(value))
                    return element.removeAttribute(name);
                  return element.setAttribute(name, true);
                }
                return element.setAttribute(name, value);
              }
              if (
                caches.attribute[id] &&
                ![null, undefined].includes(caches.attribute[id][name])
              )
                return element.setAttribute(name, caches.attribute[id][name]);
              element.removeAttribute(name);
            }
            update();
            if (!element.attributes[':unbound'])
              props.forEach(prop => observe(prop[0], update));
          });
      });

    node.querySelectorAll('[\\:pre]').forEach(element => {
      let id = eID(element);
      element.outerHTML = preserve[id];
    });
    delete preserve;
  }
}
