"use client";

import { useState } from "react";
import {
  emptyAdhikritWarisnamaInputs,
  emptyManjurinamaInputs,
  emptyNivedanInputs,
  NIVEDAN_PETITION_TYPES,
  type AdhikritWarisnamaInputs,
  type ManjurinamaInputs,
  type NivedanInputs,
  type NivedanPetitionType,
  type SadharanWarisnamaInputs,
} from "@/lib/sajilokanun/document-prompts";
import type { WitnessInputs } from "@/lib/sajilokanun/document-prompts/common";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";
import caseChatStyles from "@/components/sajilokanun/CaseChat.module.css";
import { VoiceFillRow } from "@/components/VoiceFillButton";

export type DraftableLegalDocKind =
  | "nivedan_awedan"
  | "adhikrit_warisnama"
  | "sadharan_warisnama"
  | "manjurinama";

export type LegalDocFormLabels = {
  docNivedanFormTitle: string;
  docNivedanFormHint: string;
  docNivedanPetitionType: string;
  docNivedanInjunction: string;
  docNivedanBail: string;
  docNivedanStay: string;
  docNivedanDeadline: string;
  docCourtName: string;
  docCaseNo: string;
  docCaseType: string;
  docPetitionerName: string;
  docPetitionerParents: string;
  docPetitionerAddress: string;
  docPetitionerAgeId: string;
  docOpponentName: string;
  docOpponentAddress: string;
  docFacts: string;
  docLegalGrounds: string;
  docReliefClaimed: string;
  docAttachedEvidence: string;
  docDate: string;
  docCancelDraft: string;
  docGenerateNivedan: string;
  docAdhikritFormTitle: string;
  docAdhikritFormHint: string;
  docSadharanFormTitle: string;
  docSadharanFormHint: string;
  docManjuriFormTitle: string;
  docManjuriFormHint: string;
  docPrincipalName: string;
  docPrincipalAge: string;
  docPrincipalParents: string;
  docPrincipalAddress: string;
  docPrincipalCitizenship: string;
  docAttorneyName: string;
  docAttorneyAge: string;
  docAttorneyParents: string;
  docAttorneyAddress: string;
  docAttorneyCitizenship: string;
  docRelationship: string;
  docPurpose: string;
  docPowers: string;
  docPropertyDetails: string;
  docAuthenticationPlace: string;
  docValidityPeriod: string;
  docWitness1: string;
  docWitness2: string;
  docWitnessName: string;
  docWitnessAddress: string;
  docWitnessCitizenship: string;
  docConsenterName: string;
  docConsenterAge: string;
  docConsenterParents: string;
  docConsenterAddress: string;
  docConsenterCitizenship: string;
  docBeneficiaryName: string;
  docBeneficiaryAddress: string;
  docConsentSubject: string;
  docConsentConditions: string;
  docGenerateAdhikrit: string;
  docGenerateSadharan: string;
  docGenerateManjuri: string;
  generating: string;
};

export type LegalDocCaseDefaults = {
  courtName?: string;
  caseNo?: string;
  caseType?: string;
  partyName?: string;
};

function TextField({
  id,
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={emiStyles.emiField}>
      <label htmlFor={id}>{label}</label>
      <VoiceFillRow onTranscript={onChange}>
        <input
          id={id}
          className={emiStyles.emiNumberInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      </VoiceFillRow>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  required,
  rows = 3,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className={emiStyles.emiField}>
      <label htmlFor={id}>{label}</label>
      <VoiceFillRow onTranscript={onChange}>
        <textarea
          id={id}
          className={emiStyles.emiNumberInput}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      </VoiceFillRow>
    </div>
  );
}

function WitnessFields({
  prefix,
  title,
  labels,
  value,
  onChange,
}: {
  prefix: string;
  title: string;
  labels: LegalDocFormLabels;
  value: WitnessInputs;
  onChange: (next: WitnessInputs) => void;
}) {
  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.65rem",
        border: "1px solid var(--border, #d7e3f4)",
        borderRadius: "0.5rem",
      }}
    >
      <p className={emiStyles.emiFieldHint} style={{ marginBottom: "0.4rem" }}>
        {title}
      </p>
      <div className={emiStyles.emiRow}>
        <TextField
          id={`${prefix}-name`}
          label={labels.docWitnessName}
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
        />
        <TextField
          id={`${prefix}-citizenship`}
          label={labels.docWitnessCitizenship}
          value={value.citizenship}
          onChange={(citizenship) => onChange({ ...value, citizenship })}
        />
      </div>
      <TextField
        id={`${prefix}-address`}
        label={labels.docWitnessAddress}
        value={value.address}
        onChange={(address) => onChange({ ...value, address })}
      />
    </div>
  );
}

function FormActions({
  generating,
  submitLabel,
  cancelLabel,
  onCancel,
}: {
  generating: boolean;
  submitLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className={caseChatStyles.formActions}>
      <button
        type="submit"
        className={pageStyles.contactSubmit}
        disabled={generating}
        style={{ margin: 0 }}
      >
        {submitLabel}
      </button>
      <button
        type="button"
        className={emiStyles.emiGlossaryLink}
        style={{
          background: "none",
          border: "1px solid var(--border, #d7e3f4)",
          borderRadius: "0.5rem",
          cursor: "pointer",
          padding: "0.55rem 0.75rem",
        }}
        onClick={onCancel}
        disabled={generating}
      >
        {cancelLabel}
      </button>
    </div>
  );
}

function NivedanForm({
  labels,
  generating,
  defaults,
  onCancel,
  onGenerate,
}: {
  labels: LegalDocFormLabels;
  generating: boolean;
  defaults: LegalDocCaseDefaults;
  onCancel: () => void;
  onGenerate: (inputs: NivedanInputs) => void;
}) {
  const [form, setForm] = useState<NivedanInputs>(() =>
    emptyNivedanInputs({
      courtName: defaults.courtName ?? "",
      caseNo: defaults.caseNo ?? "",
      caseType: defaults.caseType ?? "",
      petitionerName: defaults.partyName ?? "",
    })
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate(form);
      }}
      className={caseChatStyles.formPanel}
      style={{ marginBottom: "1.25rem" }}
    >
      <h4 className={emiStyles.emiPanelTitle} style={{ marginBottom: "0.35rem" }}>
        {labels.docNivedanFormTitle}
      </h4>
      <p className={emiStyles.emiFieldHint}>{labels.docNivedanFormHint}</p>

      <div className={emiStyles.emiField}>
        <label htmlFor="nivedan-type">{labels.docNivedanPetitionType}</label>
        <select
          id="nivedan-type"
          className={emiStyles.emiNumberInput}
          value={form.petitionType}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              petitionType: e.target.value as NivedanPetitionType,
            }))
          }
          required
        >
          {NIVEDAN_PETITION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === "injunction"
                ? labels.docNivedanInjunction
                : type === "bail"
                  ? labels.docNivedanBail
                  : type === "stay"
                    ? labels.docNivedanStay
                    : labels.docNivedanDeadline}
            </option>
          ))}
        </select>
      </div>

      <div className={emiStyles.emiRow}>
        <TextField
          id="nivedan-court"
          label={labels.docCourtName}
          value={form.courtName}
          onChange={(courtName) => setForm((f) => ({ ...f, courtName }))}
          required
        />
        <TextField
          id="nivedan-case-no"
          label={labels.docCaseNo}
          value={form.caseNo}
          onChange={(caseNo) => setForm((f) => ({ ...f, caseNo }))}
          required
        />
      </div>

      <TextField
        id="nivedan-case-type"
        label={labels.docCaseType}
        value={form.caseType}
        onChange={(caseType) => setForm((f) => ({ ...f, caseType }))}
      />

      <div className={emiStyles.emiRow}>
        <TextField
          id="nivedan-petitioner"
          label={labels.docPetitionerName}
          value={form.petitionerName}
          onChange={(petitionerName) => setForm((f) => ({ ...f, petitionerName }))}
          required
        />
        <TextField
          id="nivedan-parents"
          label={labels.docPetitionerParents}
          value={form.petitionerParents}
          onChange={(petitionerParents) =>
            setForm((f) => ({ ...f, petitionerParents }))
          }
        />
      </div>

      <div className={emiStyles.emiRow}>
        <TextField
          id="nivedan-address"
          label={labels.docPetitionerAddress}
          value={form.petitionerAddress}
          onChange={(petitionerAddress) =>
            setForm((f) => ({ ...f, petitionerAddress }))
          }
        />
        <TextField
          id="nivedan-age"
          label={labels.docPetitionerAgeId}
          value={form.petitionerAgeId}
          onChange={(petitionerAgeId) =>
            setForm((f) => ({ ...f, petitionerAgeId }))
          }
        />
      </div>

      <div className={emiStyles.emiRow}>
        <TextField
          id="nivedan-opponent"
          label={labels.docOpponentName}
          value={form.opponentName}
          onChange={(opponentName) => setForm((f) => ({ ...f, opponentName }))}
        />
        <TextField
          id="nivedan-opponent-address"
          label={labels.docOpponentAddress}
          value={form.opponentAddress}
          onChange={(opponentAddress) =>
            setForm((f) => ({ ...f, opponentAddress }))
          }
        />
      </div>

      <TextAreaField
        id="nivedan-facts"
        label={labels.docFacts}
        value={form.facts}
        onChange={(facts) => setForm((f) => ({ ...f, facts }))}
        required
        rows={4}
      />
      <TextAreaField
        id="nivedan-grounds"
        label={labels.docLegalGrounds}
        value={form.legalGrounds}
        onChange={(legalGrounds) => setForm((f) => ({ ...f, legalGrounds }))}
      />
      <TextAreaField
        id="nivedan-relief"
        label={labels.docReliefClaimed}
        value={form.reliefClaimed}
        onChange={(reliefClaimed) => setForm((f) => ({ ...f, reliefClaimed }))}
        required
        rows={2}
      />
      <TextAreaField
        id="nivedan-evidence"
        label={labels.docAttachedEvidence}
        value={form.attachedEvidence}
        onChange={(attachedEvidence) =>
          setForm((f) => ({ ...f, attachedEvidence }))
        }
        placeholder="१. ...&#10;२. ..."
      />
      <TextField
        id="nivedan-date"
        label={labels.docDate}
        value={form.date ?? ""}
        onChange={(date) => setForm((f) => ({ ...f, date }))}
        placeholder="२०८३/०४/३१"
      />

      <FormActions
        generating={generating}
        submitLabel={generating ? labels.generating : labels.docGenerateNivedan}
        cancelLabel={labels.docCancelDraft}
        onCancel={onCancel}
      />
    </form>
  );
}

function WarisnamaForm({
  variant,
  labels,
  generating,
  defaults,
  onCancel,
  onGenerate,
}: {
  variant: "adhikrit" | "sadharan";
  labels: LegalDocFormLabels;
  generating: boolean;
  defaults: LegalDocCaseDefaults;
  onCancel: () => void;
  onGenerate: (inputs: AdhikritWarisnamaInputs | SadharanWarisnamaInputs) => void;
}) {
  const [form, setForm] = useState<AdhikritWarisnamaInputs>(() =>
    emptyAdhikritWarisnamaInputs({
      courtName: defaults.courtName ?? "",
      caseNo: defaults.caseNo ?? "",
      principalName: defaults.partyName ?? "",
    })
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (variant === "sadharan") {
          onGenerate({
            principalName: form.principalName,
            principalAge: form.principalAge,
            principalParents: form.principalParents,
            principalAddress: form.principalAddress,
            principalCitizenship: form.principalCitizenship,
            attorneyName: form.attorneyName,
            attorneyAge: form.attorneyAge,
            attorneyParents: form.attorneyParents,
            attorneyAddress: form.attorneyAddress,
            attorneyCitizenship: form.attorneyCitizenship,
            relationship: form.relationship,
            purpose: form.purpose,
            powers: form.powers,
            validityPeriod: form.validityPeriod,
            witness1: form.witness1,
            witness2: form.witness2,
            date: form.date,
          } satisfies SadharanWarisnamaInputs);
          return;
        }
        onGenerate(form);
      }}
      className={caseChatStyles.formPanel}
      style={{ marginBottom: "1.25rem" }}
    >
      <h4 className={emiStyles.emiPanelTitle} style={{ marginBottom: "0.35rem" }}>
        {variant === "adhikrit"
          ? labels.docAdhikritFormTitle
          : labels.docSadharanFormTitle}
      </h4>
      <p className={emiStyles.emiFieldHint}>
        {variant === "adhikrit"
          ? labels.docAdhikritFormHint
          : labels.docSadharanFormHint}
      </p>

      <div className={emiStyles.emiRow}>
        <TextField
          id="poa-principal"
          label={labels.docPrincipalName}
          value={form.principalName}
          onChange={(principalName) => setForm((f) => ({ ...f, principalName }))}
          required
        />
        <TextField
          id="poa-principal-age"
          label={labels.docPrincipalAge}
          value={form.principalAge}
          onChange={(principalAge) => setForm((f) => ({ ...f, principalAge }))}
        />
      </div>
      <div className={emiStyles.emiRow}>
        <TextField
          id="poa-principal-parents"
          label={labels.docPrincipalParents}
          value={form.principalParents}
          onChange={(principalParents) =>
            setForm((f) => ({ ...f, principalParents }))
          }
        />
        <TextField
          id="poa-principal-citizenship"
          label={labels.docPrincipalCitizenship}
          value={form.principalCitizenship}
          onChange={(principalCitizenship) =>
            setForm((f) => ({ ...f, principalCitizenship }))
          }
        />
      </div>
      <TextField
        id="poa-principal-address"
        label={labels.docPrincipalAddress}
        value={form.principalAddress}
        onChange={(principalAddress) =>
          setForm((f) => ({ ...f, principalAddress }))
        }
      />

      <div className={emiStyles.emiRow}>
        <TextField
          id="poa-attorney"
          label={labels.docAttorneyName}
          value={form.attorneyName}
          onChange={(attorneyName) => setForm((f) => ({ ...f, attorneyName }))}
          required
        />
        <TextField
          id="poa-attorney-age"
          label={labels.docAttorneyAge}
          value={form.attorneyAge}
          onChange={(attorneyAge) => setForm((f) => ({ ...f, attorneyAge }))}
        />
      </div>
      <div className={emiStyles.emiRow}>
        <TextField
          id="poa-attorney-parents"
          label={labels.docAttorneyParents}
          value={form.attorneyParents}
          onChange={(attorneyParents) =>
            setForm((f) => ({ ...f, attorneyParents }))
          }
        />
        <TextField
          id="poa-attorney-citizenship"
          label={labels.docAttorneyCitizenship}
          value={form.attorneyCitizenship}
          onChange={(attorneyCitizenship) =>
            setForm((f) => ({ ...f, attorneyCitizenship }))
          }
        />
      </div>
      <TextField
        id="poa-attorney-address"
        label={labels.docAttorneyAddress}
        value={form.attorneyAddress}
        onChange={(attorneyAddress) =>
          setForm((f) => ({ ...f, attorneyAddress }))
        }
      />

      <div className={emiStyles.emiRow}>
        <TextField
          id="poa-relationship"
          label={labels.docRelationship}
          value={form.relationship}
          onChange={(relationship) => setForm((f) => ({ ...f, relationship }))}
        />
        <TextField
          id="poa-validity"
          label={labels.docValidityPeriod}
          value={form.validityPeriod}
          onChange={(validityPeriod) =>
            setForm((f) => ({ ...f, validityPeriod }))
          }
        />
      </div>

      <TextAreaField
        id="poa-purpose"
        label={labels.docPurpose}
        value={form.purpose}
        onChange={(purpose) => setForm((f) => ({ ...f, purpose }))}
        rows={2}
      />
      <TextAreaField
        id="poa-powers"
        label={labels.docPowers}
        value={form.powers}
        onChange={(powers) => setForm((f) => ({ ...f, powers }))}
        required
        rows={4}
      />

      {variant === "adhikrit" ? (
        <>
          <div className={emiStyles.emiRow}>
            <TextField
              id="poa-court"
              label={labels.docCourtName}
              value={form.courtName}
              onChange={(courtName) => setForm((f) => ({ ...f, courtName }))}
            />
            <TextField
              id="poa-case-no"
              label={labels.docCaseNo}
              value={form.caseNo}
              onChange={(caseNo) => setForm((f) => ({ ...f, caseNo }))}
            />
          </div>
          <TextAreaField
            id="poa-property"
            label={labels.docPropertyDetails}
            value={form.propertyDetails}
            onChange={(propertyDetails) =>
              setForm((f) => ({ ...f, propertyDetails }))
            }
            rows={2}
          />
          <TextField
            id="poa-auth"
            label={labels.docAuthenticationPlace}
            value={form.authenticationPlace}
            onChange={(authenticationPlace) =>
              setForm((f) => ({ ...f, authenticationPlace }))
            }
          />
        </>
      ) : null}

      <WitnessFields
        prefix="poa-w1"
        title={labels.docWitness1}
        labels={labels}
        value={form.witness1}
        onChange={(witness1) => setForm((f) => ({ ...f, witness1 }))}
      />
      <WitnessFields
        prefix="poa-w2"
        title={labels.docWitness2}
        labels={labels}
        value={form.witness2}
        onChange={(witness2) => setForm((f) => ({ ...f, witness2 }))}
      />
      <TextField
        id="poa-date"
        label={labels.docDate}
        value={form.date ?? ""}
        onChange={(date) => setForm((f) => ({ ...f, date }))}
        placeholder="२०८३/०४/३१"
      />

      <FormActions
        generating={generating}
        submitLabel={
          generating
            ? labels.generating
            : variant === "adhikrit"
              ? labels.docGenerateAdhikrit
              : labels.docGenerateSadharan
        }
        cancelLabel={labels.docCancelDraft}
        onCancel={onCancel}
      />
    </form>
  );
}

function ManjurinamaForm({
  labels,
  generating,
  defaults,
  onCancel,
  onGenerate,
}: {
  labels: LegalDocFormLabels;
  generating: boolean;
  defaults: LegalDocCaseDefaults;
  onCancel: () => void;
  onGenerate: (inputs: ManjurinamaInputs) => void;
}) {
  const [form, setForm] = useState<ManjurinamaInputs>(() =>
    emptyManjurinamaInputs({
      consenterName: defaults.partyName ?? "",
      propertyOrCaseDetails: [defaults.courtName, defaults.caseNo]
        .filter(Boolean)
        .join(" / "),
    })
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate(form);
      }}
      className={caseChatStyles.formPanel}
      style={{ marginBottom: "1.25rem" }}
    >
      <h4 className={emiStyles.emiPanelTitle} style={{ marginBottom: "0.35rem" }}>
        {labels.docManjuriFormTitle}
      </h4>
      <p className={emiStyles.emiFieldHint}>{labels.docManjuriFormHint}</p>

      <div className={emiStyles.emiRow}>
        <TextField
          id="manjuri-name"
          label={labels.docConsenterName}
          value={form.consenterName}
          onChange={(consenterName) => setForm((f) => ({ ...f, consenterName }))}
          required
        />
        <TextField
          id="manjuri-age"
          label={labels.docConsenterAge}
          value={form.consenterAge}
          onChange={(consenterAge) => setForm((f) => ({ ...f, consenterAge }))}
        />
      </div>
      <div className={emiStyles.emiRow}>
        <TextField
          id="manjuri-parents"
          label={labels.docConsenterParents}
          value={form.consenterParents}
          onChange={(consenterParents) =>
            setForm((f) => ({ ...f, consenterParents }))
          }
        />
        <TextField
          id="manjuri-citizenship"
          label={labels.docConsenterCitizenship}
          value={form.consenterCitizenship}
          onChange={(consenterCitizenship) =>
            setForm((f) => ({ ...f, consenterCitizenship }))
          }
        />
      </div>
      <TextField
        id="manjuri-address"
        label={labels.docConsenterAddress}
        value={form.consenterAddress}
        onChange={(consenterAddress) =>
          setForm((f) => ({ ...f, consenterAddress }))
        }
      />

      <div className={emiStyles.emiRow}>
        <TextField
          id="manjuri-beneficiary"
          label={labels.docBeneficiaryName}
          value={form.beneficiaryName}
          onChange={(beneficiaryName) =>
            setForm((f) => ({ ...f, beneficiaryName }))
          }
        />
        <TextField
          id="manjuri-beneficiary-address"
          label={labels.docBeneficiaryAddress}
          value={form.beneficiaryAddress}
          onChange={(beneficiaryAddress) =>
            setForm((f) => ({ ...f, beneficiaryAddress }))
          }
        />
      </div>

      <TextAreaField
        id="manjuri-subject"
        label={labels.docConsentSubject}
        value={form.consentSubject}
        onChange={(consentSubject) => setForm((f) => ({ ...f, consentSubject }))}
        required
        rows={3}
      />
      <TextAreaField
        id="manjuri-details"
        label={labels.docPropertyDetails}
        value={form.propertyOrCaseDetails}
        onChange={(propertyOrCaseDetails) =>
          setForm((f) => ({ ...f, propertyOrCaseDetails }))
        }
        rows={2}
      />
      <TextAreaField
        id="manjuri-conditions"
        label={labels.docConsentConditions}
        value={form.conditions}
        onChange={(conditions) => setForm((f) => ({ ...f, conditions }))}
        rows={2}
      />

      <WitnessFields
        prefix="manjuri-w1"
        title={labels.docWitness1}
        labels={labels}
        value={form.witness1}
        onChange={(witness1) => setForm((f) => ({ ...f, witness1 }))}
      />
      <WitnessFields
        prefix="manjuri-w2"
        title={labels.docWitness2}
        labels={labels}
        value={form.witness2}
        onChange={(witness2) => setForm((f) => ({ ...f, witness2 }))}
      />
      <TextField
        id="manjuri-date"
        label={labels.docDate}
        value={form.date ?? ""}
        onChange={(date) => setForm((f) => ({ ...f, date }))}
        placeholder="२०८३/०४/३१"
      />

      <FormActions
        generating={generating}
        submitLabel={generating ? labels.generating : labels.docGenerateManjuri}
        cancelLabel={labels.docCancelDraft}
        onCancel={onCancel}
      />
    </form>
  );
}

export function LegalDocumentDraftForm({
  kind,
  labels,
  generating,
  defaults,
  onCancel,
  onGenerate,
}: {
  kind: DraftableLegalDocKind;
  labels: LegalDocFormLabels;
  generating: boolean;
  defaults: LegalDocCaseDefaults;
  onCancel: () => void;
  onGenerate: (inputs: unknown) => void;
}) {
  if (kind === "nivedan_awedan") {
    return (
      <NivedanForm
        labels={labels}
        generating={generating}
        defaults={defaults}
        onCancel={onCancel}
        onGenerate={onGenerate}
      />
    );
  }
  if (kind === "adhikrit_warisnama" || kind === "sadharan_warisnama") {
    return (
      <WarisnamaForm
        variant={kind === "adhikrit_warisnama" ? "adhikrit" : "sadharan"}
        labels={labels}
        generating={generating}
        defaults={defaults}
        onCancel={onCancel}
        onGenerate={onGenerate}
      />
    );
  }
  return (
    <ManjurinamaForm
      labels={labels}
      generating={generating}
      defaults={defaults}
      onCancel={onCancel}
      onGenerate={onGenerate}
    />
  );
}
