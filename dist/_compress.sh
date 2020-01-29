#!/bin/bash

for file in *.js; do 
  [ -e "$file" ] || continue
  case "$file" in
     *.min.js) continue;;
     *) version=${file#sear.}
        license="/*
 * Sear.js ${version%.js}
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
 * (https://dragonwocky.me/) under the MIT License
 */

"
        echo "${license}$($NVM_BIN/../lib/node_modules/terser/bin/terser ${file} --mangle-props keep_quoted -c -m)" > ${file%.js}.min.js
  esac
done