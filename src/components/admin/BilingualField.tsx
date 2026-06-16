import styles from "@/app/admin.module.css";

interface BilingualFieldProps {
  label: string;
  enValue: string;
  neValue: string;
  onEnChange: (value: string) => void;
  onNeChange: (value: string) => void;
  enPlaceholder?: string;
  nePlaceholder?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
}

export function BilingualField({
  label,
  enValue,
  neValue,
  onEnChange,
  onNeChange,
  enPlaceholder,
  nePlaceholder,
  multiline = false,
  rows = 2,
  required = true,
}: BilingualFieldProps) {
  const Input = multiline ? "textarea" : "input";

  return (
    <div className={styles.bilingualField}>
      <label className={styles.bilingualLabel}>{label}</label>
      <div className={styles.bilingualRow}>
        <div className={styles.formGroup}>
          <label>English</label>
          <Input
            value={enValue}
            onChange={(e) => onEnChange(e.target.value)}
            placeholder={enPlaceholder}
            required={required}
            {...(multiline ? { rows } : { type: "text" })}
          />
        </div>
        <div className={styles.formGroup}>
          <label>नेपाली</label>
          <Input
            value={neValue}
            onChange={(e) => onNeChange(e.target.value)}
            placeholder={nePlaceholder}
            required={required}
            {...(multiline ? { rows } : { type: "text" })}
          />
        </div>
      </div>
    </div>
  );
}

export const ADMIN_CATEGORIES = [
  { value: "citizenship", label: "Citizenship" },
  { value: "local-government", label: "Local government" },
  { value: "revenue", label: "Revenue" },
  { value: "health", label: "Health" },
  { value: "education", label: "Education" },
  { value: "business", label: "Business" },
  { value: "legal", label: "Legal" },
] as const;
