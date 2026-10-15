// Runs once when the server starts. In production, refuse to start without the
// secret that protects claim codes, rather than quietly using a weaker fallback.
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return; // `next build` doesn't need it
  if (!process.env.CLAIM_SECRET) {
    throw new Error('CLAIM_SECRET is not set. Bluerig will not start in production without it (see docs/STAGING.md).');
  }
}
