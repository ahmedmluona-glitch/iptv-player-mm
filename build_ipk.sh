#!/bin/bash
set -e

echo "=========================================================="
echo "    Mluona IPTV - LG webOS IPK Builder (ares-package)"
echo "=========================================================="

if ! command -v ares-package &> /dev/null; then
    echo "[*] ares-package not found globally. Installing @webos-tools/cli..."
    npm install -g @webos-tools/cli
fi

mkdir -p dist
ares-package ipk_package/webos -o dist/

echo "=========================================================="
echo "[✓] Built package:"
ls -lh dist/com.mluona.iptv_*.ipk
echo "=========================================================="
