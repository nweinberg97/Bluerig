import { liveBySlug } from '@/lib/server/db';
import { LivePage, liveMetadata } from '../../_public';

// Re-render at most once a minute; publishing also refreshes the page right away.
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return liveMetadata(await liveBySlug((await params).slug));
}

export default async function Page({ params }: Props) {
  return <LivePage row={await liveBySlug((await params).slug)} />;
}
