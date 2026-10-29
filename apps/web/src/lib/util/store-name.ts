// The store's name, written once. The navbar, the footer, the side menu, the
// page titles, the JSON-LD, llms.txt and the UCP server read it. Instantiating
// the store under a new name rewrites this line to that name, so keep it
// literal and on one line. Its own module, not site.ts (which is server-only),
// so the client components that print it can import it too.
export const STORE_NAME = "Medusa Store"
