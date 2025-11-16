export const DEMO_OWNER_PRIVATE_KEY = "EKEjU7M5XngsNrRZ4LGYyVh5SqRuoGQUamrgoxB9jX7SY4VXRpZS";
export const DEMO_ISSUER_PRIVATE_KEY = "EKEg9DJQBhB8W49Wgf9hZrPetk2cYPXhhLxDUkAwvh5cxUAFLnqy";

export const demoIdentity = {
  fullName: "Avery Basalt",
  dateOfBirthMs: Date.UTC(2000, 5, 18),
  nationality: "AT",
  residency: "DE",
  emailDomain: "minabadges.dev",
  kycTier: 3,
  sanctionsCleared: true,
  emailVerified: true,
  uniqueHash: "1252491981754763847348342345234"
};

export const EU_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
];

export const badgeCatalog = [
  {
    id: "age-16",
    label: "Age 16+",
    description: "Unlock teen-rated experiences.",
    icon: "UserRoundCheck",
    tone: "light",
    rules: [{ type: "age", minYears: 16 }]
  },
  {
    id: "age-18",
    label: "Age 18+",
    description: "Required for mature surfaces.",
    icon: "ShieldCheck",
    tone: "bold",
    rules: [{ type: "age", minYears: 18 }]
  },
  {
    id: "age-21",
    label: "Age 21+",
    description: "Compliance for US beverages / venues.",
    icon: "ShieldCheck",
    tone: "bold",
    rules: [{ type: "age", minYears: 21 }]
  },
  {
    id: "non-us",
    label: "Non-US Person",
    description: "Exclude US nationals for token sales.",
    icon: "Globe",
    tone: "light",
    rules: [{ type: "nationality", disallowed: ["US"] }]
  },
  {
    id: "eu-resident",
    label: "EU Residency",
    description: "GDPR-protected participants only.",
    icon: "Globe2",
    tone: "light",
    rules: [{ type: "residency", allowed: EU_COUNTRIES }]
  },
  {
    id: "allowed-country",
    label: "Preferred Countries",
    description: "Whitelist CA / DE / JP",
    icon: "MapPin",
    tone: "light",
    rules: [{ type: "residency", allowed: ["CA", "DE", "JP"] }]
  },
  {
    id: "kyc-basic",
    label: "KYC Tier 1",
    description: "Minimum ID submission.",
    icon: "IdCard",
    tone: "light",
    rules: [{ type: "kyc-tier", minTier: 1 }]
  },
  {
    id: "kyc-advanced",
    label: "KYC Tier 2",
    description: "Enhanced diligence completed.",
    icon: "IdCard",
    tone: "bold",
    rules: [{ type: "kyc-tier", minTier: 2 }]
  },
  {
    id: "sanctions-clear",
    label: "Sanctions Screen",
    description: "OFAC / global watchlists cleared.",
    icon: "Shield",
    tone: "light",
    rules: [{ type: "sanctions-clear" }]
  },
  {
    id: "email-verified",
    label: "Email Verified",
    description: "Inbox confirmed via zk-email.",
    icon: "MailCheck",
    tone: "light",
    rules: [{ type: "email-verified" }]
  },
  {
    id: "email-domain",
    label: "Company Email",
    description: "Only minabadges.dev staff.",
    icon: "Mail",
    tone: "light",
    rules: [{ type: "email-domain", allowedDomains: ["minabadges.dev"] }]
  },
  {
    id: "proof-of-unique",
    label: "Unique Human",
    description: "Sybil-resistant hash bound.",
    icon: "Fingerprint",
    tone: "bold",
    rules: [{ type: "unique-hash" }]
  }
];
