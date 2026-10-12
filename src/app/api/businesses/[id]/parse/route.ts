import { forEditor } from '@/lib/server/db';
import { body, fail, limited, ok, str } from '@/lib/server/http';
import { parseChange } from '@/lib/server/parse';

/** "Type a change": returns a proposal for the editor to show. Never saves anything. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  if (limited(`parse:${a.userId}`, 30, 60 * 1000)) return fail('Slow down a little.', 429);
  const text = str((await body(req)).text, 500);
  if (!text) return fail('Type what changed.');
  const r = await parseChange(text, a.row.draft, new Date());
  if (!r) return fail('Not sure what to change. Try one of the buttons, or click the words on the page.', 422);
  return ok({ result: r });
}
