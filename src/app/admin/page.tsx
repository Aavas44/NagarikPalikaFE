import { getStats, getTemplates, getTerms } from "@/lib/api";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { Stats, Template, Term } from "@/types";

export const dynamic = "force-dynamic";

const EMPTY_STATS: Stats = {
  termsCount: 0,
  templatesCount: 0,
  departmentsCount: 0,
  monthlySearches: 0,
  templateDownloads: 0,
};

export default async function AdminPage() {
  let stats: Stats = EMPTY_STATS;
  let terms: Term[] = [];
  let templates: Template[] = [];
  let loadError: string | null = null;

  try {
    [stats, terms, templates] = await Promise.all([
      getStats(),
      getTerms(),
      getTemplates(),
    ]);
  } catch (err) {
    // Backend may still be starting (ECONNREFUSED) — render admin shell anyway.
    loadError =
      err instanceof Error
        ? err.message
        : "Could not reach the API. Is the backend running on :4000?";
    console.error("[admin] Failed to load dashboard data:", err);
  }

  return (
    <AdminDashboard
      stats={stats}
      terms={terms}
      templates={templates}
      loadError={loadError}
    />
  );
}
