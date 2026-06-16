import { getStats, getTemplates, getTerms, getLawyers } from "@/lib/api";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [stats, terms, templates, lawyers] = await Promise.all([
    getStats(),
    getTerms(),
    getTemplates(),
    getLawyers(),
  ]);

  return (
    <AdminDashboard
      stats={stats}
      terms={terms}
      templates={templates}
      lawyers={lawyers}
    />
  );
}
