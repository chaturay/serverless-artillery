#!/usr/bin/env bash
count=$1
name=$2
delay=$3

echo "Deploying, testing and removing ${count} copies of SA service (${name})."
for d in $( seq 1 ${count} )
  do
    stage=${name}-${d}
    ./test-deploy-invoke.sh ${stage} > ./output-${stage} 2> ./error-${stage} &
    sleep ${delay}
  done
