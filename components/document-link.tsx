import type { ComponentProps } from 'react';

/**
 * A native link gives local pages a fresh document and asset manifest.
 * This deliberately avoids the preview runtime's RSC prefetch/navigation cache.
 * Browser keyboard, back, and open-in-new-tab behavior stay native.
 */
export function DocumentLink({ children, ...props }: ComponentProps<'a'>) {
  // oxlint-disable-next-line next/no-html-link-for-pages -- Full document navigation is intentional for the local runtime.
  return <a {...props}>{children}</a>;
}
