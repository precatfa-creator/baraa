// Alternate login identifiers. username is lowercased and must contain a letter so
// an all-digit string is unambiguously an id_code at login; id_code is 6 digits.
// Shared by the create-user validation and the login resolver.
export const USERNAME_RE = /^(?=.*[a-z])[a-z0-9_]{3,30}$/;
export const ID_CODE_RE = /^[0-9]{6}$/;

export const isIdCode = (s: string) => ID_CODE_RE.test(s);
