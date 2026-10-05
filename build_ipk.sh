#!/bin/bash
set -e
echo "=========================================================="
echo "    Mluona IPTV - IPK Distribution Generator"
echo "=========================================================="
chmod +x ipk_package/tools/pack_ipk.py
python3 ipk_package/build_all_ipk.py
