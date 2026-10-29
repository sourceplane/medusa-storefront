#!/usr/bin/env bash
# TIER 2 — the storefront a bootstrap produces builds, deploys (dry), serves
# and takes a cart, with NO Medusa backend behind it.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree.
# This proves it WORKS, by doing to it what its own pipelines will — on the
# day it is built, when its owner has not connected a Medusa backend yet:
#
#   1. at the 01-product landing (the commit its one pull request merges), the
#      landing's own checks — install with the lockfile the product ships,
#      render fixtures and check the committed config is the render,
#      typecheck, lint, test, build. The bootstrap's landings are checked in
#      the box with `orun validate` and `orun plan` alone (`checks: local`;
#      their PR's CI on an `orun/BASE-…` branch is `plan` alone), and a
#      product's later pull requests build and dry-deploy it through ci.yml's
#      lanes, so THIS is where a product those steps refuse is caught: before
#      the tag, not after a build has merged it. Then the same at the 02-docs
#      landing, the finished storefront;
#   2. the stage lane's own steps, read out of `orun plan` in the product for
#      a pull request (the verify profile: the deploy profile has no dry run)
#      — EVERY `run:` step of the job, in order, exactly as planned: the
#      install, `verify-app-structure` (the committed `package.json` and
#      `wrangler.jsonc`, checked BEFORE any build), `build-app` (`next build`
#      on Turbopack, the OpenNext bundle), `verify-build-output` and
#      `deploy-dry-run` (`wrangler deploy --dry-run --name
#      <reponame>-web-stage`). They run IN THE TREE THE RUNNER STAGES for the
#      job (testing/lib/stage-job.py), with no build output in it and the
#      dependency layout the pinned composition produces: if its install step
#      is `scope: lane`, the top-level node_modules is a symlink to the source
#      checkout's (which Turbopack refuses); if not, the job's own install
#      step runs inside the staged tree. The job's Medusa refs are optional,
#      and a fresh product has stored none, so the lane runs with no
#      NEXT_PUBLIC_MEDUSA_* at all — as here;
#   3. serve the built Worker with `wrangler dev` and run the component's OWN
#      `smokeCommand` against it, verbatim and then inside the deploy
#      profile's planned `smoke` step (its retry loop and all — only its
#      workers.dev URL swapped for the local one) — the check the real deploy
#      ends with; then shop it: the home page under the store's own name and
#      the "Sample store" banner, prices per country, a product page, the
#      product added to the cart twice through the storefront's OWN server
#      action (by the id the build gave it) and once through `/cart/add`, the
#      cart's lines and total, checkout's and sign-in's "needs a backend"
#      notices — then every other route it promises (search, collections,
#      categories, Markdown, llms.txt, robots, the sitemap, UCP, two 404s,
#      the static assets) and the health route only the Worker answers.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered Cloudflare token, deploy for real and probe workers.dev — nor
# Medusa's: a connected storefront taking a real order needs a backend. That
# is a bootstrap against a workspace (BOOTSTRAP.md); everything short of it is
# here.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, setsid, and the
# network for `pnpm install` (or a warm store). Several minutes: three
# installs and three Next.js builds.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"

for bin in orun node pnpm python3 git curl setsid; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done

scratch="$(mktemp -d)"
dev_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So it is
# started as its own process group (setsid) and the whole group is stopped.
cleanup() {
  if [ -n "$dev_pid" ]; then
    kill -TERM -- "-$dev_pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$dev_pid" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$dev_pid" 2>/dev/null || true
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
sub="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['subdomain'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
# NO MEDUSA BACKEND, whatever the caller's shell holds: this is the storefront
# its owner gets before connecting one.
unset NEXT_PUBLIC_MEDUSA_BACKEND_URL NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY NEXT_PUBLIC_DEFAULT_REGION \
  NEXT_PUBLIC_BASE_URL NEXT_PUBLIC_STRIPE_KEY NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY \
  NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID MEDUSA_CLOUD_S3_HOSTNAME MEDUSA_CLOUD_S3_PATHNAME
free_port() { python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()"; }

# The landing's own checks, step for step, run here at once on the whole
# tree. A pull request in the product builds and dry-deploys the storefront
# through ci.yml's lanes; the lint and the tests run here, and by hand before
# a push.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "git diff --exit-code"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
s00="$(git -C "$tree" rev-parse HEAD~2)"; s01="$(git -C "$tree" rev-parse HEAD~1)"
echo "   2 phases placed and landed on orun's Initial commit"

# ── 1. each landing's own checks ───────────────────────────────────────────
echo "── 01-product's landing: install, the fixture render, typecheck, lint, test, build"
git -C "$tree" worktree add -q "$scratch/at-01" "$s01"
checks "$scratch/at-01" "$scratch/checks-01.log"
# Its tree is not needed again, and the disk is shared.
git -C "$tree" worktree remove --force "$scratch/at-01"

echo "── 02-docs's landing (the finished storefront): the same checks"
checks "$tree" "$scratch/checks-storefront.log"
grep -q '(Turbopack)' "$scratch/checks-storefront.log" \
  || { echo "FAIL: the landing's build did not run on Turbopack" >&2; exit 1; }

# ── 2. the stage lane, as a pull request plans it ──────────────────────────
echo "── the stage lane: every run step the PR plan gives web@stage, in a staged job tree"
(cd "$tree" && orun plan --intent intent.yaml --trigger github-pull-request --changed \
   --base "$s00" --head "$s01" --env stage --output "$scratch/plan-pr.json") > "$scratch/plan-pr.log" 2>&1 \
  || { echo "FAIL: orun plan (pull request)" >&2; tail -15 "$scratch/plan-pr.log" >&2; exit 1; }
python3 - "$scratch/plan-pr.json" "$scratch/steps" "$tree" "$values" <<'PY'
import json, pathlib, sys
import yaml
plan = json.load(open(sys.argv[1]))
out = pathlib.Path(sys.argv[2]); out.mkdir()
tree, values = pathlib.Path(sys.argv[3]), json.load(open(sys.argv[4]))
repo, ws = values["reponame"], values["orunWorkspace"]
job = next(j for j in plan["jobs"] if j["component"] == "web" and j["environment"] == "stage")
params = yaml.safe_load((tree / "apps/web/component.yaml").read_text())["spec"]["parameters"]
order, uses = [], []
for s in job["steps"]:
    if "use" in s:
        uses.append(f"{s['id']}\t{s['use']}\t{json.dumps(s.get('with') or {})}")
        continue
    order.append(s["id"])
    (out / f"{s['id']}.sh").write_text(s.get("run") or "")
    (out / f"{s['id']}.wd").write_text(s.get("working-directory") or ".")
    if s.get("scope"):
        (out / f"{s['id']}.scope").write_text(s["scope"])
(out / "order").write_text("\n".join(order) + "\n")
(out / "uses").write_text("\n".join(uses) + "\n")
(out / "path").write_text(job.get("path") or "apps/web")
(out / "profile").write_text(job["profile"])
(out / "node").write_text(params["nodeVersion"])
(out / "pnpm").write_text(params["pnpmVersion"])
for k, v in (job.get("env") or {}).items():
    (out / "env").open("a").write(f"export {k}={json.dumps(v)}\n")
# What the platform resolves into the job before its first step. The Medusa
# backend's refs are OPTIONAL: on a product nobody has connected, nothing is
# stored under them, so nothing is exported — which is what this lane replays.
refs = {r["asEnv"]: r for r in job.get("secretRefs") or []}
for key in ("NEXT_PUBLIC_MEDUSA_BACKEND_URL", "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_DEFAULT_REGION", "NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_STRIPE_KEY",
            "NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY", "NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID"):
    r = refs.get(key)
    if not r or r.get("optional") is not True or f"/{repo}/stage/" not in r.get("ref", ""):
        sys.exit(f"FAIL: the stage lane resolves {key} as {r} — want an optional ref to the product's stage secret")
required = sorted(k for k, r in refs.items() if not r.get("optional"))
if required:
    sys.exit(f"FAIL: the verify lane requires secrets {required}; a pull request's lane needs none")
PY
order="$(tr '\n' ' ' < "$scratch/steps/order")"
echo "   $(cat "$scratch/steps/profile"): $order"
for need in install-workspace-dependencies verify-app-structure build-app verify-build-output deploy-dry-run; do
  grep -qx "$need" "$scratch/steps/order" || { echo "FAIL: the stage lane plans no $need step" >&2; exit 1; }
done
[ "$(grep -n -x verify-app-structure "$scratch/steps/order" | cut -d: -f1)" -lt "$(grep -n -x build-app "$scratch/steps/order" | cut -d: -f1)" ] \
  || { echo "FAIL: the structure check is planned after the build" >&2; exit 1; }
# The `use:` steps set up the runner's toolchain; here it is this machine's,
# so it must be the one the component asks for.
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" = "$(cat "$scratch/steps/node")" ] || { echo "FAIL: node $node_major here, the lane sets up $(cat "$scratch/steps/node")" >&2; exit 1; }
[ "$(pnpm --version)" = "$(cat "$scratch/steps/pnpm")" ] || { echo "FAIL: pnpm $(pnpm --version) here, the lane sets up $(cat "$scratch/steps/pnpm")" >&2; exit 1; }
echo "   setup-node $node_major and setup-pnpm $(pnpm --version) stand in for the lane's \`use:\` steps"
echo "   the Medusa backend's refs are optional and unstored: the lane builds with none"

# The job's private tree, staged as orun stages it, from a source checkout
# with no build output (a CI checkout has none, so step 1's is removed rather
# than copied in) and the dependencies the pinned composition says: a
# lane-scoped install ran once in the source tree (step 1 ran the same
# command) and is linked in, or the job installs its own.
rm -rf "$tree/apps/web/.next" "$tree/apps/web/.open-next" "$tree/apps/web/.wrangler" "$tree/tests/web/coverage"
work="$tree/.orun/runs/e2e/web.stage.verify-deploy/work"
install_scope="$(cat "$scratch/steps/install-workspace-dependencies.scope" 2>/dev/null || echo job)"
if [ "$install_scope" = lane ]; then
  python3 "$here/lib/stage-job.py" "$tree" "$work" --shared-deps
  [ -L "$work/node_modules" ] || { echo "FAIL: the staged tree's node_modules is not the lane's symlink" >&2; exit 1; }
else
  python3 "$here/lib/stage-job.py" "$tree" "$work"
  [ ! -e "$work/node_modules" ] || { echo "FAIL: the staged tree carries node_modules it should install" >&2; exit 1; }
fi
for built in apps/web/.next apps/web/.open-next apps/web/.wrangler; do
  [ ! -e "$work/$built" ] || { echo "FAIL: the staged tree carries build output ($built)" >&2; exit 1; }
done
echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: $install_scope; no build output"

while IFS= read -r step; do
  [ -n "$step" ] || continue
  if [ "$step" = install-workspace-dependencies ] && [ "$install_scope" = lane ]; then
    echo "   · $step (lane-scoped: ran once in the source tree)"; continue
  fi
  echo "   ▸ $step"
  # The runner's per-job environment: the job's env (intent environment
  # `env:`) and ORUN_ENVIRONMENT; the step runs in the component's directory.
  if ! (cd "$work/$(cat "$scratch/steps/path")/$(cat "$scratch/steps/$step.wd")" && \
        { [ -f "$scratch/steps/env" ] && source "$scratch/steps/env"; true; } && \
        export ORUN_ENVIRONMENT=stage && bash -e "$scratch/steps/$step.sh") > "$scratch/$step.log" 2>&1; then
    echo "FAIL: the stage lane's $step step" >&2; tail -40 "$scratch/$step.log" >&2; exit 1
  fi
done < "$scratch/steps/order"
[ "$install_scope" = lane ] || { [ -d "$work/node_modules" ] && [ ! -L "$work/node_modules" ]; } \
  || { echo "FAIL: the job's install did not land inside its own tree" >&2; exit 1; }
# The build this storefront is verified with: Turbopack (a webpack build would get
# past an out-of-tree symlink and is not the build that deploys).
grep -q '(Turbopack)' "$scratch/build-app.log" \
  || { echo "FAIL: the staged build did not run on Turbopack" >&2; grep -m3 'Next.js' "$scratch/build-app.log" >&2; exit 1; }
grep -q -- "--name \"\${EFFECTIVE_WORKER_NAME}\"" "$scratch/steps/deploy-dry-run.sh" && grep -q "$repo-web-stage" "$scratch/steps/deploy-dry-run.sh" \
  || { echo "FAIL: the dry run does not name the Worker $repo-web-stage" >&2; exit 1; }
grep -q 'Total Upload' "$scratch/deploy-dry-run.log" \
  || { echo "FAIL: the dry run bundled nothing" >&2; tail -20 "$scratch/deploy-dry-run.log" >&2; exit 1; }
echo "   the staged build ran on Turbopack; the dry run bundled $repo-web-stage ($(grep -m1 -o 'Total Upload: .*' "$scratch/deploy-dry-run.log"))"

# ── 3. serve it, and smoke it as the deploy does ───────────────────────────
echo "── wrangler dev over the staged Worker, no Medusa backend"
port="$(free_port)"; iport="$(free_port)"
# setsid without its own fork: the subshell is not a group leader, so the
# pid recorded IS the new process group's.
(cd "$work/apps/web" && exec setsid pnpm exec wrangler dev --config wrangler.jsonc --name "$repo-web-stage" \
   --ip 127.0.0.1 --port "$port" --inspector-port "$iport" --show-interactive-dev-session=false) \
   > "$scratch/dev.log" 2>&1 < /dev/null &
dev_pid=$!
url="http://127.0.0.1:$port"
for _ in $(seq 1 120); do
  curl -s -o /dev/null "$url/favicon.ico" && break
  kill -0 "$dev_pid" 2>/dev/null || { echo "FAIL: wrangler dev exited" >&2; tail -30 "$scratch/dev.log" >&2; exit 1; }
  sleep 1
done
curl -s -o /dev/null "$url/favicon.ico" || { echo "FAIL: wrangler dev never answered" >&2; tail -30 "$scratch/dev.log" >&2; exit 1; }

smoke="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/web/component.yaml")"
echo "   ▸ the component's own smokeCommand, verbatim, DEPLOYED_URL=$url"
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the storefront" >&2; exit 1; }
if DEPLOYED_URL="$url/no-such-store" bash -c "$smoke" 2>/dev/null; then
  echo "FAIL: the smoke passed against a path that is not the storefront — it checks nothing" >&2; exit 1
fi
echo "   ▸ …and it refuses what is not the storefront"

(cd "$tree" && orun plan --intent intent.yaml --trigger github-push-main --changed \
   --base "$s00" --head "$s01" --env stage --output "$scratch/plan-push.json") > "$scratch/plan-push.log" 2>&1 \
  || { echo "FAIL: orun plan (push to main)" >&2; tail -15 "$scratch/plan-push.log" >&2; exit 1; }
python3 - "$scratch/plan-push.json" "$scratch/smoke-step.sh" "https://$repo-web-stage.$sub.workers.dev" <<'PY'
import json, sys
plan, out, origin = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
job = next(j for j in plan["jobs"] if j["component"] == "web" and j["environment"] == "stage")
assert job["profile"].endswith(".deploy"), job["profile"]
run = next(s for s in job["steps"] if s["id"] == "smoke")["run"]
# The one thing offline cannot reach is workers.dev: the step derives its URL
# from the Worker's name and the account's subdomain, so that line — and only
# that line — is pointed at the local Worker, after checking it is this storefront's.
line = 'export DEPLOYED_URL="https://${EFFECTIVE_WORKER_NAME}.${WORKERS_DEV_SUBDOMAIN}.workers.dev"'
if line not in run or 'EFFECTIVE_WORKER_NAME="' + origin.split("//")[1].split(".")[0] + '"' not in run:
    sys.exit(f"FAIL: the planned smoke step does not derive {origin}:\n{run}")
open(out, "w").write(run.replace(line, 'export DEPLOYED_URL="${E2E_LOCAL_URL}"'))
PY
echo "   ▸ the deploy profile's planned smoke step (its retry loop around the same command), on the local Worker"
(E2E_LOCAL_URL="$url" bash "$scratch/smoke-step.sh") > "$scratch/smoke-step.log" 2>&1 \
  || { echo "FAIL: the planned smoke step refused the storefront" >&2; tail -20 "$scratch/smoke-step.log" >&2; exit 1; }

# The id the build gave each server action: what the storefront's client
# calls, read from the manifest the staged build wrote.
actions="$work/apps/web/.next/server/server-reference-manifest.json"
[ -f "$actions" ] || { echo "FAIL: the build wrote no server-reference manifest" >&2; exit 1; }

echo "   ▸ a shopper on a fresh deploy: browse, add to cart, check out — then every route"
python3 - "$url" "$values" "$actions" <<'PY'
import html, json, re, sys, urllib.error, urllib.parse, urllib.request
base, values, actions = sys.argv[1], json.load(open(sys.argv[2])), json.load(open(sys.argv[3]))
name, repo = values["productname"], values["reponame"]
problems = []
def bad(m): problems.append(m)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None
opener = urllib.request.build_opener(NoRedirect)
jar = {}
def request(path, data=None, headers=None, method=None):
    h = dict(headers or {})
    if jar:
        h["Cookie"] = "; ".join(f"{k}={v}" for k, v in jar.items())
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    try:
        r = opener.open(req, timeout=60)
    except urllib.error.HTTPError as e:
        r = e
    for c in r.headers.get_all("set-cookie") or []:
        k, _, v = c.split(";", 1)[0].partition("=")
        jar[k.strip()] = v.strip()
    return r.status, r.headers, r.read()
def get(path):
    s, h, b = request(path)
    return s, h.get("content-type", ""), b
def text(b): return b.decode("utf-8", "replace")
def title(page):
    m = re.search(r"<title>(.*?)</title>", page, re.S)
    return html.unescape(m.group(1)) if m else None
BANNER = 'data-testid="sample-mode-banner"'
SAMPLE = {"cloud-tee", "edge-hoodie", "worker-cap", "cache-mug", "bucket-tote", "origin-sticker-pack"}

# ── the home page: the store's own name, on its sample catalogue ─────────
status, _, body = get("/")
page = text(body)
if status != 200:
    bad(f"/ answered {status}")
if title(page) != name:
    bad(f"the home page's <title> is {title(page)!r}, not {name!r}")
if html.unescape(page).count(name) < 3:
    bad(f"the home page does not carry the store's name {name!r} in its navbar, footer and title")
if "Medusa Store" in html.unescape(page):
    bad("the home page still carries upstream's name 'Medusa Store'")
if BANNER not in page:
    bad("the home page shows no sample banner — a fresh deploy must say its catalogue is a sample")
products = set(re.findall(r'href="/dk/products/([a-z0-9-]+)"', page))
if products != SAMPLE:
    bad(f"the home page links the products {sorted(products)}, not the sample catalogue's {sorted(SAMPLE)}")
if "€25.00" not in page:
    bad("the home page does not price the Cloud Tee at €25.00 in the default country")
status, _, body = get("/us")
if status != 200 or "$28.00" not in text(body):
    bad(f"/us answered {status} without the Cloud Tee at $28.00 — prices do not follow the country")

# ── the health route: the Worker's own answer, read-only ─────────────────
status, ctype, body = get("/api/health")
if status != 200 or json.loads(body) != {"ok": True, "mode": "sample", "regions": 2, "products": 6}:
    bad(f"/api/health answered {status} {body[:120]!r}")

# ── a product page, and the storefront's own add-to-cart action, twice ───
add = next((k for k, v in (actions.get("node") or {}).items()
            if v.get("exportedName") == "addToCart" and "lib/data/cart" in (v.get("filename") or "")), None)
if not add:
    bad("the build's server-reference manifest has no addToCart action")
status, _, body = get("/dk/products/cloud-tee")
pdp = text(body)
if status != 200 or title(pdp) != f"Cloud Tee | {name}" or 'data-testid="add-product-button"' not in pdp:
    bad(f"/dk/products/cloud-tee answered {status}, <title> {title(pdp)!r}, without an add-to-cart button")
variant = "variant_sample_cloud_tee_black_m"
if add:
    for n in (1, 2):
        status, headers, body = request("/dk/products/cloud-tee", method="POST",
            data=json.dumps([{"variantId": variant, "quantity": 1, "countryCode": "dk"}]).encode(),
            headers={"Next-Action": add, "Content-Type": "text/plain;charset=UTF-8",
                     "Accept": "text/x-component", "Origin": base})
        if status != 200 or "_medusa_sample_cart" not in jar or "_medusa_cart_id" not in jar:
            bad(f"adding {variant} (#{n}) answered {status}; cookies {sorted(jar)}")
            break
# …and the agents' form post, which the Markdown product page documents.
status, headers, _ = request("/dk/cart/add", method="POST",
    data=urllib.parse.urlencode({"variant_id": "variant_sample_cache_mug", "quantity": "1"}).encode(),
    headers={"Content-Type": "application/x-www-form-urlencoded"})
if status not in (302, 303, 307) or not (headers.get("location") or "").endswith("/dk/cart"):
    bad(f"POST /dk/cart/add answered {status} → {headers.get('location')!r}, not a redirect to the cart")
status, _, body = get("/dk/cart")
cart = text(body)
rows = re.findall(r'data-testid="product-title">([^<]+)<', cart)
total = re.search(r'data-testid="cart-total" data-value="([0-9.]+)"', cart)
if status != 200 or sorted(rows) != ["Cache Mug", "Cloud Tee"]:
    bad(f"/dk/cart answered {status} with the lines {rows}, not the Cloud Tee and the Cache Mug")
if '<option value="2" selected="">2</option>' not in cart:
    bad("/dk/cart does not hold 2 of the Cloud Tee after two adds")
if not total or float(total.group(1)) != 2 * 25 + 15:
    bad(f"/dk/cart totals {total and total.group(1)!r}, not 65")

# ── checkout and accounts need a backend, and say so ─────────────────────
for path, words in (("/dk/checkout", "Checkout needs a Medusa backend"),
                    ("/dk/account", "Accounts need a Medusa backend")):
    status, _, body = get(path)
    if status != 200 or words not in text(body):
        bad(f"{path} answered {status} without {words!r}")

# ── every other route the storefront promises ────────────────────────────
status, _, body = get("/dk/search?q=mug")
found = set(re.findall(r'href="/dk/products/([a-z0-9-]+)"', text(body)))
if status != 200 or found != {"cache-mug"}:
    bad(f"/dk/search?q=mug answered {status} with {sorted(found)}, not the mug alone")
for path, must in (("/dk/store", "All products"),
                   ("/dk/collections/apparel", 'href="/dk/products/edge-hoodie"'),
                   ("/dk/categories/home-and-office", 'href="/dk/products/origin-sticker-pack"'),
                   ("/dk/terms", name), ("/dk/privacy", name)):
    status, _, body = get(path)
    if status != 200 or must not in html.unescape(text(body)):
        bad(f"{path} answered {status} without {must!r}")
status, ctype, body = get("/dk/products/edge-hoodie.md")
if status != 200 or not text(body).startswith("# Edge Hoodie") or "Out of stock" not in text(body):
    bad(f"/dk/products/edge-hoodie.md answered {status} {ctype} — not the Markdown page with its sold-out XL")
status, _, body = get("/llms.txt")
if status != 200 or not text(body).startswith(f"# {name}\n"):
    bad(f"/llms.txt answered {status} {body[:60]!r}, not under the store's name")
# robots.txt and the sitemap are rendered per request on the origin they were asked on.
status, _, body = get("/robots.txt")
if status != 200 or f"Sitemap: {base}/sitemap.xml" not in text(body):
    bad(f"/robots.txt answered {status} without its sitemap on {base}")
status, _, body = get("/sitemap.xml")
if status != 200 or f"<loc>{base}/dk/products/cloud-tee</loc>" not in text(body):
    bad(f"/sitemap.xml answered {status} without the sample products on {base}")
for path in ("/ucp/v1", "/.well-known/ucp"):
    status, ctype, body = get(path)
    if status != 200 or "json" not in ctype:
        bad(f"{path} answered {status} {ctype}")
for path, want in (("/dk/products/no-such-product", 404), ("/dk/no-such-page", 404)):
    status, _, _ = get(path)
    if status != want:
        bad(f"{path} answered {status}, not {want}")
status, ctype, _ = get("/sample/cloud-tee-black.svg")
if status != 200 or not ctype.startswith("image/svg"):
    bad(f"/sample/cloud-tee-black.svg answered {status} {ctype}")
chunk = re.search(r'src="(/_next/static/[^"]+\.js)"', page)
if not chunk:
    bad("the home page loads no script from /_next/static")
else:
    status, ctype, _ = get(chunk.group(1))
    if status != 200 or "javascript" not in ctype:
        bad(f"{chunk.group(1)} answered {status} {ctype}")

if problems:
    for p in problems:
        print(f"  ✕ {p}", file=sys.stderr)
    sys.exit(1)
print(f"   / (named {name!r}, the sample banner) → /us in dollars → /dk/products/cloud-tee → addToCart ×2"
      f" (action {add[:10]}…) and /dk/cart/add → /dk/cart: 2 × Cloud Tee + 1 × Cache Mug = €65")
print(f"   → checkout's and sign-in's notices; search, the listing, a collection, a category, Markdown,"
      f" llms.txt, robots, the sitemap, UCP, two 404s, the assets and /api/health")
PY

echo "e2e.test.sh: ok"
