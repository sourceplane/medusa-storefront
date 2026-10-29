#!/usr/bin/env bash
# THE REBRAND WRITES EACH VALUE ONCE, AND WHAT IT WROTE STAYS WRITTEN.
#
# Drives the real tooling/rebrand/rebrand.mjs over one-file trees and compares
# the file. Each case is a shape this baseline's identity actually takes in the
# tree — a source link, the store-name seam, the Worker name in wrangler.jsonc
# and the component, the intent's environment URLs, the placeholder domain, the
# Medusa secret refs, and the upstream storefront's own words and links that
# must NOT be renamed — and each can run through several passes (a re-run of a phase
# re-runs the rebrand over everything already placed, and 02-docs's heal runs
# it again), so a value written by one pass must survive every later one.
#
# The identity is PINNED (fixtures/baseline-identity.medusa-storefront.json) rather than
# read from .baseline/identity.json: what this tests is the engine, and its
# fixtures spell the identity out literally.
#
# Needs: node, git. No network.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rebrand="$here/../tooling/rebrand/rebrand.mjs"
identity="$here/fixtures/baseline-identity.medusa-storefront.json"

fail=0
# check NAME VALUES-JSON FILE CONTENT WANT [PASSES]
check() {
  local name="$1" values="$2" file="$3" content="$4" want="$5" passes="${6:-1}"
  local tmp got out i
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  for ((i = 1; i <= passes; i++)); do
    git -C "$tmp" add -A
    if ! out="$(cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty 2>&1)"; then
      echo "   ✕  $name: rebrand pass $i failed:" >&2
      printf '%s\n' "$out" | sed 's/^/        /' >&2
      fail=1
      rm -rf "$tmp"
      return
    fi
  done
  got="$(cat "$tmp/$file")"
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then
    echo "   ok  $name"
  else
    echo "   ✕  $name:" >&2
    echo "        got:  $got" >&2
    echo "        want: $want" >&2
    fail=1
  fi
}

acme='{"reponame":"acme-shop","productname":"Acme Shop","productdomain":"acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'

echo "── rebrand: the store's own identity"
check "a source link names the product's owner and repository" \
  "$acme" README.md \
  'See https://github.com/sourceplane/medusa-storefront for the source.' \
  'See https://github.com/acme-inc/acme-shop for the source.'
check "the store-name seam takes the product's name" \
  "$acme" apps/web/src/lib/util/store-name.ts 'export const STORE_NAME = "Medusa Store"' \
  'export const STORE_NAME = "Acme Shop"'
check "…and stays a valid string for a name with an apostrophe and an ampersand" \
  '{"reponame":"sams-shop","productname":"Sam'"'"'s Shirts & Mugs","productdomain":"sam.dev"}' \
  apps/web/src/lib/util/store-name.ts 'export const STORE_NAME = "Medusa Store"' \
  'export const STORE_NAME = "Sam'"'"'s Shirts & Mugs"'
check "the upstream storefront's words elsewhere are content, and are left alone" \
  "$acme" apps/web/src/modules/layout/components/medusa-cta/index.tsx \
  '// Powered by Medusa & Next.js — the Medusa Store starter' \
  '// Powered by Medusa & Next.js — the Medusa Store starter'
check "the upstream storefront's repository link is not renamed" \
  "$acme" README.md \
  'https://github.com/medusajs/dtc-starter/tree/main/apps/storefront' \
  'https://github.com/medusajs/dtc-starter/tree/main/apps/storefront'
check "…nor are Medusa's own cookie names, beside a renamed Worker" \
  "$acme" apps/web/package.json \
  'echo _medusa_cart_id _medusa_sample_cart; wrangler tail --name medusa-storefront-web-stage' \
  'echo _medusa_cart_id _medusa_sample_cart; wrangler tail --name acme-shop-web-stage'
check "the Worker name in wrangler.jsonc is re-prefixed" \
  "$acme" apps/web/wrangler.jsonc '  "name": "medusa-storefront-web",' \
  '  "name": "acme-shop-web",'
check "the component's worker name is re-prefixed, the environment suffix kept" \
  "$acme" apps/web/component.yaml '    workerName: medusa-storefront-web' \
  '    workerName: acme-shop-web'
check "the workers.dev subdomain in the component" \
  "$acme" apps/web/component.yaml '    workersDevSubdomain: your-workers-subdomain' \
  '    workersDevSubdomain: acme'
check "an environment URL in the intent" \
  "$acme" intent.yaml '    url: https://medusa-storefront-web-prod.your-workers-subdomain.workers.dev' \
  '    url: https://acme-shop-web-prod.acme.workers.dev'
check "the placeholder domain is the product's domain, not a renamed slug" \
  "$acme" intent.yaml '      BASE_DOMAIN: medusa-storefront.example.com' \
  '      BASE_DOMAIN: acme.dev'
check "no domain given: the reserved placeholder, for an owner to replace later" \
  '{"reponame":"acme-shop","productname":"Acme Shop","githuborg":"acme-inc","subdomain":"acme"}' \
  intent.yaml '      BASE_DOMAIN: medusa-storefront.example.com' \
  '      BASE_DOMAIN: acme-shop.example.com'
check "an empty domain is no domain" \
  '{"reponame":"acme-shop","productname":"Acme Shop","productdomain":""}' \
  intent.yaml '      BASE_DOMAIN: medusa-storefront.example.com' \
  '      BASE_DOMAIN: acme-shop.example.com'
check "the repo slug" \
  "$acme" package.json '  "name": "medusa-storefront",' \
  '  "name": "acme-shop",'
check "a Medusa secret ref names the product's workspace and project, the environment kept" \
  "$acme" apps/web/component.yaml \
  '    NEXT_PUBLIC_MEDUSA_BACKEND_URL: "secret://medusa-storefront/medusa-storefront/{{ .environment }}/MEDUSA_BACKEND_URL"' \
  '    NEXT_PUBLIC_MEDUSA_BACKEND_URL: "secret://ws_79BDXAZQ/acme-shop/{{ .environment }}/MEDUSA_BACKEND_URL"'
check "the Medusa variable names are Medusa's, and are left alone" \
  "$acme" apps/web/.env.template 'NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=' \
  'NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY='
check "org-owned identity is not renamed" \
  "$acme" intent.yaml 'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai' \
  'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai'
check "without githuborg a source link keeps the baseline's owner" \
  '{"reponame":"acme-shop","productname":"Acme Shop","productdomain":"acme.dev"}' \
  README.md 'https://github.com/sourceplane/medusa-storefront' \
  'https://github.com/sourceplane/acme-shop'

echo "── rebrand: a written value is not rewritten, in any later pass"
contains='{"reponame":"medusa-storefront-2","productname":"Medusa Store 2","productdomain":"medusa-storefront.example.com.au","githuborg":"sourceplane","subdomain":"your-workers-subdomain-2"}'
check "a repo slug containing the baseline's slug survives three passes" \
  "$contains" package.json '  "name": "medusa-storefront",' \
  '  "name": "medusa-storefront-2",' 3
check "a Worker name built on it survives three passes" \
  "$contains" apps/web/wrangler.jsonc '  "name": "medusa-storefront-web",' \
  '  "name": "medusa-storefront-2-web",' 3
check "a domain containing the baseline's domain survives three passes" \
  "$contains" intent.yaml 'BASE_DOMAIN: medusa-storefront.example.com' \
  'BASE_DOMAIN: medusa-storefront.example.com.au' 3
check "a subdomain containing the placeholder survives three passes" \
  "$contains" intent.yaml '    url: https://medusa-storefront-web-stage.your-workers-subdomain.workers.dev' \
  '    url: https://medusa-storefront-2-web-stage.your-workers-subdomain-2.workers.dev' 3
check "a store name containing the baseline's name survives three passes" \
  "$contains" apps/web/src/lib/util/store-name.ts 'export const STORE_NAME = "Medusa Store"' \
  'export const STORE_NAME = "Medusa Store 2"' 3
# The fixture the placement and end-to-end gates build with: a slug that ENDS
# in the baseline's, so its Worker is `<…>-medusa-storefront-web`.
suffixed='{"reponame":"acme-medusa-storefront","productname":"Acme","productdomain":"shop.acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'
check "a repo slug ending in the baseline's slug survives three passes" \
  "$suffixed" package.json '  "name": "medusa-storefront",' \
  '  "name": "acme-medusa-storefront",' 3
check "…and its Worker name" \
  "$suffixed" apps/web/wrangler.jsonc '  "name": "medusa-storefront-web",' \
  '  "name": "acme-medusa-storefront-web",' 3
check "…and its secret ref" \
  "$suffixed" apps/web/component.yaml '    X: "secret://medusa-storefront/medusa-storefront/{{ .environment }}/MEDUSA_PUBLISHABLE_KEY"' \
  '    X: "secret://ws_79BDXAZQ/acme-medusa-storefront/{{ .environment }}/MEDUSA_PUBLISHABLE_KEY"' 3
# The placement fixture carries no domain (a console build asks for none), and
# its slug's placeholder CONTAINS the baseline's: acme-medusa-storefront.example.com.
nodomain='{"reponame":"acme-medusa-storefront","productname":"Acme","productdomain":"","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'
check "…and, with no domain, its placeholder survives three passes" \
  "$nodomain" intent.yaml '      BASE_DOMAIN: medusa-storefront.example.com' \
  '      BASE_DOMAIN: acme-medusa-storefront.example.com' 3

# --verify runs in every phase. Without the product's values it cannot tell
# the product's own identity from a leftover; with them it can. A real
# leftover must fail it either way.
verify() { # NAME VALUES FILE CONTENT WANT(pass|fail) [--values]
  local name="$1" values="$2" file="$3" content="$4" want="$5" withvalues="${6:-}" tmp got
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  git -C "$tmp" add -A
  if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --verify ${withvalues:+--values .rebrand/values.json} >/dev/null 2>&1); then got=pass; else got=fail; fi
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else echo "   ✕  $name: --verify ${got}ed, want $want" >&2; fail=1; fi
}
echo "── rebrand --verify: the product's own identity is not residue"
verify "given the values, a slug containing the baseline's passes" \
  "$contains" package.json '"name": "medusa-storefront-2"' pass --values
verify "without them it cannot know, and fails" \
  "$contains" package.json '"name": "medusa-storefront-2"' fail
verify "given the values, a slug ending in the baseline's passes" \
  "$suffixed" apps/web/wrangler.jsonc '"name": "acme-medusa-storefront-web"' pass --values
verify "given the values, a placeholder domain containing the baseline's passes" \
  "$nodomain" intent.yaml 'BASE_DOMAIN: acme-medusa-storefront.example.com' pass --values
verify "the upstream storefront's link is not residue" \
  "$acme" README.md 'https://github.com/medusajs/dtc-starter/tree/main/apps/storefront' pass --values
verify "given the values, a real leftover still fails" \
  "$acme" package.json '"name": "medusa-storefront"' fail --values
verify "a leftover Worker name fails" \
  "$acme" apps/web/wrangler.jsonc '"name": "medusa-storefront-web"' fail --values
verify "a leftover link to another repository named like it fails" \
  "$acme" README.md 'https://github.com/acme-inc/medusa-storefront' fail --values
verify "a leftover code identifier fails (no rule renames it — so nothing may spell it)" \
  "$acme" apps/web/x.ts 'export class MedusaStorefront {}' fail --values
verify "a clean product passes" \
  "$acme" package.json '"name": "acme-shop"' pass --values

echo "── rebrand: a residue it cannot rename fails the rebrand itself"
tmp="$(mktemp -d)"; git -C "$tmp" init -q; mkdir -p "$tmp/.rebrand" "$tmp/apps/web"
printf '%s\n' "$acme" > "$tmp/.rebrand/values.json"
printf 'const x = "MEDUSA_STOREFRONT_TOKEN"\n' > "$tmp/apps/web/x.ts"
git -C "$tmp" add -A
if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty >/dev/null 2>&1); then
  echo "   ✕  an unrenamable env-var prefix passed the rebrand" >&2; fail=1
else
  echo "   ok  an unrenamable env-var prefix fails the rebrand, naming the file"
fi
rm -rf "$tmp"

[ "$fail" -eq 0 ] || exit 1
echo "rebrand.test.sh: ok"
