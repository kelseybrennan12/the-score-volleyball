/**
 * Returns true when `effectiveDate <= now < expirationDate`.
 * Any other combination (nulls, expired, not yet active, invalid range) returns false.
 */
export const isCertActive = (
  effectiveDate: string | null | undefined,
  expirationDate: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!effectiveDate || !expirationDate) return false;
  const effective = new Date(effectiveDate);
  const expiration = new Date(expirationDate);
  if (Number.isNaN(effective.getTime()) || Number.isNaN(expiration.getTime())) return false;
  if (effective > expiration) return false;
  return effective <= now && now < expiration;
};
