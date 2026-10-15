import { redirect } from 'next/navigation';

// "See an example" on the landing page: the clickable story with a made-up shop,
// starting where an owner would, opening the link we text them.
export default function Example() {
  redirect('/example.html#owner');
}
