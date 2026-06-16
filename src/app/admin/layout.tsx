import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Nagarik Palika",
  description: "Nagarik Palika superadmin content management portal",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
