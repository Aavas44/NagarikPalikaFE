import Script from "next/script";

export const ADSENSE_CLIENT_ID = "ca-pub-8758393677484438";

/** Load AdSense only on Vercel production (main → custom domain). */
export function GoogleAdSense() {
  if (process.env.VERCEL_ENV !== "production") {
    return null;
  }

  return (
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
