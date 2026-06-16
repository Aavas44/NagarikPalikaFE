import type {
  AdvocateProfile,
  ConsultationEvent,
  ConsultationRequest,
  ProvinceData,
  Specialty,
} from "@/types";
import { authedFetch } from "./auth";

export async function getProvinces(): Promise<{ provinces: ProvinceData[] }> {
  const res = await fetch("/api/reference/provinces");
  return res.json();
}

export async function getSpecialties(): Promise<{ specialties: Specialty[] }> {
  const res = await fetch("/api/reference/specialties");
  return res.json();
}

export async function getAdvocates(params: {
  specialty?: string;
  province?: string;
  district?: string;
}): Promise<AdvocateProfile[]> {
  const qs = new URLSearchParams();
  if (params.specialty) qs.set("specialty", params.specialty);
  if (params.province) qs.set("province", params.province);
  if (params.district) qs.set("district", params.district);
  const res = await fetch(`/api/advocates?${qs}`);
  return res.json();
}

export async function createConsultation(body: Record<string, unknown>): Promise<ConsultationRequest> {
  const res = await authedFetch("/consultations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create consultation");
  return data;
}

export async function getMyConsultations(): Promise<ConsultationRequest[]> {
  const res = await authedFetch("/consultations/mine");
  if (!res.ok) throw new Error("Failed to load consultations");
  return res.json();
}

export async function getIncomingConsultations(): Promise<
  (ConsultationRequest & { inviteId: string; tier: string })[]
> {
  const res = await authedFetch("/consultations/incoming");
  if (!res.ok) throw new Error("Failed to load requests");
  return res.json();
}

export async function acceptConsultation(id: string): Promise<ConsultationRequest> {
  const res = await authedFetch(`/consultations/${id}/accept`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to accept");
  return data;
}

export async function declineConsultation(id: string): Promise<void> {
  const res = await authedFetch(`/consultations/${id}/decline`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to decline");
  }
}

export async function getAdvocateProfile(): Promise<AdvocateProfile | null> {
  const res = await authedFetch("/advocates/profile");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export async function saveAdvocateProfile(body: Record<string, unknown>): Promise<AdvocateProfile> {
  const res = await authedFetch("/advocates/profile", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to save profile");
  return data;
}

export async function initEsewaPayment(
  consultationId: string
): Promise<{ paymentId: string; redirectUrl: string }> {
  const res = await authedFetch(`/payments/consultations/${consultationId}/pay/esewa`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Payment init failed");
  return data;
}

export async function initKhaltiPayment(consultationId: string): Promise<{
  paymentId: string;
  khalti: {
    publicKey: string;
    amount: number;
    productIdentity: string;
    productName: string;
    productUrl: string;
    returnUrl: string;
  };
}> {
  const res = await authedFetch(`/payments/consultations/${consultationId}/pay/khalti`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Payment init failed");
  return data;
}

export async function verifyEsewaPayment(
  paymentId: string,
  refId: string,
  amt: string
): Promise<void> {
  const qs = new URLSearchParams({ paymentId, refId, amt });
  const res = await fetch(`/api/payments/esewa/verify?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Verification failed");
}

export async function verifyKhaltiPayment(paymentId: string, token: string): Promise<void> {
  const res = await authedFetch("/payments/khalti/verify", {
    method: "POST",
    body: JSON.stringify({ paymentId, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Verification failed");
}

export async function devMarkPaymentPaid(paymentId: string): Promise<void> {
  const res = await authedFetch(`/payments/dev/mark-paid/${paymentId}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Dev payment failed");
}

export async function getAdminConsultations(status?: string): Promise<ConsultationRequest[]> {
  const qs = status ? `?status=${status}` : "";
  const res = await authedFetch(`/admin/consultations${qs}`);
  if (!res.ok) throw new Error("Failed to load consultations");
  return res.json();
}

export async function getConsultationEvents(id: string): Promise<ConsultationEvent[]> {
  const res = await authedFetch(`/admin/consultations/${id}/events`);
  if (!res.ok) throw new Error("Failed to load events");
  return res.json();
}

export async function getPendingAdvocates(): Promise<AdvocateProfile[]> {
  const res = await authedFetch("/admin/advocates/pending");
  if (!res.ok) throw new Error("Failed to load advocates");
  return res.json();
}

export async function approveAdvocate(id: string): Promise<AdvocateProfile> {
  const res = await authedFetch(`/admin/advocates/${id}/approve`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to approve");
  return data;
}

export async function rejectAdvocate(id: string, reason?: string): Promise<AdvocateProfile> {
  const res = await authedFetch(`/admin/advocates/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to reject");
  return data;
}
