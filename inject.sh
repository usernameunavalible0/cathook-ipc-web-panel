#!/usr/bin/env bash

pushd `dirname $0`

if ! [ $EUID == 0 ]; then
	echo "This script must be run as root"
	exit
fi

proc=$1

rm -rf /tmp/dumps # Remove if it exists
mkdir /tmp/dumps # Make it as root
chmod 000 /tmp/dumps # No permissions

FILENAME="/opt/cathook/bin/.gl$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 6 | head -n 1)"
cp "/opt/cathook/bin/libcathook-textmode.so" "$FILENAME"

echo loading "$FILENAME" to "$proc"

echo "$EUID:$USER:$HOME:$proc:$FILENAME" >> inject.log

if grep "cathook" "/proc/$proc/maps"; then
	echo "Already injected"
	echo "Already injected!" >> inject.log
	exit
fi

mkdir -p /tmp/cathook-backtraces

killall -19 steam
killall -9 steamwebhelper
killall -9 gameoverlayui

echo "Injecting..."

gdb -n -q -batch \
  -ex "attach $proc" \
  -ex "set \$dlopen = (void*(*)(char*, int)) dlopen" \
  -ex "call \$dlopen(\"$FILENAME\", 1)" \
  -ex "call dlerror()" \
  -ex 'print (char *) $2' \
  -ex "detach" \
  -ex "quit" >/dev/null
#  -ex "continue" \
#  -ex "backtrace" > /tmp/cathook-backtraces/$proc.log &

rm $FILENAME

killall -18 steamwebhelper
killall -18 gameoverlayui
killall -18 steam

popd
