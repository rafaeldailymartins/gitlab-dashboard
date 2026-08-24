/**
 * Where the acceptance suite serves the app from.
 *
 * Not port 3000: that is the dev server's, and a suite that quietly reused it
 * would test on-demand transforms instead of the bundle that ships. A port of
 * its own means `bun run dev` can stay running while the suite runs.
 */
export const ACCEPTANCE_PORT = 4173

export const ACCEPTANCE_ORIGIN = `http://localhost:${String(ACCEPTANCE_PORT)}`
