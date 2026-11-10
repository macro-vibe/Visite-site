"""Check this static site's browser policy and asset integrity (stdlib only).

This is a focused regression check, not a penetration test or DDoS service.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import base64
import hashlib
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []
REQUIRED = {
    'default-src': "'none'", 'script-src': "'self'", 'script-src-attr': "'none'",
    'style-src': "'self'", 'style-src-attr': "'none'", 'img-src': "'self'",
    'font-src': "'self'", 'connect-src': "'none'", 'object-src': "'none'",
    'base-uri': "'none'", 'form-action': "'none'", 'frame-src': "'none'",
    'worker-src': "'none'", 'manifest-src': "'none'",
}

class Audit(HTMLParser):
    def __init__(self, filename):
        super().__init__(convert_charrefs=True)
        self.filename = filename
        self.policy = False
        self.referrer = False

    def fail(self, message):
        ERRORS.append(f'{self.filename}:{self.getpos()[0]}: {message}')

    def handle_starttag(self, tag, values):
        attrs = dict(values)
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'content-security-policy':
            self.policy = True
            directives = {}
            for part in attrs.get('content', '').split(';'):
                words = part.strip().split(maxsplit=1)
                if words:
                    directives[words[0]] = words[1] if len(words) > 1 else ''
            for key, expected in REQUIRED.items():
                if directives.get(key) != expected:
                    self.fail(f'Unexpected or missing CSP directive: {key}')
            if any(x in attrs.get('content', '') for x in ['unsafe-inline', 'unsafe-eval', '*']):
                self.fail('Permissive CSP source')
            if 'frame-ancestors' in directives:
                self.fail('frame-ancestors requires an HTTP header, not a meta tag')
        if tag == 'meta' and attrs.get('name') == 'referrer':
            self.referrer = attrs.get('content') == 'no-referrer'
        if any(key.startswith('on') for key in attrs):
            self.fail('Inline event handler')
        if 'style' in attrs:
            self.fail('Inline style attribute')
        for key in ('src', 'href', 'action'):
            value = attrs.get(key, '')
            if urlsplit(value).scheme.lower() in ('javascript', 'data', 'vbscript'):
                self.fail(f'Unsafe URL scheme in {key}')
        if tag in ('base', 'iframe', 'object', 'embed', 'form'):
            self.fail(f'Unexpected active element: {tag}')
        if tag == 'a' and attrs.get('target') == '_blank':
            if not {'noopener', 'noreferrer'}.issubset(set(attrs.get('rel', '').split())):
                self.fail('External tab lacks safe rel attributes')
        if tag == 'script':
            if 'src' not in attrs:
                self.fail('Inline script')
            else:
                self.asset(attrs['src'], attrs)
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.asset(attrs.get('href', ''), attrs)

    def asset(self, url, attrs):
        if not self.policy:
            self.fail('Active resource appears before CSP')
        parsed = urlsplit(url)
        target = (ROOT / parsed.path).resolve()
        if parsed.scheme or parsed.netloc or not target.is_relative_to(ROOT / 'assets') or not target.is_file():
            self.fail('Asset must be a local file under assets/')
            return
        data = target.read_bytes()
        expected = 'sha384-' + base64.b64encode(hashlib.sha384(data).digest()).decode()
        if attrs.get('integrity') != expected:
            self.fail(f'Incorrect integrity hash for {parsed.path}')
        if attrs.get('crossorigin') != 'anonymous':
            self.fail('Missing crossorigin=anonymous')
        if parsed.query != 'v=' + hashlib.sha256(data).hexdigest()[:12]:
            self.fail(f'Incorrect cache version for {parsed.path}')

for file in ['index.html', 'services.html', 'approach.html', 'contact.html']:
    parser = Audit(file)
    parser.feed((ROOT / file).read_text())
    if not parser.policy or not parser.referrer:
        ERRORS.append(f'{file}: missing CSP or referrer policy')

# Do not print potential secret values if a mistake introduces one into public files.
public_files = list(ROOT.glob('*.html')) + list((ROOT / 'assets').rglob('*'))
for file in public_files:
    if not file.is_file():
        continue
    if file.name.startswith('.env') or file.suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.session', '.zip'}:
        ERRORS.append(f'{file.relative_to(ROOT)}: sensitive/unexpected public file type')
    if file.suffix in {'.html', '.js', '.css', '.svg', '.txt'}:
        value = file.read_text()
        if re.search(r'(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b\d{8,12}:[A-Za-z0-9_-]{35}\b)', value):
            ERRORS.append(f'{file.relative_to(ROOT)}: possible credential in public file')
        if file.suffix == '.js' and re.search(r'\beval\s*\(|document\.write\s*\(|\.innerHTML\s*=', value):
            ERRORS.append(f'{file.relative_to(ROOT)}: unsafe dynamic code/HTML sink')

if ERRORS:
    print('\n'.join(ERRORS), file=sys.stderr)
    sys.exit(1)
print('PASS: restrictive CSP, local pinned assets, no inline code, safe external links, basic public-file checks')
