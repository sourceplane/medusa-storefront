# BOOTSTRAP — a new storefront from this baseline, in one landing

How to go from **nothing** to **Medusa's DTC starter storefront live on
stage and prod, documented**, with ONE provider consent — and how its owner
then connects it to a Medusa backend.

There is one artifact: **`repo-blueprint.yaml`**. It declares what to place,
in what order, what each phase needs first, and what to say while it runs.
`orun new` is the whole runtime — the phases below are its `--phase` names,
not separate workflows. The console card the platform renders is
**`blueprint.yaml`**; it names the build document and states the inputs, the
brokered secrets and the programme, and `testing/manifest.test.sh` holds it
to what the build document does.

Target wall-clock: **about twelve minutes** — an estimate summed from the
phases (11 + 1) until a bootstrap on this shape measures it. The shape: the
task set-up in the background while ONE landing places the whole storefront,
brands it and checks it in the box (`orun validate` and `orun plan`, no
runner waited for — its pull request no longer waits on a full Next.js build
in Checks), then one convergence that builds and deploys it to stage and
prod side by side, then a short docs landing that records it. It is
cirrus-baseline's one-landing shape (baseline-v22): no scaffold landing of
its own, no second landing for the app.

## 0. What you need

- GitHub org access (repository creation) and a machine with `git`, `node`
  (≥ 22), `pnpm` (10.12.1), `python3` with PyYAML, `curl`, and the `orun`
  CLI **≥ v2.88.0** — the floor for RUNNING the bootstrap (the phase overlay,
  landings that commit per phase, `githubOwner` on the doctor probe, a probe
  deferred for a project not yet created, `from: workspace`, the deploy
  credentials minted in one `secrets` reconcile, the task set-up run in the
  background (`background: true`), and landings checked in the box before
  they merge (`checks: local`)). The storefront's own `ci.yml` pins its lanes
  separately (v2.78.4).
- A Cloudflare account (the free plan is enough for one Worker with Static
  Assets) and its **Account API token** with Workers Scripts Write (the
  console's Connect recipe lists the exact permission groups). It is the ONLY
  provider credential the bootstrap needs.
- **No Medusa backend.** Medusa is not a provider the platform brokers, so
  the bootstrap neither asks for nor creates one: the storefront is built,
  deployed and verified in sample mode — it serves a bundled catalogue and a
  cookie cart under a "Sample store" banner, and checkout and sign-in say a
  backend is needed. Its owner connects a backend afterwards (§3).
- An Orun Cloud workspace for the storefront — `orunWorkspace`, or the workspace
  the build runs in (ORUN_WORKSPACE) when that is unset — with an
  **admin-role API key** for headless runs (secret writes below admin are
  masked as `not_found`).
- **The repository allow-listed in the workspace** (console → Settings → Git
  repos), unless the credential can write links. `01-product`'s `link` step
  stops and names the fix if it is not.

## 1. One command: `--resume`

The whole bootstrap, unattended. `--resume` places every phase not already
derived as done, in order, honouring each phase's barrier:

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/medusa-storefront
cd medusa-storefront

orun new --blueprint repo-blueprint.yaml \
  --out ~/stores/acme-shop --run-hooks --resume \
  --set reponame=acme-shop --set productname="Acme Shop" \
  --set githuborg=acme-inc \
  --set orunWorkspace=ws_XXXXXXXX \
  --set subdomain=<workers-dev-subdomain>
```

`subdomain` is the workers.dev subdomain of the Cloudflare account you deploy
into (Workers & Pages → your subdomain). A build started from the console, or
with `orun baseline new --from bst_…`, never asks for it: the platform reads
it from the workspace's Cloudflare connection, the same one the deploy token
is minted from. Only a hand-run build like this one passes it.

**`--run-hooks` is the difference between placing files and bootstrapping a
storefront.** Without it `orun new` writes the tree and stops: no repository, no
landing, no convergence watch, no probe. That is deliberate — it is what
makes the offline bootstrap in `testing/` possible with no workspace and no
provider.

`--resume` is safe to re-run from anywhere, a fresh container with a fresh
`--out` included: **phase state is derived from the tree, never stored.** A
phase whose files are present but branded derives as `drifted`, and
`--resume` leaves it placed rather than reverting the storefront's identity.

## 1b. Or phase by phase

| phase | what it lands | verified by |
|---|---|---|
| `01-product` | the repository, created and linked; the WHOLE storefront in one PR — intent, CI, tooling, identity, `apps/web` + `tests/web`; the brokered Cloudflare secrets | its commit validated and planned in the box (as the PR and as the merge), then merged; the convergence green (build, deploy, smoke) and the storefront answering on both workers.dev URLs |
| `02-docs` | `ai/context/deployment.md` from probed facts; prod's promotion gate and dev's push lanes restored | the render's own probes, recorded; the commit checked in the box and merged |

```bash
orun new --blueprint repo-blueprint.yaml --out ~/stores/acme-shop --run-hooks \
  --phase 01-product --values ~/acme-shop.values.yaml
# … then 02-docs
```

`02-docs` reads the identity back from `.rebrand/values.json` in the placed
tree, but the blueprint's **required** inputs — `reponame`, `productname`,
`githuborg` — are validated before anything runs, so pass them every time (a
`--values` file is easier). The domain is not one of them: the storefront goes live
on workers.dev, and `productdomain` defaults to empty, which brands the
reserved placeholder `<reponame>.example.com` into `BASE_DOMAIN` for an owner
to replace when they attach a domain (README, "Custom domain"). Pass
`--set productdomain=` only for a storefront that already has its domain.
The full guide, one page per phase: [docs/phases/README.md](docs/phases/README.md).

| flag | what it does |
|---|---|
| `--status` | derives and prints every phase's state and writes nothing. It parses the document, validates each hook against the action registry and compiles every template; it needs no credential and no network |
| `--phase <name>` | places exactly that phase; its `requires.phases` still gates |
| `--until <name>` | places every phase through that one and stops |

What lands in the storefront is PRODUCT-ONLY: the app, its tests, its CI, its
tooling, its README and its two context pages. None of this repository's
machinery (`.baseline/`, the blueprints, `tooling/rebrand`,
`tooling/bootstrap`, `hooks/`, `testing/`, `docs/phases/`, `specs/`,
`tasks/`, this file) ships, and no file that does ship names any of them.
That promise is a test: `testing/leak.test.sh` derives what every phase would
place and gates the set and its contents, and `testing/placement.test.sh`
gates the same rules over a placed, branded tree.

## 2. Headless / container mode

The blueprint's source is this repository (`sources: [{kind: dir, path: .}]`),
so the container contract is a shallow clone at a pinned tag plus two
tokens:

```bash
export ORUN_TOKEN=…          # orun auth, headless
export GITHUB_TOKEN=…        # fine-grained PAT (below)

git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/medusa-storefront
cd medusa-storefront
orun new --blueprint repo-blueprint.yaml \
  --out /work/acme-shop --run-hooks --resume --progress json \
  --values /work/acme-shop.values.yaml
```

| requirement | detail |
|---|---|
| `GITHUB_TOKEN` | fine-grained PAT: **read** on this repository; on the storefront's repository **contents write**, **pull-requests write**, **actions read+write** (`orun.run/watch@v1` resumes runs with `gh run rerun`), **checks read**; **repository create** on the owner if `01-product` creates it (or pre-create it — supported) |
| classic token caveat | a classic PAT or gh OAuth token also needs the `workflow` scope to push `.github/workflows/` |
| pinning | the clone's `--branch <tag>` pins everything: the blueprint, its modules and its hooks' scripts all come from that one commit |

## 3. After the storefront is live: connect Medusa

The bootstrap ends with a storefront in SAMPLE MODE: live, smoke-tested,
showing its sample catalogue. Connecting it is the owner's, because no
platform connection can create a Medusa backend or its publishable key. The
store's README, "Connecting Medusa", has the steps; in short, per
environment:

```bash
orun secrets set MEDUSA_BACKEND_URL     --env stage   # the backend's URL (public)
orun secrets set MEDUSA_PUBLISHABLE_KEY --env stage   # its publishable API key (public)
# then redeploy apps/web: Orunbase's Deploy button, or change the stamp on
# the last line of apps/web/component.yaml (`# orun: redeploy …`) and merge
```

…plus each Worker URL in the backend's `STORE_CORS`. The secrets are
optional references in `apps/web/component.yaml` (`optionalSecretEnv`):
until they exist, the build skips them; once they do, the next build reads
them, and the deploy's smoke (`/api/health`) fails unless the backend lists
its regions for that key.

- **Build on it**: the app is `apps/web`; products, prices and regions live
  in the backend's Admin and need no deploy.
- **Custom domain**: attach it to the Worker in Cloudflare, add it to the
  backend's `STORE_CORS`, and replace the placeholder
  `<reponame>.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it (the
  store's README, "Custom domain"). There is no domain phase: attaching a
  domain needs zone permissions the brokered `workers-deploy` token does not
  carry.
- **Refresh the record**: re-run `--phase 02-docs`; it is idempotent, and
  records whether each environment reads a Medusa backend yet.

## 4. Testing this baseline

`.github/workflows/baseline.yml` runs three tiers on every pull request, and
each runs locally the same way:

```bash
for t in manifest phases coverage rebrand retouch bootstrap-defer; do bash testing/$t.test.sh; done
bash testing/leak.test.sh        # needs orun
bash testing/placement.test.sh   # needs orun ≥ the floor (and so ≥ ci.yml's pin), node, pnpm: the offline bootstrap
bash testing/e2e.test.sh         # + network for pnpm: each landing type-checked, linted, tested and built; the storefront dry-deployed, served, browsed and added to the cart, no backend
```

The offline bootstrap (`testing/lib/bootstrap.sh`) places both phases in
order and finishes each with the blueprint's OWN `run:` hooks — read out of
`repo-blueprint.yaml`, not transcribed — so the retouch marker, the rebrand,
the re-tenant, the work-tree strip, the deferrals and their restore and the
deployment record all run exactly as a real bootstrap runs them. Only the
platform's typed actions (task, repo, link, reconcile, land, watch, probe)
are stood in for, a landing becoming a commit on top of orun's `Initial
commit`.

The bootstrap's landings check their commit in the box (`orun validate` and
`orun plan`) and the storefront's pull requests build and dry-deploy it; neither
lints or runs the tests. The e2e tier is where those run, on each landing,
before a tag is cut.

## 5. Cutting a baseline tag (maintainers)

Every storefront built from this repository resolves a `baseline-vN` tag, so the
tag is cut by a workflow rather than by hand:

```bash
gh workflow run tag.yml -f version=baseline-v1          # from main
gh workflow run tag.yml -f version=baseline-v1 -f ref=<sha>
```

It refuses a version that is not `baseline-v<N>` and a tag that already
exists: a baseline tag is never moved. Then add (or move) the registry row in
orun-cloud's `infra/baselines-registry/baselines.yaml` by pull request —
after the tag exists, because the registry's sync fetches `blueprint.yaml`
at the tag and refuses the whole catalogue if it 404s.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `01-product` parks: `waiting for github for <org>` | the workspace's GitHub connection is to another account. Connect the App installation on `<org>` (console → Integrations → GitHub), then `--resume` |
| `01-product` waits on the `providers` probe for cloudflare, then stops | Cloudflare is not connected. Connect it (console → Integrations), then re-run the phase — the probe is a wait, not a failure |
| `01-product` stops at `link` | the repository is not linked to the workspace and the credential cannot link it. Allow-list it (console → Settings → Git repos) and re-run the phase |
| Secret WRITE fails `not_found` while listings work | the API key's role is below admin; re-mint it with the admin role |
| Deploy lane: Authentication error (10000) | the connection's token lacks Workers Scripts Write; re-issue it, re-connect, re-run `01-product` |
| Deploy lane's build: `Symlink … points out of the filesystem root` | the composition links one lane-wide install into the job's tree (stack-tectonic ≥ 0.20.0), which Turbopack refuses. The storefront pins 0.19.0 for this; keep the pin |
| The live storefront shows the "Sample store" banner | expected until a Medusa backend is connected (§3). Not a failure |
| Connected, and the deploy's smoke fails on `/api/health` (503) | the backend URL or publishable key is wrong, or the backend is down: `/api/health` reports the backend's status. Check `orun secrets list --env <env>` and the key in the Medusa Admin; fix the secret and redeploy |
| Connected, but the store listing is empty or the browser reports CORS errors | the Worker URL is not in the backend's `STORE_CORS`, or the backend has no product index at `/store/search` (the DTC starter's backend defines one) |
| `land` stops: `the landing's own check failed — orun plan for …` | the storefront's tree does not plan — the line after it is orun's own error (an unknown component type, a composition that does not resolve). Nothing was pushed. Fix the tree (or the baseline) and re-run the phase |
| `land` waits on CI after all | the storefront's repository requires a status check on `main` (branch protection or a ruleset), so GitHub refused the early merge; the landing waits for the check as a `checks: ci` landing would, then merges |
| Convergence failed AFTER the PR merged; re-running lands nothing | expected on its own — the files are on main. Re-run the phase (`--phase 01-product`, `--redo 01-product`, or the console's Retry): its `retouch` hook gives the landing a diff and the storefront redeploys |
| The storefront's `intent.yaml` says `workspace: ws_SET_ME` | `orunWorkspace` was empty and the build ran outside a workspace; set it and re-run `01-product` |
| A bootstrap stopped before `02-docs`; prod no longer waits on stage | the gate is deferred, not dropped: run `02-docs`, or `node tooling/bootstrap/promotion.mjs --restore --file <store>/intent.yaml` |
| `✕ input "productname" is required` | all three required inputs (`reponame`, `productname`, `githuborg`) must be set on every invocation, single-phase ones included |
| `unknown flag: --phase`, `has no parameter "checks"`, `has no parameter "secrets"` or another parse error in the blueprint | the CLI is below the v2.88.0 floor |
| the convergence reported green, then `verify` got 404 from both URLs | a second workflow ran on the push to main and the watch took its run. Only `ci.yml` runs on a push to main (`testing/coverage.test.sh` holds it); read the CI run on main for the real result |
| the convergence planned no lanes at all | the merge's push had no `before` to diff against (a first push straight onto an unborn `main`). The landing merges a pull request into orun's `Initial commit`, so its push has one; re-run the phase and its retouch marker re-plans the storefront |
