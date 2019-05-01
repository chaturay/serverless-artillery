#!/usr/bin/env bash
stacks=10
delay=30

echo Clean test directory
rm -rf *-service
rm -rf error-*
rm -rf output-*

while read package; do
  echo Removing existing global install of SLSART
  npm uninstall -g serverless-artillery

  echo Installing SLSART ${package}
  npm install -g ${package}

  name=$(echo ${package:(-5)} | tr . -)

  if test -f test-done.lock; then
    rm ./test-done.lock
  fi

  ./test-slsart-version.sh ${stacks} ${name} ${delay}

  printf "Waiting for tests to complete..."
  while [ ! -f ./test-done.lock ]
    do
      printf '.'
      sleep 10
    done

  printf "DONE\n"

  let waiting=${stacks}*${delay}
  echo "First test complete. Waiting ${waiting} seconds for remaining tests to complete."
  sleep ${waiting}

done <./slsart-package.list
