#!/usr/bin/env bash
# THE LEAK GATE — what a storefront carries, and what stays in the factory.
#
# A storefront built from this baseline is somebody's storefront, not a copy of this
# repository. It gets the product: the app, its tests, its CI, its tooling,
# its README and its two context pages. It does NOT get the factory:
# the blueprints, the bootstrap and rebrand tooling, the test gates, the task
# contracts and identity under `.baseline/`, this repository's own epic and
# task tree, or BOOTSTRAP.md.
#
# This asks orun to DERIVE the placement — every file every phase would write
# — and gates that set: which paths ship, and what the shipped files SAY. A
# product-facing file never names a factory path (`repo-blueprint`,
# `testing/`, `specs/`, `tasks/`, `.baseline/`, …): the product has none of
# them, so a comment or a doc pointing there points at nothing. intent.yaml is
# read as 01-product lands it, after `work-tree.mjs --strip` removed the
# baseline's own `work:` block. Derivation runs no hooks, contacts nothing and
# writes nothing. testing/placement.test.sh gates the same rules over a tree
# that is actually placed and branded.
#
# Needs: orun + node + python3. No network, no credential.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

command -v orun >/dev/null || { echo "leak.test.sh needs orun on PATH" >&2; exit 1; }

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

echo "── deriving what every phase would place"
sets=()
while IFS=$'\t' read -r k v; do sets+=( --set "$k=$v" ); done < <(
  python3 - "$here/fixtures/acme.json" <<'PY'
import json, sys
for k, v in json.load(open(sys.argv[1])).items():
    if not k.startswith("_"):
        print(f"{k}\t{'true' if v is True else 'false' if v is False else v}")
PY
)
orun new --blueprint "$root/repo-blueprint.yaml" --status --json \
  --out "$scratch/empty" "${sets[@]}" > "$scratch/status.json"

# intent.yaml as the product lands it: the work-tree strip is a 01-product
# hook, so the block it removes never reaches a product.
cp "$root/intent.yaml" "$scratch/intent.yaml"
node "$root/tooling/bootstrap/work-tree.mjs" --strip --file "$scratch/intent.yaml" >/dev/null

python3 - "$scratch/status.json" "$root" "$scratch/intent.yaml" <<'PY'
import json, pathlib, re, sys
import yaml

status = json.load(open(sys.argv[1]))
root = pathlib.Path(sys.argv[2])
landed_intent = pathlib.Path(sys.argv[3])
problems = []
def bad(m): problems.append(m)

# Against an empty output directory every file a phase places is "missing", so
# the union of those lists IS the storefront's file set.
placed = sorted({f for ph in status["phases"] for f in (ph.get("missing") or [])})
if len(placed) < 50:
    sys.exit(f"only {len(placed)} files derived — the tree is not a storefront")

# ── the context pack, exactly ─────────────────────────────────────────────
ALLOWED_AI = {"ai/context/deployment.md", "ai/context/operations.md"}
shipped_ai = {p for p in placed if p.startswith("ai/")}
for extra in sorted(shipped_ai - ALLOWED_AI):
    bad(f"{extra} ships to the storefront and is this repository's own state")
for missing in sorted(ALLOWED_AI - shipped_ai):
    bad(f"{missing} is declared a product file and would not ship")

# ── the factory never ships ───────────────────────────────────────────────
NEVER = (".baseline/", "specs/", "tasks/", "testing/", "hooks/", "docs/phases/",
         "tooling/rebrand/", "tooling/bootstrap/", ".github/workflows/baseline.yml",
         ".github/workflows/tag.yml", "BOOTSTRAP.md", "repo-blueprint.yaml",
         "blueprint.yaml", "flows/", "agents/")
for p in placed:
    for never in NEVER:
        if p == never or p.startswith(never):
            bad(f"{p} would ship — it is the factory, not the storefront")

# ── nothing local and nothing built ───────────────────────────────────────
# `.dev.vars.example` is the one `.dev.vars.*` that ships: the template an
# owner copies for `wrangler dev`, holding no value.
LOCAL = re.compile(r"(^|/)(\.env(\.[^/]*\.local|\.local)?|\.dev\.vars(\.(?!example$)[^/]*)?|node_modules|\.next|"
                   r"\.open-next|\.wrangler|\.turbo|\.orun|dist|next-env\.d\.ts|[^/]*\.tsbuildinfo)(/|$)")
for p in placed:
    if LOCAL.search(p):
        bad(f"{p} would ship — a local or built file of whoever ran the bootstrap")

# ── the storefront's README, not this repository's ──────────────────────────────
if "README.md" not in placed:
    bad("README.md would not ship")
for must in (".github/workflows/ci.yml",
             "apps/web/component.yaml", "apps/web/wrangler.jsonc", "apps/web/open-next.config.ts",
             "apps/web/LICENSE", "apps/web/src/lib/util/store-name.ts", "apps/web/src/middleware.ts",
             "apps/web/src/lib/config.ts", "apps/web/src/lib/sample/mode.ts",
             "apps/web/src/lib/sample/catalogue.ts", "apps/web/src/lib/sample/store-api.ts",
             "apps/web/src/lib/sample/search.ts", "apps/web/src/lib/sample/cart-cookie.ts",
             "apps/web/src/app/api/health/route.ts", "apps/web/public/sample/cloud-tee-black.svg",
             "apps/web/.env.template",
             "tests/web/component.yaml", "tests/web/src/sample-mode.test.ts",
             "tooling/wire/render.mjs", "tooling/wire/live.mjs", ".rebrand/values.json",
             "pnpm-lock.yaml", "packages/.gitkeep", "infra/.gitkeep"):
    if must not in placed:
        bad(f"{must} would not ship, and a storefront needs it")

# ── WHAT EVERY SHIPPED FILE SAYS ──────────────────────────────────────────
# Each placed path, read from the source the module copies it from (or the
# template that writes it), and searched for the factory's paths.
bp = yaml.safe_load((root / "repo-blueprint.yaml").read_text())
def source_of(path):
    if path == "intent.yaml":
        return landed_intent.read_text()
    for m in bp.get("modules") or []:
        if m.get("mode") == "template":
            files = m.get("files") or {}
            if path in files:
                return files[path]
            continue
        frm, to = (m.get("from") or "").rstrip("/"), (m.get("to") or "").rstrip("/")
        if path == to:
            return (root / frm).read_text(errors="replace")
        if path.startswith(to + "/"):
            return (root / frm / path[len(to) + 1:]).read_text(errors="replace")
    return None

FACTORY = re.compile(
    r"repo-blueprint|BOOTSTRAP\.md|(?<![\w./@-])(testing|specs|tasks|docs/phases|hooks)/"
    r"|\.baseline/|tooling/(rebrand|bootstrap)/")
read = 0
for p in placed:
    text = source_of(p)
    if text is None:
        bad(f"{p} is derived but no module of repo-blueprint.yaml says where it comes from")
        continue
    read += 1
    if p == "pnpm-lock.yaml":
        continue  # resolver output: package paths, not prose
    for n, line in enumerate(text.splitlines(), 1):
        m = FACTORY.search(line)
        if m:
            bad(f"{p}:{n} names the factory path {m.group(0)!r}, which no product has: {line.strip()[:90]}")

# ── PROVENANCE, which rebrand has no rule for ─────────────────────────────
# Not a search for this baseline's name: the rebrand rewrites that, and this
# gate reads the sources before it runs. What the rebrand cannot rewrite is a
# sentence about where the storefront CAME FROM, or one about being a
# baseline — in the pages written FOR its owner (turso-starter's scope: the
# shared ci.yml's own comments describe the pipeline every starter carries).
PROVENANCE = re.compile(
    r"\bfork(ed)? (of|from)\b|\bbaseline (repo|repository|commit|tag)\b|\bthis baseline\b"
    r"|BOOTSTRAP\.md|repo-blueprint|specs/epics|\.baseline/",
    re.I,
)
SOURCES = {"README.md": ".baseline/product/README.md",
           "ai/context/operations.md": "ai/context/operations.md",
           "ai/context/deployment.md": "ai/context/deployment.md"}
for shipped, src in SOURCES.items():
    for n, line in enumerate((root / src).read_text(errors="replace").splitlines(), 1):
        if PROVENANCE.search(line):
            bad(f"{shipped} (from {src}:{n}) tells the storefront about the factory: {line.strip()[:80]}")

if problems:
    print("FAIL: the storefront would carry the baseline:", file=sys.stderr)
    for p in problems:
        print(f"  - {p}", file=sys.stderr)
    sys.exit(1)

print(f"   {len(placed)} files derived across every phase, {read} read")
print(f"   ai/context is exactly {len(ALLOWED_AI)} declared file(s); none of the "
      f"{len(NEVER)} factory paths ship, and no shipped file names one; nothing "
      f"local or built; no provenance prose")
PY

echo "leak.test.sh: ok"
