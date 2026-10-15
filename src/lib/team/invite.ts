// Inviting someone to edit a business. One path for everyone:
// 1) make sure they have an account, 2) make a one-time sign-in link,
// 3) email it to them ourselves, 4) add them as an editor.
// (Supabase's own invite email can't land on our sign-in page reliably, and for
// people who already have an account it sends nothing at all.)

export interface InviteDeps {
  appUrl: string;
  /** Existing user id, or a new account's id. */
  ensureUser(email: string): Promise<string | null>;
  /** One-time sign-in token for the email. */
  signInToken(email: string): Promise<string | null>;
  addEditor(businessId: string, userId: string): Promise<boolean>;
  sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }>;
}

export interface InviteResult {
  status: number;
  body: Record<string, unknown>;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export function inviteEmail(opts: { businessName: string; inviterEmail: string | null; link: string }) {
  const who = opts.inviterEmail ? `${opts.inviterEmail} invited you` : 'You’ve been invited';
  return {
    subject: `You can now edit the ${opts.businessName} website`,
    text: `Hi,\n\n${who} to help keep the ${opts.businessName} website up to date on Bluerig.\n\nOpen this link to start (it signs you in, no password needed):\n${opts.link}\n\nThe link works once and expires in about an hour. After that, sign in any time at ${new URL(opts.link).origin}/login with this email address.\n\n— Bluerig`,
  };
}

export async function inviteEditor(
  d: InviteDeps,
  input: { businessId: string; businessName: string; email: string; inviterEmail: string | null },
): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { status: 400, body: { ok: false, error: 'That email doesn’t look right.' } };
  const userId = await d.ensureUser(email);
  if (!userId) return { status: 500, body: { ok: false, error: 'Couldn’t invite that person. Try again.' } };
  const token = await d.signInToken(email);
  if (!token) return { status: 500, body: { ok: false, error: 'Couldn’t make their sign-in link. Try again.' } };
  if (!(await d.addEditor(input.businessId, userId))) return { status: 500, body: { ok: false, error: 'Couldn’t add them. Try again.' } };

  const next = `/edit/${input.businessId}`;
  const link = `${d.appUrl.replace(/\/$/, '')}/auth/callback?token_hash=${encodeURIComponent(token)}&type=magiclink&next=${encodeURIComponent(next)}`;
  const m = inviteEmail({ businessName: input.businessName, inviterEmail: input.inviterEmail, link });
  const sent = await d.sendEmail(email, m.subject, m.text);
  if (!sent.ok) {
    // They're added, but didn't get the email. Say so plainly.
    return { status: 502, body: { ok: false, added: true, error: `${email} was added, but the invite email didn’t send. They can sign in at ${d.appUrl.replace(/\/$/, '')}/login with that email.` } };
  }
  return { status: 200, body: { ok: true, email } };
}
