const c = require("ansi-colors");

// The Medusa backend is optional at build time. With both of these set the
// storefront reads that backend's Store API; with either missing it builds in
// sample mode — the bundled catalogue in src/lib/sample, a cart kept in a
// cookie, checkout and accounts asking for a backend — so a fresh deploy
// serves before its owner has a Medusa backend at all. Upstream exited here;
// the port warns instead.
const connectEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
    description: "The URL of your Medusa backend, e.g. https://api.example.com",
  },
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    // TODO: we need a good doc to point this to
    description:
      "Learn how to create a publishable key: https://docs.medusajs.com/v2/resources/storefront-development/publishable-api-keys",
  },
];

function checkEnvVariables() {
  const missingEnvs = connectEnvs.filter(function (env) {
    return !process.env[env.key];
  });

  if (missingEnvs.length > 0) {
    console.warn(
      c.yellow.bold(
        "\n⚠️  No Medusa backend configured: building the storefront in sample mode\n"
      )
    );

    missingEnvs.forEach(function (env) {
      console.warn(c.yellow(`  ${c.bold(env.key)}`));
      if (env.description) {
        console.warn(c.dim(`    ${env.description}\n`));
      }
    });

    console.warn(
      c.yellow(
        "\nSet both in your .env.local file or environment to connect a backend (README → Connecting Medusa).\n"
      )
    );
  }
}

module.exports = checkEnvVariables;
