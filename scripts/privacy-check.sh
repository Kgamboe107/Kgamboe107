#!/usr/bin/env bash
# Refuses to publish if shipped app files contain an email address or something that looks like a secret.
# Run from the folder being published (or pass it as $1). Vendor libraries and icons are skipped.
set -u
DIR="${1:-.}"
FILES=$(find "$DIR" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.webmanifest' -o -name '*.md' \) \
  -not -path '*/vendor/*' -not -path '*/node_modules/*' -not -path '*/skills-library/*' -not -name 'package-lock.json')
fail=0
check() { # $1 label, $2 regex
  hits=$(grep -nEH "$2" $FILES 2>/dev/null | grep -vE 'noreply@|@users\.noreply|@example\.(com|org)|@[A-Za-z0-9-]+\.example\b|@yourbusiness\.com|@media|@font-face|@keyframes|@import|@supports|@layer|@property|@container|@charset|@page' || true)
  if [ -n "$hits" ]; then echo "::error::$1 found in files that would be published:"; echo "$hits" | sed -E 's/(:[0-9]+:).*/\1 (line hidden)/' | head -20; fail=1; fi
}
check 'Email address' '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}'
check 'Private key' '-----BEGIN [A-Z ]*PRIVATE KEY-----'
check 'Secret token' '(sk-[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[bpas]-[A-Za-z0-9-]{10,}|sb_secret_[A-Za-z0-9_-]{10,})'
check 'Supabase service key' 'service_role'
if [ "$fail" = 1 ]; then echo "Privacy check failed. Remove the items above before publishing."; exit 1; fi
echo "Privacy check passed."
