import { forEditor, versions } from '@/lib/server/db';
import { fail, ok } from '@/lib/server/http';

/** Published versions, newest first. Checked on the server so staff can see them too. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  return ok({ versions: await versions(a.row.id) });
}
