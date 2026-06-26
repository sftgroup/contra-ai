#!/usr/bin/env python3
"""CONTRA Patch — inject ethers + nav + contracts + data. Preserves all original UI."""
import os, shutil, subprocess

SRC = '/tmp/contra-ai/ui-prototype'
OUT = '/tmp/contra-patched'
SERVER = '43.159.39.85'
KEY = os.path.expanduser('~/.ssh/id_ed25519')
TARGET = '/root/contra-frontend'

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
shutil.copy2('/tmp/contra-contracts.js', os.path.join(OUT, 'contra-contracts.js'))
shutil.copy2('/tmp/contra-nav.js', os.path.join(OUT, 'contra-nav.js'))
shutil.copy2('/tmp/contra-data.js', os.path.join(OUT, 'contra-data.js'))

ethers = '  <script src="https://cdn.jsdelivr.net/npm/ethers@6.13.5/dist/ethers.umd.min.js"></script>'

for fname in sorted(os.listdir(SRC)):
    if not fname.endswith('.html'):
        continue
    print(f'Patching {fname}...')
    with open(os.path.join(SRC, fname)) as f:
        c = f.read()

    c = c.replace('</head>', f'{ethers}\n</head>', 1)
    c = c.replace('</body>', '  <script src="/contra-nav.js"></script>\n  <script src="/contra-contracts.js"></script>\n  <script src="/contra-data.js"></script>\n</body>', 1)

    with open(os.path.join(OUT, fname), 'w') as f:
        f.write(c)

print(f'\n=== Output ===')
for f in sorted(os.listdir(OUT)):
    print(f'  {f}: {os.path.getsize(os.path.join(OUT,f)):,} bytes')

os.chdir(OUT)
subprocess.run(['tar', 'czf', '/tmp/contra-patched.tar.gz'] + os.listdir('.'), check=True)
subprocess.run(['scp', '-i', KEY, '-o', 'StrictHostKeyChecking=no',
                '/tmp/contra-patched.tar.gz', f'root@{SERVER}:{TARGET}/'], check=True)
subprocess.run(['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', f'root@{SERVER}',
                f'cd {TARGET} && tar xzf contra-patched.tar.gz && rm contra-patched.tar.gz && docker restart contra-frontend'], check=True)
print('\n=== Deployed ===')
