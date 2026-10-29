# web-tests

The storefront's vitest suite (the sample Store API and its search, the sample cart through upstream's data layer and server actions, the mode switch, the region middleware and the health route), run with pnpm test

The test suite for **web**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/web`          |
| Package      | `@app/web-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
