import type { DemoRequestStatus, Locale } from "@/types";
import { authedFetch } from "@/lib/auth";

export interface DemoRequest {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  contactNo: string;
  profession: string;
  queries: string;
  locale: Locale;
  status: DemoRequestStatus;
  reviewedAt: string | null;
  createdAt: string;
}

export async function getAdminDemoRequests(
  status?: DemoRequestStatus
): Promise<DemoRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authedFetch(`/admin/demo-requests${qs}`);
  if (!res.ok) {
    throw new Error("Failed to load demo requests");
  }
  return res.json();
}

export async function updateDemoRequestStatus(
  id: string,
  status: DemoRequestStatus
): Promise<DemoRequest> {
  const res = await authedFetch(`/admin/demo-requests/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to update demo request");
  }
  return data as DemoRequest;
}
