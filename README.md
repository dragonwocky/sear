# Sear

a lightweight (~9 KB minified), reactive data system.

## a what?

when building your web app, there are 4 main data sets you deal with.

- visible / the html being displayed
- script / any javascript variables you may wish to update
- client-stored / anything persisted on the client side (e.g. localStorage)
- server-stored / data gained from interactions with the server.

Sear doesn't touch anything to do with the server. there're so many ways data
transfer between the server and client can be implemented, that's best left to you.

the other 3? Sear takes them all, and gives one single object to interact with
(from above, script data). you update data within that object, and the other two
(visible + client-stored) reactively update accordingly (if necessary).

this can massively simplify web app development when used to its fully potential,
enabling (once initialised) you to do in only a couple of lines what you may once
have needed to write 20 for.

works without a virtual DOM. i'm not sure how they are supposedly faster? even if data is being
modified on the virtual DOM, the real DOM has still gotta be updated or it's kinda pointless.
so, why not just work with what you got? by only interacting with what it needs to, rather than
trying to rebuild a whole DOM, there are no noticeable performance issues.

why should you use this when there are so many other libraries out there promising
similar things, all of which seem to have massive amounts of support behind them?
all depends on your use case. they had many things i didn't need nor want, and lacked
other things i did (without having to install extra libraries). so, i spent ~50 hours
of my time building something simple but powerful. this doesn't come with the complexities
of constructing multiple components on the server-side and then learning an extensive api
to fit everything together. it comes with functionality that does the job without trying
to do any more.

if you do want something like that, check out [Vue.js](https://vuejs.org/) or
[Svelte](https://svelte.dev/). otherwise, give Sear a try. it has some decent
capabilities, and does the job well enough.

## docs / features

(to see these in action, go to [the website](https://dragonwocky.me/sear/))

#### app declaration

include the file! either download the file from [here](https://github.com/dragonwocky/sear/releases/download/v0.4.1/sear.0.4.1.js)
and include in your own assets, or source it from `https://dragonwocky.me/sear/sear.0.4.1.min.js`.

```html
<script src="https://dragonwocky.me/sear/sear.0.4.1.min.js"></script>
```

initialise.

```js
const app = new Sear({
  // whatever element you want to restrict this to
  // default: document.body
  el: document.querySelector('#app'),
  // persist app data to localStorage under this name
  // default: none (doesn't persist)
  persist: 'Sear/Demo',
  format: {
    // version of the data structure
    // default: none (won't check)
    version: 1,
    // run this handler if version (above) doesn't match
    // with the persisted data structure version
    // args: the old data found in localStorage
    // default: returns empty object / starts afresh
    handler: function(old) {
      return {};
    }
  },
  // any reactive data properties
  // inc. computed properties
  data: {},
  // any functions watching for changes to data
  watch: {}
});
```

#### properties

basic properties can be objects, arrays, dates, strings, numbers, and boolean values.

```js
data: {
  selected: 'purple',
  icecream: {
    flavours: ['berry', 'watermelon', '<b>tiramisu</b>']
  }
}
```

these can be updated like any normal object property, or added in later.

```js
app.user.selected = 'green';
app.icecream.new = '';
app.paragraph = `this is <b>bold</b>.
  this is <i>italicised</i>.
  but i? i am <s>struck out</s>.`;
```

computed properties are functions that can return a dynamic value
and can access fellow properties via `this`. these must not be declared
as arrow functions! (arrow functions break persistence and accessing `this`)

> to access a computed value,
> use `app.value` rather than `app.value()`.

```js
data: {
  redselected() {
    return this.selected === 'red';
  },
  colour () {
    return 'color: ' + this.selected;
  }
}
```

#### watchers

a watcher function will be evaluated whenever its corresponding data
prop is changed. an argument is passed to it with the previous value of that data.

> due to the way the observation system works,
> watchers for properties within objects are declared by `'parent.child'(prev) {}`
> rather than `parent: { child(prev) {} }`.
> this allows for watching objects and their properties separately.

```js
watch: {
  selected(prev) {
    console.log(
      `[watcher] selected colour has changed from ${prev} to ${this.selected}`
    );
  },
  'icecream.flavours'(prev) {
    const flavours = [...this.icecream.flavours]
      .filter(flavour => {
        if (prev.includes(flavour)) {
          prev.splice(prev.indexOf(flavour), 1);
          return false;
        }
        return true;
      });
    if (flavours.length) {
      console.log(`[watcher] flavour(s) added: <${flavours.join('> <')}>`);
    } else if (prev.length)
      console.log(`[watcher] flavour(s) removed: <${prev.join('> <')}>`);
  }
}
```

### reactive binding

#### :html

sync the contents of the bound element to a data property.
contents will be displayed as HTML.

> not recommended (unless for e.g. displaying parsed markdown).
> dynamically rendering untrusted or user-input content could lead to
> XSS attacks (or other unintended consequences).

```html
<p :html="paragraph"></p>
```

#### :text

sync the contents of the bound element to a data property.
contents will be displayed as plain text.

```html
<p :text="paragraph"></p>
```

#### {{ moustache }}

text binding can also be done via `{{ moustache }}` tags.

> use only in text nodes. use in attributes etc. will make weird things happen.

```html
<p>{{ paragraph }}</p>
```

#### :value

sync the value of the bound input to a data property.
works for any input (e.g. text, checkbox, select, you name it).

```html
<textarea :value="paragraph"></textarea>

<select :value="selected">
  <option value="red">red</option>
  <option value="blue">blue</option>
  <option value="green">green</option>
  <option value="purple">purple</option>
</select>
```

#### :unbound

use if you want something to be initially populated with a value,
but not reactively updated.

```html
<p>
  <b>initial paragraph (as of page load):</b>
  <span :text="paragraph" :unbound></span>
</p>
```

#### :pre

use if you want to preserve everything within that tag -
content will not be modified/updated in any way.

```html
<p :pre>these {{ tags }} will <span :text="paragraph">not</span> be parsed!</p>
```

#### :each

repeat an element for each value of an array.
assign this attribute to a container, and the first child will be the one
repeated within the container.

to access the relevant index/id (starting from 1) use `[[:each:id]]` and
to access the current value use `[[:each:value]]`.
if the value should be parsed as html (e.g. for displaying markdown), use `[[:each:value:html]]`.

```html
<div :each="icecream.flavours">
  <p><i>[[:each:id]]</i>. [[:each:value]]</p>
  <button onclick="app.icecream.flavours.splice([[:each:id]] - 1, 1)">
    delete
  </button>
</div>
```

> extra snippet! to add something to the list, use the following js
> (assuming you've bound an input via `:value="icecream.new"`):
>
> ```js
> if (app.icecream.new) {
>   app.icecream.flavours = [app.icecream.new, ...app.icecream.flavours];
>   app.icecream.new = '';
> }
> ```

#### :if / :else

with `:if`, the element will only be present on the page if the
relevant prop has a truthy value.

with `:else`, the element will only be present on the page if the
relevant prop has a falsy value.

```html
<p>
  <b>is red selected?</b>
  <span :if="redselected">yes it is</span>
  <span :else="redselected">no it isn't</span>
</p>
```

#### :bind:attr

use to reactively update/bind any attribute value.

values are separated by spaces, written as `condition,response`.
if there is no `response`, it will be assumed to be the value of `condition`.

if the attribute is boolean, then a truthy `condition` will result in the
presence of the attribute. a falsy `condition` will result in the removal of
the attribute. to inverse this, do `condition,false`.

> this is only 1 way (it does not sync).
> for the `checked` attribute of checkboxes, use `:value` instead.

```html
<p>
  <input type="checkbox" :bind:disabled="redselected,false" disabled />
  <span>(will be disabled if red is not selected)</span>
</p>

<p :bind:style="colour">i'm {{ selected }}</p>
```

## known bugs / possible future features

- should I switch from localStorage to IndexedDB?
- 2-way binding with `:text` and `:html` (e.g. the content changes and
  updates the related data prop) is possible/implemented, however code
  has been commented out due to a) it's buggy with contenteditable -
  which, hey, why are you using anyway, but b) when would you even
  practically need this capability?
- limitation: moustache syntax works only for props / cannot be evaluated.
  not a major issue, as computed properties can be used instead. however,
  this is annoying in `:each` loops, as IDs/values cannot be reactively
  modified before being displayed.
- limitation: can only handle certain data types (see above). do i bother
  adding support for more? i don't see any reason to (how would parsing to html work?)

## license

_reactivity concepts originally learnt from_
_<https://github.com/shentao/seer/>, which is_
_Copyright (c) 2016 Damian Dulisz under the MIT license._

code here is my own, and is licensed in the [LICENSE](LICENSE) file. a couple of functions were modified
from things found on the internet, and links to the sites from which they were
taken are in the version of the source that has comments (the not-minified one).

> basically: do what you like with this, so long as you attribute/credit me.
