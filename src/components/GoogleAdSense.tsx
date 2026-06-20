import Script from "next/script";

export const ADSENSE_CLIENT_ID = "ca-pub-8758393677484438";

const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

/** AdSense loader — injected in root layout <head> on every page (production only). */
export function GoogleAdSense() {
  if (process.env.VERCEL_ENV !== "production") {
    return null;
  }

  return (
    <Script
      id="google-adsense"
      async
      src={ADSENSE_SCRIPT_SRC}
      crossOrigin="anonymous"
      strategy="beforeInteractive"
    />
  );
}
