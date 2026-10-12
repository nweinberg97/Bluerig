import { redirect } from 'next/navigation';

// The phone screen is now the editor itself (it opens on "Quick changes" on a phone).
export default async function Quick({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/edit/${(await params).id}`);
}
