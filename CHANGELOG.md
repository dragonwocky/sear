# changelog + release notes

## [unreleased]

- scoping issues need fixing (use static property with IDs stored, similar behaviour to :pre?)
- ^ if successful, could allow simple implementation of
  components-style feature

- limitation: moustache syntax works only for props / cannot be evaluated.
  not a major issue, as computed properties can be used instead. however,
  this is annoying in `:each` loops, as IDs/values cannot be reactively
  modified before being displayed.

- indexedDB instead of localStorage?

- 2-way binding with `:text` and `:html` (e.g. the content changes and
  updates the related data prop) is possible/implemented, however code
  has been commented out due to a) it's buggy with contenteditable -
  which, hey, why are you using anyway, but b) when would you even
  practically need this capability?

- limitation: can only handle certain data types. do i bother
  adding support for more? i don't see any reason to (how would parsing to html work?)

note to self: this is growing, need to start optimising some code.

## [0.4.2] / (2020-01-13)

forced provision of element to be more explicit. must provide element as ID string,
and sear will handle selection.

## [0.4.1] / (2020-01-12)

discovered and fixed library-breaking bug: computed properties within objects
were not being processed properly.

improved: added deep merging of objects, minimising data loss when there are
differences in structure (or type) between different sets of data.

added: `format` setting! want to persist data, but have a new set/structure of data?
set a version to check against, and if the data is in an old format, either parse it
with a custom handler or simply start afresh.

## [0.4] - first release / (2020-01-11)

transition from function to class.
massive improvements in code.
i can't really remember specifically where features came in, but things work now.

brief summary of features:

- limit to element
- persist to localStorage
- data: basic types || dates || computed props
- watchers
- bindings = `:html`, `:text`, `{{ moustache }}` (equiv to `:text`), `:value`, `:unbound`,
  `:pre`, `:each`, `:if`, `:else`, `:bind:attr`

## [0.3]

wow these getters and setters are really limiting.
wait there's something else called proxies? cool.
time to rebuild with proxies and make everything better.

## [0.2]

got rid of some stuff that didn't work.
semi-rewrote things? at least reorganised. it was progress.

## [0.1]

idk some things worked some things didn't.
still figuring out how the whole concept of reactivity works.
