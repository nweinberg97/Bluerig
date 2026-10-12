import { liveByDomain } from '@/lib/server/db';
import { LivePage, liveMetadata } from '../../_public';

export const revalidate = 60;

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props) {
  return liveMetadata(await liveByDomain(decodeURIComponent((await params).host)));
}

export default async function Page({ params }: Props) {
  return <LivePage row={await liveByDomain(decodeURIComponent((await params).host))} />;
}
