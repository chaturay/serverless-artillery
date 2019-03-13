#!/usr/bin/env bash

echo "Deploying integration test service ..."
slsart deploy | tee deploy.output.txt
TEST_URL=`cat deploy.output.txt | grep -Rho "https://.*/test"`
LIST_URL=`cat deploy.output.txt | grep -Rho "https://.*/list"`

echo
echo "Endpoints deployed:"
echo $TEST_URL
echo $LIST_URL

echo
echo "Making test requests ..."
curl $TEST_URL/one
curl $TEST_URL/one
curl $TEST_URL/one

echo
echo
echo "Getting count of requests ..."
curl $LIST_URL/one

echo
echo
read -n 1 -s -r -p "Check request count then press any key to remove service ..."

echo
echo
echo "Removing integration test service ..."
rm deploy.output.txt
slsart remove

echo
echo "DONE."
