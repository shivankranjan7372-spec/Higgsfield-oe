#!/usr/bin/env python3
"""Give a Hermes agent Parallax's tools: add the `parallax` MCP server to its config.yaml.

Run it on the agent's machine, with the Python that Hermes uses (it needs PyYAML):

    python3 add-parallax-to-hermes.py --token-file /path/to/engine.token
        [--url http://127.0.0.1:13100/api/agent/mcp]
        [--config ~/.hermes/config.yaml] [--name parallax] [--remove] [--dry-run]

The token file holds the same value as Parallax's AGENT_ENGINE_TOKEN. It is written into the
config file (which already holds the agent's other secrets) and is never printed.

The edit is plain text, so the file's comments and layout stay as they are. A dated copy of
the file is kept next to it, and the result is checked before it replaces the original: every
other setting must read back exactly as before. Hermes notices the change by itself.
"""
import argparse, os, re, shutil, sys, time

p = argparse.ArgumentParser()
p.add_argument('--config', default=os.path.expanduser('~/.hermes/config.yaml'))
p.add_argument('--url', default='http://127.0.0.1:13100/api/agent/mcp')
p.add_argument('--token-file')
p.add_argument('--name', default='parallax')
p.add_argument('--remove', action='store_true')
p.add_argument('--dry-run', action='store_true', help='check the edit, change nothing')
a = p.parse_args()

try:
    import yaml
except ImportError:
    sys.exit('PyYAML is needed for the safety check; run this with the Python that Hermes uses.')
if not re.fullmatch(r'[a-z][a-z0-9_-]{0,30}', a.name):
    sys.exit('--name must be a short lower-case word')

block = []
if not a.remove:
    if not a.token_file:
        sys.exit('--token-file is required')
    token = open(a.token_file, encoding='utf-8').read().strip()
    if len(token) < 24 or not re.fullmatch(r'[A-Za-z0-9._~+/=-]+', token):
        sys.exit('the token must be 24 or more characters: letters, digits and . _ ~ + / = -')
    if not re.fullmatch(r'https?://[^\s"\'#]+', a.url):
        sys.exit('--url must be an http(s) address')
    block = [
        f'  {a.name}:',
        f'    url: "{a.url}"',
        '    headers:',
        f'      Authorization: "Bearer {token}"',
        # A generation can take many minutes; the default MCP timeout would cut it off.
        '    timeout: 2100',
        '    connect_timeout: 30',
    ]

old = open(a.config, encoding='utf-8').read()
lines = old.split('\n')

def section():
    """Line range (start, end) of the top-level mcp_servers mapping, or None."""
    for i, l in enumerate(lines):
        if re.match(r'^mcp_servers:\s*(#.*)?$', l):
            j = i + 1
            while j < len(lines) and (not lines[j].strip() or lines[j][0] in ' \t#'):
                j += 1
            return i, j
    return None

def entry_range(s, e):
    """Line range of an existing entry with our name inside the section, or None."""
    for i in range(s + 1, e):
        if re.match(r'^  ' + re.escape(a.name) + r':\s*(#.*)?$', lines[i]):
            j = i + 1
            while j < e and (not lines[j].strip() or re.match(r'^(   +|\t)', lines[j])):
                j += 1
            while j > i + 1 and not lines[j - 1].strip():
                j -= 1
            return i, j
    return None

sec = section()
if sec:
    had = entry_range(*sec)
    if had:
        del lines[had[0]:had[1]]
    if not a.remove:
        lines[sec[0] + 1:sec[0] + 1] = block
elif not a.remove:
    if re.search(r'^mcp_servers:', old, re.M):
        sys.exit('mcp_servers is written in a form this script does not edit; add the entry by hand.')
    if lines and lines[-1].strip():
        lines.append('')
    lines += ['mcp_servers:'] + block + ['']
new = '\n'.join(lines)
if new == old:
    print('nothing to change'); sys.exit(0)

before, after = yaml.safe_load(old) or {}, yaml.safe_load(new) or {}
b_servers, a_servers = dict(before.get('mcp_servers') or {}), dict(after.get('mcp_servers') or {})
b_servers.pop(a.name, None); mine = a_servers.pop(a.name, None)
rest = lambda d: {k: v for k, v in d.items() if k != 'mcp_servers'}
if rest(before) != rest(after) or b_servers != a_servers:
    sys.exit('refusing: the edit would change other settings')
if a.remove and mine is not None:
    sys.exit(f'refusing: {a.name} is still there')
if not a.remove and not (
    isinstance(mine, dict) and mine.get('url') == a.url and mine.get('timeout') == 2100
    and str((mine.get('headers') or {}).get('Authorization', '')).startswith('Bearer ')
):
    sys.exit(f'refusing: the {a.name} entry did not read back correctly')

verb = 'remove' if a.remove else 'add'
if a.dry_run:
    print(f'dry run: would {verb} {a.name}; nothing changed'); sys.exit(0)

backup = f"{a.config}.before-{a.name}-{time.strftime('%Y%m%d-%H%M%S')}"
shutil.copy2(a.config, backup)
tmp = a.config + f'.{a.name}-tmp'
fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    f.write(new)
shutil.copymode(a.config, tmp)
st = os.stat(a.config)
try:
    os.chown(tmp, st.st_uid, st.st_gid)
except PermissionError:
    pass
os.replace(tmp, a.config)
print(f"{'removed' if a.remove else 'added'} {a.name}; previous file kept as {backup}")
