import { getStats, getTemplates, getTerms } from "@/lib/api";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [stats, terms, templates] = await Promise.all([
    getStats(),
    getTerms(),
    getTemplates(),
  ]);

  return <AdminDashboard stats={stats} terms={terms} templates={templates} />;
}
