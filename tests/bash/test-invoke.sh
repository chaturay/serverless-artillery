#!/usr/bin/env bash
stage=$1
invocations=$2

echo Invoking Lambda with each mode ${invocations} times on stage ${stage}

for i in $( seq 1 ${invocations} )
  do
    slsart invoke -m --stage=${stage}
    echo return code: $?
    slsart invoke -a --stage=${stage}
    echo return code: $?
    slsart invoke --stage=${stage}
    echo return code: $?
  done
