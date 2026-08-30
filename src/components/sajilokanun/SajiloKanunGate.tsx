"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import { citizenRegister, setToken } from "@/lib/auth";
import {
  getDemoSessionId,
  hasSajiloKanunToken,
  hasSubmittedDemoThisSession,
  loginSajiloKanun,
  sajiloKanunPostLoginPath,
  setSajiloKanunToken,
  submitDemoRequest,
} from "@/lib/sajilokanun-access";
import { AiDisclaimerNote } from "@/components/sajilokanun/AiDisclaimerNote";
import pageStyles from "@/app/user.module.css";
import emiStyles from "@/components/user/emi.module.css";

export function SajiloKanunGate() {
  const router = useRouter();
  const { locale, msg } = useLanguage();
  const t = msg.sajilokanun;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [acceptedAiDisclaimer, setAcceptedAiDisclaimer] = useState(false);

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
      router.replace(sajiloKanunPostLoginPath());
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      const mapped =
        error === "oauth_cancelled"
          ? t.oauthCancelled
          : error === "oauth_failed"
            ? t.oauthFailed
            : error === "google_not_configured"
              ? t.oauthNotConfigured
              : error === "use_admin_login"
                ? t.oauthUseAdminLogin
                : error === "admin_only"
                  ? t.oauthAdminOnly
                  : error === "citizen_only"
                    ? t.oauthCitizenOnly
                    : error;
      setLoginError(mapped);
    }
    const hash = window.location.hash.replace("#", "");
    const wantsDemo =
      hash === "demo" || params.has("demo");
    if (wantsDemo) setDemoOpen(true);
    if (params.get("intent") === "user") setAuthMode("signin");
  }, [t.oauthAdminOnly, t.oauthCancelled, t.oauthCitizenOnly, t.oauthFailed, t.oauthNotConfigured, t.oauthUseAdminLogin]);

  useEffect(() => {
    if (hasSubmittedDemoThisSession()) {
      setDemoStatus("already");
    }
  }, []);

  function requireDisclaimer(): boolean {
    if (acceptedAiDisclaimer) return true;
    setLoginError(t.aiDisclaimerMustAccept);
    return false;
  }

  function handleGoogleSignIn() {
    if (!requireDisclaimer()) return;
    window.location.href = "/api/auth/google";
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!requireDisclaimer()) return;
    setLoginLoading(true);
    try {
      if (authMode === "signup") {
        const result = await citizenRegister({
          name: signupName.trim(),
          email: username.trim(),
          password,
        });
        setToken(result.token);
        setSajiloKanunToken(result.sajiloKanunToken);
        router.push("/sajilokanun/chat");
        router.refresh();
        return;
      }

      const result = await loginSajiloKanun(username.trim(), password);
      router.push(
        result.kind === "platform" || result.kind === "citizen"
          ? result.redirect
          : sajiloKanunPostLoginPath()
      );
      router.refresh();
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
      <section className={pageStyles.calculatorPage}>
        <div className={`${pageStyles.calculatorPageInner} ${emiStyles.emiPageInner}`}>
          <Link href="/sajilokanun" className={pageStyles.calculatorBack}>
            ← {t.loginBack}
          </Link>

          <header className={emiStyles.emiHeader}>
            <h1>{t.gateTitle}</h1>
            <p className={pageStyles.calculatorSubtitle}>{t.gateSubtitle}</p>
          </header>

          <ul className={pageStyles.skGateFeatures} style={{ marginBottom: "1.5rem" }}>
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <AiDisclaimerNote
            text={t.aiDisclaimerShort}
            termsLabel={t.aiDisclaimerTermsLink}
          />

          <div className={emiStyles.emiLayout}>
            <section className={emiStyles.emiPanel}>
              <h2 className={emiStyles.emiPanelTitle}>{t.loginTitle}</h2>
              <div className={`${emiStyles.emiFadeCard} ${emiStyles.emiFormSection}`}>
                <label htmlFor="sk-ai-disclaimer" className={pageStyles.skGateDisclaimer}>
                  <input
                    id="sk-ai-disclaimer"
                    type="checkbox"
                    checked={acceptedAiDisclaimer}
                    onChange={(e) => {
                      setAcceptedAiDisclaimer(e.target.checked);
                      if (e.target.checked) setLoginError("");
                    }}
                    required
                  />
                  <span>
                    {t.aiDisclaimerAccept}{" "}
                    <Link href="/terms">{t.aiDisclaimerTermsLink}</Link>
                  </span>
                </label>
                <button
                  type="button"
                  className={pageStyles.skGateGoogle}
                  onClick={handleGoogleSignIn}
                  disabled={!acceptedAiDisclaimer}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.97 10.97 0 0 0 12 23Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
                    />
                  </svg>
                  {t.continueWithGoogle}
                </button>
                <p className={pageStyles.skGateDivider}>{t.orUsePassword}</p>
                <div className={pageStyles.skGateModeTabs} role="tablist" aria-label={t.loginTitle}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === "signin"}
                    className={
                      authMode === "signin" ? pageStyles.skGateModeTabActive : pageStyles.skGateModeTab
                    }
                    onClick={() => setAuthMode("signin")}
                  >
                    {t.loginTitle}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === "signup"}
                    className={
                      authMode === "signup" ? pageStyles.skGateModeTabActive : pageStyles.skGateModeTab
                    }
                    onClick={() => setAuthMode("signup")}
                  >
                    {t.createAccount}
                  </button>
                </div>
                <form className={pageStyles.skGateForm} onSubmit={handleLogin}>
                  {authMode === "signup" ? (
                    <div className={emiStyles.emiField}>
                      <label htmlFor="sk-signup-name">{t.demoNameLabel}</label>
                      <input
                        id="sk-signup-name"
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder={t.demoNamePlaceholder}
                        className={emiStyles.emiNumberInput}
                        autoComplete="name"
                        required
                      />
                    </div>
                  ) : null}
                  <div className={emiStyles.emiField}>
                    <label htmlFor="sk-username">
                      {authMode === "signup" ? t.demoEmailLabel : t.usernameLabel}
                    </label>
                    <input
                      id="sk-username"
                      type={authMode === "signup" ? "email" : "text"}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={
                        authMode === "signup" ? t.demoEmailPlaceholder : t.usernamePlaceholder
                      }
                      className={emiStyles.emiNumberInput}
                      autoComplete={authMode === "signup" ? "email" : "username"}
                      required
                    />
                  </div>
                  <div className={emiStyles.emiField}>
                    <label htmlFor="sk-password">{t.passwordLabel}</label>
                    <input
                      id="sk-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className={emiStyles.emiNumberInput}
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      minLength={authMode === "signup" ? 8 : undefined}
                      required
                    />
                  </div>
                  {loginError && <p className={pageStyles.contactError}>{loginError}</p>}
                  <button
                    type="submit"
                    className={pageStyles.contactSubmit}
                    disabled={loginLoading || !acceptedAiDisclaimer}
                  >
                    {loginLoading
                      ? t.loginSubmitting
                      : authMode === "signup"
                        ? t.createAccount
                        : t.loginSubmit}
                  </button>
                </form>
              </div>
            </section>

            <section className={emiStyles.emiPanel} id="demo">
              <h2 className={emiStyles.emiPanelTitle}>{t.demoTitle}</h2>
              <div className={`${emiStyles.emiFadeCard} ${emiStyles.emiFormSection}`}>
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
                    <div className={emiStyles.emiField}>
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
                    <div className={emiStyles.emiField}>
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
                    <div className={emiStyles.emiField}>
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
                    <div className={emiStyles.emiField}>
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
                    <div className={emiStyles.emiField}>
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
              </div>
            </section>
          </div>
        </div>
      </section>
      <UserFooter showContact={false} />
    </>
  );
}
