#!/bin/bash
set -e

echo "=========================================================="
echo "    Mluona IPTV - LG webOS IPK Builder (ares-package)"
echo "=========================================================="

export PATH="/usr/local/bin:$PATH"

ARES_BIN=""
if command -v ares-package &> /dev/null; then
    ARES_BIN="ares-package"
elif [ -x "/usr/local/bin/ares-package" ]; then
    ARES_BIN="/usr/local/bin/ares-package"
else
    echo "[*] ares-package not found. Installing @webos-tools/cli..."
    npm install -g @webos-tools/cli
    ARES_BIN="ares-package"
fi

mkdir -p dist
"$ARES_BIN" ipk_package/webos -o dist/

echo "=========================================================="
echo "[✓] Built package:"
ls -lh dist/com.mluona.iptv_*.ipk
echo "=========================================================="
