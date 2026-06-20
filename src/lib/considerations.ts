export const CONSIDERATION_CATEGORIES = [
  {
    slug: "property-construction",
    labelKey: "propertyConstruction",
    descriptionKey: "propertyConstructionDesc",
    icon: "🏠",
    topics: [
      { slug: "buying-land", labelKey: "buyingLand", descriptionKey: "buyingLandDesc" },
      { slug: "building-house", labelKey: "buildingHouse", descriptionKey: "buildingHouseDesc" },
      { slug: "rent-lease", labelKey: "rentLease", descriptionKey: "rentLeaseDesc" },
    ],
  },
  {
    slug: "business-startup",
    labelKey: "businessStartup",
    descriptionKey: "businessStartupDesc",
    icon: "🏢",
    topics: [
      {
        slug: "company-registration",
        labelKey: "companyRegistration",
        descriptionKey: "companyRegistrationDesc",
      },
      { slug: "partnership", labelKey: "partnership", descriptionKey: "partnershipDesc" },
      {
        slug: "local-level-registration",
        labelKey: "localLevelRegistration",
        descriptionKey: "localLevelRegistrationDesc",
      },
    ],
  },
  {
    slug: "banking-loans",
    labelKey: "bankingLoans",
    descriptionKey: "bankingLoansDesc",
    icon: "🏦",
    topics: [
      { slug: "taking-loan", labelKey: "takingLoan", descriptionKey: "takingLoanDesc" },
      { slug: "guarantor", labelKey: "guarantor", descriptionKey: "guarantorDesc" },
    ],
  },
  {
    slug: "family-personal-law",
    labelKey: "familyPersonalLaw",
    descriptionKey: "familyPersonalLawDesc",
    icon: "👨‍👩‍👧",
    topics: [
      {
        slug: "property-partition",
        labelKey: "propertyPartition",
        descriptionKey: "propertyPartitionDesc",
      },
      {
        slug: "power-of-attorney",
        labelKey: "powerOfAttorney",
        descriptionKey: "powerOfAttorneyDesc",
      },
    ],
  },
  {
    slug: "foreign-employment-study",
    labelKey: "foreignEmploymentStudy",
    descriptionKey: "foreignEmploymentStudyDesc",
    icon: "✈️",
    topics: [
      {
        slug: "foreign-employment",
        labelKey: "foreignEmployment",
        descriptionKey: "foreignEmploymentDesc",
      },
      { slug: "study-abroad", labelKey: "studyAbroad", descriptionKey: "studyAbroadDesc" },
    ],
  },
] as const;

export type ConsiderationCategorySlug = (typeof CONSIDERATION_CATEGORIES)[number]["slug"];

type CategoryDef = (typeof CONSIDERATION_CATEGORIES)[number];
type TopicDef = CategoryDef["topics"][number];

export type ConsiderationTopicSlug = TopicDef["slug"];

export type ConsiderationCategoryLabelKey = CategoryDef["labelKey"];
export type ConsiderationCategoryDescriptionKey = CategoryDef["descriptionKey"];
export type ConsiderationTopicLabelKey = TopicDef["labelKey"];
export type ConsiderationTopicDescriptionKey = TopicDef["descriptionKey"];

export function getConsiderationCategories() {
  return CONSIDERATION_CATEGORIES;
}

export function getConsiderationCategory(slug: string) {
  return CONSIDERATION_CATEGORIES.find((c) => c.slug === slug);
}

export function getConsiderationTopic(categorySlug: string, topicSlug: string) {
  const category = getConsiderationCategory(categorySlug);
  if (!category) return null;
  const topic = category.topics.find((t) => t.slug === topicSlug);
  if (!topic) return null;
  return { category, topic };
}

export function getAllConsiderationTopics() {
  return CONSIDERATION_CATEGORIES.flatMap((category) =>
    category.topics.map((topic) => ({ category, topic }))
  );
}

export function getConsiderationTopicCount(): number {
  return getAllConsiderationTopics().length;
}

export function considerationTopicPath(categorySlug: string, topicSlug: string): string {
  return `/considerations/${categorySlug}/${topicSlug}`;
}

export function considerationCategoryPath(categorySlug: string): string {
  return `/considerations/${categorySlug}`;
}

export function isConsiderationCategorySlug(slug: string): slug is ConsiderationCategorySlug {
  return CONSIDERATION_CATEGORIES.some((c) => c.slug === slug);
}
