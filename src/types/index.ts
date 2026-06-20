export type Locale = "en" | "ne";

export interface LocalizedText {
  en: string;
  ne: string;
}

export type Category =
  | "citizenship"
  | "local-government"
  | "revenue"
  | "health"
  | "education"
  | "business"
  | "legal";

export type Status = "published" | "draft";

export interface Term {
  id: string;
  name: LocalizedText;
  category: Category;
  definition: LocalizedText;
  lastUpdated: string;
  status: Status;
}

export interface Template {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  category: Category;
  fileName: string;
  fileType: "docx" | "pdf";
  downloads: number;
  uploaded: string;
  status: Status;
  previewEmoji: string;
  previewGradient: string;
}

export interface CategoryCard {
  id: string;
  icon: string;
  iconColor: "blue" | "green" | "amber" | "teal";
  title: LocalizedText;
  description: LocalizedText;
}

export interface Stats {
  termsCount: number;
  templatesCount: number;
  departmentsCount: number;
  monthlySearches: number;
  templateDownloads: number;
}

export interface QuickTag {
  en: string;
  ne: string;
}

export type FeedbackStatus = "new" | "reviewed";

export interface Feedback {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  message: string;
  locale: Locale;
  status: FeedbackStatus;
  reviewedAt: string | null;
  createdAt: string;
}

export type UserType = "user" | "advocate" | "admin";

export type ConsultationStatus =
  | "payment_pending"
  | "pending_selected"
  | "open_pool"
  | "accepted"
  | "completed"
  | "cancelled"
  | "expired"
  | "refunded";

export type AdvocateStatus = "pending" | "approved" | "rejected" | "suspended";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  userType: UserType;
  avatarUrl?: string;
  phone?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface AdvocateProfile {
  id: string;
  userId: string;
  firmName: string;
  advocateName: string;
  specialties: string[];
  provinces: string[];
  districts: string[];
  mobile?: string;
  whatsapp?: string;
  viber?: string;
  bio?: string;
  status: AdvocateStatus;
  approvedAt?: string;
}

export interface ConsultationRequest {
  id: string;
  userId: string;
  name: string;
  specialty: string;
  province: string;
  district: string;
  particulars: string;
  contactNo?: string;
  whatsapp?: string;
  viber?: string;
  selectedAdvocateIds: string[];
  feeNpr: number;
  durationMinutes: number;
  status: ConsultationStatus;
  acceptedByAdvocateId?: string;
  acceptedAt?: string;
  poolOpenedAt?: string;
  selectedWindowEndsAt?: string;
  contactRevealedAt?: string;
  paidAt?: string;
  createdAt?: string;
  advocateContact?: {
    mobile?: string;
    whatsapp?: string;
    viber?: string;
    advocateName?: string;
    firmName?: string;
  };
  paymentStatus?: string;
  acceptedAdvocate?: { name: string; firm: string };
}

export interface ConsultationEvent {
  id: string;
  requestId: string;
  actorType: string;
  actorId?: string;
  event: string;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

export interface ProvinceData {
  name: string;
  nameNe: string;
  districts: string[];
}

export interface Specialty {
  id: string;
  labelEn: string;
  labelNe: string;
}

export const CONSULT_FEE_NPR = 1000;

export interface Lawyer {
  id: string;
  firmName: LocalizedText;
  lawyerName: LocalizedText;
  officeLocation: LocalizedText;
  rating: number;
  ratingCount: number;
  status: Status;
}
