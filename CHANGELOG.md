# changelog + release notes

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
