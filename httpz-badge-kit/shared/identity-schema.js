import { Credential, DynamicString } from "mina-attestations";
import { Bool, Field, UInt64 } from "o1js";

export const Strings = {
  name: DynamicString({ maxLength: 80 }),
  country: DynamicString({ maxLength: 2 }),
  domain: DynamicString({ maxLength: 120 })
};

export const IdentityCredential = Credential.Native({
  fullName: Strings.name,
  nationality: Strings.country,
  residency: Strings.country,
  dateOfBirthMs: UInt64,
  kycTier: UInt64,
  sanctionsCleared: Bool,
  emailDomain: Strings.domain,
  emailVerified: Bool,
  uniqueHash: Field
});

export const MILLIS_PER_YEAR = BigInt(365 * 24 * 60 * 60 * 1000);
