#!/usr/bin/env bash
# Builds the phone / web version into _site (only the app files: no README, docs, desktop or server code)
# and runs the privacy check. Used by Cloudflare Pages (Git integration) and by .github/workflows/cloudflare.yml.
#   Cloudflare Pages settings → Build command: bash scripts/build-web.sh   ·   Build output directory: _site
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site && mkdir -p _site
cp -r index.html unit.html manifest.webmanifest sw.js css js vendor icons unit _site/
# Offline cache list, and a cache version that changes with every commit
(cd _site && find css js vendor icons unit manifest.webmanifest unit.html -type f | grep -v LICENSE | grep -v vendor/tesseract | sort \
  | python3 -c "import json,sys; print(json.dumps([l.strip() for l in sys.stdin]))" > precache.json)
SHA="${CF_PAGES_COMMIT_SHA:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || date +%s)}}"
sed -i.bak "s/const VERSION = 'dev';/const VERSION = '${SHA:0:12}';/" _site/sw.js && rm -f _site/sw.js.bak
# Not for search engines; nothing cached by shared proxies
printf 'User-agent: *\nDisallow: /\n' > _site/robots.txt
printf '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Cache-Control: private, no-cache\n' > _site/_headers
bash scripts/privacy-check.sh _site
echo "Built _site ($(find _site -type f | wc -l | tr -d ' ') files)."
