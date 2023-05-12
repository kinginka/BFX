#!/bin/bash

echo "Starting Grape 1 ..."
grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002' &

echo "Starting Grape 2 ..."
grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001' &

echo "Starting server ..."
node server.js &

wait

echo "All servers stopped."