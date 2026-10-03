"""Build a single offline HTML file (maps, libraries, places and photos embedded).

Usage:  python3 tools/build-offline.py   →  dist/solar-system-offline.html
"""
import base64, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}


def data_uri(path):
    return f'data:{MIME[os.path.splitext(path)[1].lower()]};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def images(folder):
    d = os.path.join(ROOT, folder)
    if not os.path.isdir(d):
        return {}
    return {f: data_uri(os.path.join(d, f)) for f in sorted(os.listdir(d)) if os.path.splitext(f)[1].lower() in MIME}


page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
m = re.search(r'<script type="module">\n(.*?)</script>', page, re.S)
mods = {'main.js': m.group(1)}
for root, _, files in os.walk(os.path.join(ROOT, 'lib')):
    for f in files:
        if f.endswith('.js') and f != 'astronomy.browser.min.js':
            full = os.path.join(root, f)
            mods[os.path.relpath(full, ROOT)] = open(full, encoding='utf-8').read()

js = lambda o: json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
# ES modules can't load from file:// — each module becomes a blob: URL with its relative imports rewritten
loader = '''<script>
window.__TEX = %s;
window.__IMG = %s;
window.__MODS = %s;
(function () {
  var M = window.__MODS, cache = {};
  function norm(base, rel) {
    var parts = base.split('/').slice(0, -1);
    rel.split('/').forEach(function (seg) { if (seg === '.' || seg === '') return; if (seg === '..') parts.pop(); else parts.push(seg); });
    return parts.join('/');
  }
  function url(path) {
    if (cache[path]) return cache[path];
    var src = M[path].replace(/(from\\s*|import\\s*)(['"])(\\.{1,2}\\/[^'"]+)\\2/g, function (m, kw, q, rel) { return kw + q + url(norm(path, rel)) + q; });
    return cache[path] = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  }
  import(url('main.js'));
})();
</script>''' % (js(images('tex')), js(images('images/places')), js(mods))

inline = lambda f: '<script>\n' + open(os.path.join(ROOT, f), encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>'
out = page[:m.start()] + loader + page[m.end():]
out = out.replace('<script src="lib/astronomy.browser.min.js"></script>', inline('lib/astronomy.browser.min.js'))
out = out.replace('<script src="places.js"></script>', inline('places.js'))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
dest = os.path.join(ROOT, 'dist', 'solar-system-offline.html')
open(dest, 'w', encoding='utf-8').write(out)
print(f'{dest}  {len(out.encode()) / 1e6:.1f} MB')
