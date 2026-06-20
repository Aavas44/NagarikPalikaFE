"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  getFeedbackSessionId,
  hasSubmittedFeedbackThisSession,
  markFeedbackSubmittedThisSession,
  submitFeedback,
} from "@/lib/feedback";
import pageStyles from "@/app/user.module.css";
import emiStyles from "./emi.module.css";

export function ContactSection() {
  const { locale, msg } = useLanguage();
  const t = msg.contact;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "already">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasSubmittedFeedbackThisSession()) {
      setStatus("already");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status !== "idle") return;

    setError("");
    if (message.trim().length < 10) {
      setError(t.errorMessageShort);
      return;
    }

    setLoading(true);
    try {
      await submitFeedback({
        sessionId: getFeedbackSessionId(),
        message: message.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        locale,
      });
      markFeedbackSubmittedThisSession();
      setStatus("success");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "";
      if (messageText.includes("already submitted")) {
        markFeedbackSubmittedThisSession();
        setStatus("already");
        return;
      }
      setError(messageText || t.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={pageStyles.divider} />
      <div className={pageStyles.section} id="contact">
        <div className={pageStyles.sectionHeader}>
          <h2>{t.title}</h2>
        </div>
        <p className={pageStyles.contactSubtitle}>{t.subtitle}</p>

        {status !== "idle" ? (
          <div className={`${emiStyles.emiPanel} ${pageStyles.contactSuccess}`}>
            <p>{status === "already" ? t.alreadySubmitted : t.success}</p>
          </div>
        ) : (
          <form
            className={`${emiStyles.emiPanel} ${pageStyles.contactForm}`}
            onSubmit={handleSubmit}
          >
            <div className={pageStyles.contactField}>
              <label htmlFor="contact-name">{t.nameLabel}</label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                className={emiStyles.emiNumberInput}
                autoComplete="name"
              />
            </div>

            <div className={pageStyles.contactField}>
              <label htmlFor="contact-email">{t.emailLabel}</label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className={emiStyles.emiNumberInput}
                autoComplete="email"
              />
            </div>

            <div className={pageStyles.contactField}>
              <label htmlFor="contact-message">{t.messageLabel}</label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.messagePlaceholder}
                className={pageStyles.contactTextarea}
                rows={5}
                required
                minLength={10}
                maxLength={2000}
              />
            </div>

            {error && <p className={pageStyles.contactError}>{error}</p>}

            <button
              type="submit"
              className={pageStyles.contactSubmit}
              disabled={loading}
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
