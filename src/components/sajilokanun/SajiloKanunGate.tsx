"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import {
  getDemoSessionId,
  hasSajiloKanunToken,
  hasSubmittedDemoThisSession,
  loginSajiloKanun,
  submitDemoRequest,
} from "@/lib/sajilokanun-access";
import pageStyles from "@/app/user.module.css";
import emiStyles from "@/components/user/emi.module.css";

export function SajiloKanunGate() {
  const router = useRouter();
  const { locale, msg } = useLanguage();
  const t = msg.sajilokanun;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [demoOpen, setDemoOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [profession, setProfession] = useState("");
  const [queries, setQueries] = useState("");
  const [demoStatus, setDemoStatus] = useState<"idle" | "success" | "already">("idle");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  useEffect(() => {
    if (hasSajiloKanunToken()) {
      router.replace("/sajilokanun/chat");
    }
  }, [router]);

  useEffect(() => {
    if (hasSubmittedDemoThisSession()) {
      setDemoStatus("already");
    }
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await loginSajiloKanun(username.trim(), password);
      router.push("/sajilokanun/chat");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t.loginError);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleDemoSubmit(e: FormEvent) {
    e.preventDefault();
    if (demoStatus !== "idle") return;

    setDemoError("");
    if (queries.trim().length < 10) {
      setDemoError(t.demoErrorQueriesShort);
      return;
    }

    setDemoLoading(true);
    try {
      await submitDemoRequest({
        sessionId: getDemoSessionId(),
        name: name.trim(),
        email: email.trim(),
        contactNo: contactNo.trim(),
        profession: profession.trim(),
        queries: queries.trim(),
        locale,
      });
      setDemoStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("already submitted")) {
        setDemoStatus("already");
        return;
      }
      setDemoError(message || t.demoErrorGeneric);
    } finally {
      setDemoLoading(false);
    }
  }

  const features = [t.featureQuote, t.featureAdvocate, t.featureSearch, t.featureBilingual];

  return (
    <>
      <UserNav />
      <main className={pageStyles.skGatePage}>
        <div className={pageStyles.skGateInner}>
          <section className={pageStyles.skGateHero}>
            <p className={pageStyles.skGateEyebrow}>⚖️ {msg.nav.sajiloKanun}</p>
            <h1>{t.gateTitle}</h1>
            <p className={pageStyles.skGateLead}>{t.gateSubtitle}</p>
            <ul className={pageStyles.skGateFeatures}>
              {features.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <div className={pageStyles.skGateColumns}>
            <section className={`${emiStyles.emiPanel} ${pageStyles.skGateCard}`}>
              <h2>{t.loginTitle}</h2>
              <form className={pageStyles.skGateForm} onSubmit={handleLogin}>
                <div className={pageStyles.contactField}>
                  <label htmlFor="sk-username">{t.usernameLabel}</label>
                  <input
                    id="sk-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    className={emiStyles.emiNumberInput}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className={pageStyles.contactField}>
                  <label htmlFor="sk-password">{t.passwordLabel}</label>
                  <input
                    id="sk-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className={emiStyles.emiNumberInput}
                    autoComplete="current-password"
                    required
                  />
                </div>
                {loginError && <p className={pageStyles.contactError}>{loginError}</p>}
                <button type="submit" className={pageStyles.contactSubmit} disabled={loginLoading}>
                  {loginLoading ? t.loginSubmitting : t.loginSubmit}
                </button>
              </form>
            </section>

            <section className={`${emiStyles.emiPanel} ${pageStyles.skGateCard}`}>
              <h2>{t.demoTitle}</h2>
              <p className={pageStyles.skGateDemoLead}>{t.demoSubtitle}</p>

              {!demoOpen ? (
                <button
                  type="button"
                  className={pageStyles.skGateDemoBtn}
                  onClick={() => setDemoOpen(true)}
                >
                  {t.openDemoForm}
                </button>
              ) : demoStatus !== "idle" ? (
                <div className={pageStyles.contactSuccess}>
                  <p>{demoStatus === "already" ? t.demoAlready : t.demoSuccess}</p>
                </div>
              ) : (
                <form className={pageStyles.skGateForm} onSubmit={handleDemoSubmit}>
                  <div className={pageStyles.contactField}>
                    <label htmlFor="sk-demo-name">{t.demoNameLabel}</label>
                    <input
                      id="sk-demo-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.demoNamePlaceholder}
                      className={emiStyles.emiNumberInput}
                      required
                    />
                  </div>
                  <div className={pageStyles.contactField}>
                    <label htmlFor="sk-demo-email">{t.demoEmailLabel}</label>
                    <input
                      id="sk-demo-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.demoEmailPlaceholder}
                      className={emiStyles.emiNumberInput}
                      required
                    />
                  </div>
                  <div className={pageStyles.contactField}>
                    <label htmlFor="sk-demo-contact">{t.demoContactLabel}</label>
                    <input
                      id="sk-demo-contact"
                      type="tel"
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      placeholder={t.demoContactPlaceholder}
                      className={emiStyles.emiNumberInput}
                      required
                    />
                  </div>
                  <div className={pageStyles.contactField}>
                    <label htmlFor="sk-demo-profession">{t.demoProfessionLabel}</label>
                    <input
                      id="sk-demo-profession"
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder={t.demoProfessionPlaceholder}
                      className={emiStyles.emiNumberInput}
                      required
                    />
                  </div>
                  <div className={pageStyles.contactField}>
                    <label htmlFor="sk-demo-queries">{t.demoQueriesLabel}</label>
                    <textarea
                      id="sk-demo-queries"
                      value={queries}
                      onChange={(e) => setQueries(e.target.value)}
                      placeholder={t.demoQueriesPlaceholder}
                      className={pageStyles.contactTextarea}
                      rows={4}
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </div>
                  {demoError && <p className={pageStyles.contactError}>{demoError}</p>}
                  <div className={pageStyles.skGateDemoActions}>
                    <button
                      type="button"
                      className={pageStyles.skGateDemoSecondary}
                      onClick={() => setDemoOpen(false)}
                    >
                      {t.closeDemoForm}
                    </button>
                    <button
                      type="submit"
                      className={pageStyles.contactSubmit}
                      disabled={demoLoading}
                    >
                      {demoLoading ? t.demoSubmitting : t.demoSubmit}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </div>
      </main>
      <UserFooter />
    </>
  );
}
