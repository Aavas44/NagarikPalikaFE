import { ConsultForm } from "@/components/consult/ConsultForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Consult a Lawyer for Nepal Government Paperwork",
  description:
    "Connect with verified legal professionals in Nepal for citizenship, Sifaris, property, Malpot, and government application help.",
  path: "/consult",
  keywords: [
    "lawyer Nepal",
    "legal consultation Nepal",
    "citizenship lawyer Nepal",
    "Sifaris legal help",
  ],
});

export default function ConsultPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Consult a Lawyer", path: "/consult" },
        ])}
      />
      <ConsultForm />
    </>
  );
}
