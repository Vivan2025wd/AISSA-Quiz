// lib/admin-session.ts
// -----------------------------------------------------------------------------
// Session-scoped admin verification helpers.
//
// After a user proves they know the admin access code (via
// verify_admin_code RPC), we mark the CURRENT BROWSER TAB as
// "admin-verified". The flag is:
//
//   • scoped to sessionStorage  → cleared when the tab closes
//   • bound to the user id      → Admin A's flag can't leak to Admin B
//   • timestamped              → AdminGuard rejects flags > 30 min old
//
// All three keys are managed together through the helpers below so
// the login page and AdminGuard never drift out of sync.
// -----------------------------------------------------------------------------

export const KEY_VERIFIED     = "aissa_admin_verified";
export const KEY_VERIFIED_UID = "aissa_admin_verified_uid";
export const KEY_VERIFIED_AT  = "aissa_admin_verified_at";

/** How long a verification flag stays valid, in milliseconds. */
export const ADMIN_VERIFICATION_MAX_AGE_MS = 30 * 60 * 1000; // 30 min

/** Clear every admin-session key at once. Safe on the server too. */
export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_VERIFIED);
  sessionStorage.removeItem(KEY_VERIFIED_UID);
  sessionStorage.removeItem(KEY_VERIFIED_AT);
}

/** Record that THIS tab has passed the admin code step for this user. */
export function markAdminVerified(userId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_VERIFIED, "true");
  sessionStorage.setItem(KEY_VERIFIED_UID, userId);
  sessionStorage.setItem(KEY_VERIFIED_AT, Date.now().toString());
}

/**
 * Read + validate the current tab's admin-verification state.
 * Returns true only when the flag is present, matches `userId`, and
 * is fresh enough.
 */
export function isAdminVerificationValid(userId: string): boolean {
  if (typeof window === "undefined") return false;

  const verified    = sessionStorage.getItem(KEY_VERIFIED) === "true";
  const verifiedUid = sessionStorage.getItem(KEY_VERIFIED_UID);
  const atStr       = sessionStorage.getItem(KEY_VERIFIED_AT);
  const at          = Number(atStr ?? "0");

  const isSameUser = verifiedUid === userId;
  const isFresh =
    Number.isFinite(at) &&
    at > 0 &&
    Date.now() - at < ADMIN_VERIFICATION_MAX_AGE_MS;

  return verified && isSameUser && isFresh;
}