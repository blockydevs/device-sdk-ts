export const APP_NAME = "Hedera";

export const CLA = 0xe0;

export const INS = {
  GET_APP_CONFIGURATION: 0x01,
  GET_PUBLIC_KEY: 0x02,
  SIGN_TRANSACTION: 0x04,
} as const;

/** P1 for GET_PUBLIC_KEY: 0x00 shows the key on the device, 0x01 stays silent. */
export const P1_CONFIRM = 0x00;
export const P1_NON_CONFIRM = 0x01;

export const P2_UNUSED = 0x00;

/** Raw Ed25519 public key returned by GET_PUBLIC_KEY. */
export const PUBLIC_KEY_LENGTH = 32;

/** Raw Ed25519 signature returned by SIGN_TRANSACTION. */
export const SIGNATURE_LENGTH = 64;

/** Little-endian key index that prefixes the GET_PUBLIC_KEY and SIGN_TRANSACTION payloads. */
export const KEY_INDEX_LENGTH = 4;
