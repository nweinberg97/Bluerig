import type { AnchorHTMLAttributes } from 'react';

// Demo stand-in for next/link: in-app links switch demo tabs instead of navigating.
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...rest}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('demo:navigate', { detail: href }));
      }}
    >
      {children}
    </a>
  );
}
