import type { ComponentProps } from 'react';

/**
 * Use native document navigation for the exported static pages.
 * Prefix internal routes with the GitHub Pages repository path when configured.
 */
export function DocumentLink({ children, href, ...props }: ComponentProps<'a'>) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const pagePath = basePath && href && ['/challenge', '/login', '/dashboard'].includes(href) ? `${href}.html` : href;
  const url = pagePath?.startsWith('/') && !pagePath.startsWith('//')
    ? `${basePath}${pagePath}`
    : pagePath;
  // oxlint-disable-next-line next/no-html-link-for-pages -- Static exports intentionally use full document navigation.
  return <a {...props} href={url}>{children}</a>;
}
