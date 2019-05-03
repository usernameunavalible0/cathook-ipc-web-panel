#!/bin/bash

# THIS IS NOT USED

# ./hl2_linux -game tf -steam -sw -h 1280 -w 720 -noverifyfiles -novid -nojoy -nosound -norebuildaudio -nomouse -nomessagebox -nominidumps -nohltv -nobreakpad

STEAM="$HOME/.local/share/Steam"

LD_LIBRARY_PATH="$LD_LIBRARY_PATH:$(pwd):$(pwd)/bin:/lib/i386-linux-gnu:/usr/lib/i386-linux-gnu:/usr/lib/i386-linux-gnu/mesa-egl:/usr/lib/i386-linux-gnu/mesa:/usr/local/lib:/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu/mesa-egl:/usr/lib/x86_64-linux-gnu/mesa:/lib32:/usr/lib32:/libx32:/usr/libx32:/lib:/usr/lib:/usr/lib/i386-linux-gnu/sse2:/usr/lib/i386-linux-gnu/tls:/usr/lib/x86_64-linux-gnu/tls:${STEAM}/ubuntu12_32:${STEAM}/ubuntu12_32/panorama:${STEAM}/ubuntu12_32/steam-runtime/i386/lib/i386-linux-gnu:${STEAM}/ubuntu12_32/steam-runtime/i386/lib:${STEAM}/ubuntu12_32/steam-runtime/i386/usr/lib/i386-linux-gnu:${STEAM}/ubuntu12_32/steam-runtime/i386/usr/lib:${STEAM}/ubuntu12_32/steam-runtime/amd64/lib/x86_64-linux-gnu:${steampath}/ubuntu12_32/steam-runtime/amd64/lib:${STEAM}/ubuntu12_32/steam-runtime/amd64/usr/lib/x86_64-linux-gnu:${STEAM}/ubuntu12_32/steam-runtime/amd64/usr/lib:${STEAM}/ubuntu12_32:${STEAM}/ubuntu12_64" \
	DISPLAY=":0" \
	PATH="$PATH:${STEAM}/ubuntu12_32/steam-runtime/amd64/bin:${STEAM}/ubuntu12_32/steam-runtime/amd64/usr/bin" \
		exec hl2_linux -game tf -textmode -steam -sw -h 640 -w 480 -novid -nojoy -nosound -noshaderapi -norebuildaudio -nomouse -nomessagebox -nominidumps -nohltv -nobreakpad $@
