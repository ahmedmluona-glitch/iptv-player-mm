#!/usr/bin/env python3
"""
Mluona IPTV - Universal IPK Packaging Tool
Creates standard, verified .ipk archives for:
  1. LG webOS Smart TVs
  2. Enigma2 Satellite/Cable Receivers (OpenATV, OpenPLi, Vu+, Dreambox)
"""

import os
import sys
import time
import io
import tarfile

def create_ar_archive(output_path, entries):
    """
    Writes a standard Unix 'ar' archive containing (name, bytes).
    Standard .ipk layout:
      1. debian-binary
      2. control.tar.gz
      3. data.tar.gz
    """
    with open(output_path, 'wb') as f:
        f.write(b"!<arch>\n")
        
        for name, data in entries:
            # Trailing slash is standard in GNU/Debian ar format
            fname = name if name.endswith('/') else name + '/'
            name_bytes = f"{fname:<16}".encode('ascii')[:16]
            mtime_bytes = f"{int(time.time()):<12}".encode('ascii')[:12]
            uid_bytes = b"0     "
            gid_bytes = b"0     "
            mode_bytes = b"100644  "
            size_bytes = f"{len(data):<10}".encode('ascii')[:10]
            fmagic = b"`\n"
            
            header = name_bytes + mtime_bytes + uid_bytes + gid_bytes + mode_bytes + size_bytes + fmagic
            f.write(header)
            f.write(data)
            # 2-byte alignment
            if len(data) % 2 != 0:
                f.write(b"\n")

def make_tar_gz_from_dir(source_dir, prefix="."):
    """Creates in-memory tar.gz from a local directory with root:root permissions."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.GNU_FORMAT) as tar:
        for root, dirs, files in os.walk(source_dir):
            # Sort for deterministic packaging
            dirs.sort()
            files.sort()
            for name in files:
                full_path = os.path.join(root, name)
                rel_path = os.path.relpath(full_path, source_dir)
                if prefix == ".":
                    arcname = os.path.join(".", rel_path)
                else:
                    arcname = os.path.join(prefix, rel_path)
                
                ti = tar.gettarinfo(full_path, arcname=arcname)
                ti.uid = 0
                ti.gid = 0
                ti.uname = "root"
                ti.gname = "root"
                # Keep executable permissions for scripts
                if name.endswith('.sh') or 'postinst' in name or 'prerm' in name or 'bin/' in arcname:
                    ti.mode = 0o755
                else:
                    ti.mode = 0o644
                with open(full_path, 'rb') as f:
                    tar.addfile(ti, f)
    return buf.getvalue()

def build_ipk(control_dir, data_dir, output_ipk_path):
    print(f"[*] Packaging IPK: {output_ipk_path}")
    
    # 1. debian-binary
    debian_binary = b"2.0\n"
    
    # 2. control.tar.gz
    control_tar_gz = make_tar_gz_from_dir(control_dir, prefix=".")
    print(f"    - control.tar.gz: {len(control_tar_gz):,} bytes")
    
    # 3. data.tar.gz
    data_tar_gz = make_tar_gz_from_dir(data_dir, prefix="/")
    print(f"    - data.tar.gz:    {len(data_tar_gz):,} bytes")
    
    # Assemble AR archive
    entries = [
        ("debian-binary", debian_binary),
        ("control.tar.gz", control_tar_gz),
        ("data.tar.gz", data_tar_gz)
    ]
    
    os.makedirs(os.path.dirname(os.path.abspath(output_ipk_path)), exist_ok=True)
    create_ar_archive(output_ipk_path, entries)
    
    ipk_size = os.path.getsize(output_ipk_path)
    print(f"[✓] Successfully built: {output_ipk_path} ({ipk_size:,} bytes)\n")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: pack_ipk.py <control_dir> <data_dir> <output.ipk>")
        sys.exit(1)
    build_ipk(sys.argv[1], sys.argv[2], sys.argv[3])
