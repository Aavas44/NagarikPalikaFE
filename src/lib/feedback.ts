import type { Feedback, Locale } from "@/types";
import { authedFetch } from "@/lib/auth";

const SESSION_ID_KEY = "nagarik_feedback_session_id";
const SUBMITTED_KEY = "nagarik_feedback_submitted";

export function getFeedbackSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function hasSubmittedFeedbackThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SUBMITTED_KEY) === "1";
}

export function markFeedbackSubmittedThisSession(): void {
  sessionStorage.setItem(SUBMITTED_KEY, "1");
}

export interface SubmitFeedbackInput {
  sessionId: string;
  message: string;
  name?: string;
  email?: string;
  locale: Locale;
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<Feedback> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to submit feedback");
  }

  markFeedbackSubmittedThisSession();
  return data as Feedback;
}

export async function getAdminFeedback(status?: Feedback["status"]): Promise<Feedback[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authedFetch(`/admin/feedback${qs}`);
  if (!res.ok) {
    throw new Error("Failed to load feedback");
  }
  return res.json();
}

export async function markFeedbackReviewed(id: string): Promise<Feedback> {
  const res = await authedFetch(`/admin/feedback/${id}/review`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to update feedback");
  }
  return data as Feedback;
}
