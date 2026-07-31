import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Custom _document for Pages Router legacy error pages (404/500/_error).
 * Next.js 14 still renders these via the Pages Router even when using App Router.
 * This file must exist to prevent the "<Html> should not be imported outside
 * of pages/_document" build error during static generation of error pages.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
