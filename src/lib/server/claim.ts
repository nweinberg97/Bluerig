// Server-only entry point for claim codes (logic in lib/claim/codes.ts).
import 'server-only';
export { newCode, claimSecret, hashCode, codeMatches } from '../claim/codes';
