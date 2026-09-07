import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

// Status words are matched against the value produced by
// ApduParser.encodeToHexaString(statusCode): lower-case hex, no "0x" prefix.
// The trailing codes carry no status word: they name input the app cannot
// accept, which is rejected before any exchange happens.
export enum HederaErrorCodes {
  INTERNAL_ERROR = "6980",
  USER_REJECTED = "6985",
  INS_NOT_SUPPORTED = "6d00",
  MALFORMED_APDU = "6e00",
  SWAP_CHECKING_FAIL = "b00a",
  EMPTY_TRANSACTION = "empty_transaction",
  TRANSACTION_TOO_LARGE = "transaction_too_large",
  UNSUPPORTED_DERIVATION_PATH = "unsupported_derivation_path",
}

export const HEDERA_APP_ERRORS: CommandErrors<HederaErrorCodes> = {
  "6980": { message: "Internal error" },
  "6985": { message: "User rejected the request on the device" },
  "6d00": { message: "INS not supported" },
  // The app answers 0x6e00 both for a wrong CLA and for a transaction body it
  // cannot parse or does not support.
  "6e00": { message: "Malformed APDU or unsupported transaction" },
  b00a: { message: "Swap validity check failed" },
  empty_transaction: { message: "Transaction is empty" },
  transaction_too_large: { message: "Transaction does not fit in one APDU" },
  unsupported_derivation_path: {
    message: "Derivation path cannot be derived by the app",
  },
};

export class HederaAppCommandError extends DeviceExchangeError<HederaErrorCodes> {
  constructor(args: CommandErrorArgs<HederaErrorCodes>) {
    super({ tag: "HederaAppCommandError", ...args });
  }
}

/** Input the app cannot accept, rejected before anything reaches the device. */
export type HederaInvalidInputCode =
  | HederaErrorCodes.EMPTY_TRANSACTION
  | HederaErrorCodes.TRANSACTION_TOO_LARGE
  | HederaErrorCodes.UNSUPPORTED_DERIVATION_PATH;

/**
 * Raised while building an APDU, so the caller can tell an input it can fix
 * from a rejection coming back from the device.
 */
export class HederaInvalidInputError extends DeviceExchangeError<HederaErrorCodes> {
  constructor(errorCode: HederaInvalidInputCode, message: string) {
    super({ tag: "HederaInvalidInputError", errorCode, message });
  }
}

export const HederaAppCommandErrorFactory = (
  args: CommandErrorArgs<HederaErrorCodes>,
) => new HederaAppCommandError(args);
