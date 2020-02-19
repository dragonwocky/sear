#!/bin/bash

raw=""
parsed=""

for file in *.js; do 
  [ -e "$file" ] || continue
  case "$file" in
     *.min.js) continue;;
     *) raw=$file
        version=${file#sear.}
        license="/*
  * Sear.js ${version%.js}
  * (c) 2020 dragonwocky <thedragonring.bod@gmail.com>
  * (https://dragonwocky.me/) under the MIT License
  */

"
        parsed="$license$($NVM_BIN/../lib/node_modules/terser/bin/terser ${file} -c -m --mangle-props keep_quoted)"
        echo "$parsed" > ${file%.js}.min.js
  esac
done

cat $raw > ../sear.js
echo "$parsed" > ../sear.min.js
