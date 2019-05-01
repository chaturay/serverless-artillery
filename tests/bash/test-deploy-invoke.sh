#!/usr/bin/env bash
stage=$1
invocations=10

echo Deploying ${stage}

mkdir ${stage}-service
pushd ${stage}-service

slsart configure
slsart script
slsart deploy --stage=${stage}

../test-invoke.sh ${stage} ${invocations}

slsart remove --stage=${stage}

popd
rm -rf "./${stage}-service"

touch ./test-done.lock
