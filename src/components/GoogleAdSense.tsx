export const ADSENSE_CLIENT_ID = "ca-pub-8758393677484438";

const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

/**
 * Raw <script> in <head> — required for Google AdSense site verification.
 * next/script rewrites the tag into __next_s, which the AdSense crawler does not accept.
 */
export function GoogleAdSense() {
  if (process.env.VERCEL_ENV !== "production") {
    return null;
  }

  return (
    <script
      async
      src={ADSENSE_SCRIPT_SRC}
      crossOrigin="anonymous"
    />
  );
}
