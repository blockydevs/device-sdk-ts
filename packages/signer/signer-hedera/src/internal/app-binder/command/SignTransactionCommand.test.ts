import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  MAX_TRANSACTION_LENGTH,
  SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import {
  HederaAppCommandError,
  HederaErrorCodes,
  HederaInvalidInputError,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";

const DERIVATION_PATH = "44'/3030'/0'/0'/0'";
const SIGNATURE = new Uint8Array(64).fill(0x11);

describe("SignTransactionCommand", () => {
  describe("getApdu", () => {
    it("should prefix the transaction body with the little-endian key index", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        derivationPath: "44'/3030'/0'/0'/1'",
        transaction: new Uint8Array([0x0a, 0x0b, 0x0c]),
      });
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(
        // prettier-ignore
        new Uint8Array([
          0xe0, 0x04, 0x00, 0x00, 0x07,
          0x01, 0x00, 0x00, 0x00,
          0x0a, 0x0b, 0x0c,
        ]),
      );
    });

    it("should send the app-hardcoded index 0 for the short 44'/3030' path", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        derivationPath: "44'/3030'",
        transaction: new Uint8Array([0xaa, 0xbb, 0xcc]),
      });
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(
        // prettier-ignore
        new Uint8Array([
          0xe0, 0x04, 0x00, 0x00, 0x07,
          0x00, 0x00, 0x00, 0x00,
          0xaa, 0xbb, 0xcc,
        ]),
      );
    });

    it("should accept a transaction that exactly fills the payload", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        derivationPath: DERIVATION_PATH,
        transaction: new Uint8Array(MAX_TRANSACTION_LENGTH).fill(0x01),
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).not.toThrow();
    });

    it("should reject a transaction that does not fit in one APDU", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        derivationPath: DERIVATION_PATH,
        transaction: new Uint8Array(MAX_TRANSACTION_LENGTH + 1).fill(0x01),
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(HederaInvalidInputError);
      expect(() => command.getApdu()).toThrow(
        expect.objectContaining({
          _tag: "HederaInvalidInputError",
          errorCode: HederaErrorCodes.TRANSACTION_TOO_LARGE,
          message: `SignTransactionCommand: transaction is ${
            MAX_TRANSACTION_LENGTH + 1
          } bytes, the app accepts at most ${MAX_TRANSACTION_LENGTH}`,
        }),
      );
    });

    it("should reject an empty transaction", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        derivationPath: DERIVATION_PATH,
        transaction: new Uint8Array(),
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(HederaInvalidInputError);
      expect(() => command.getApdu()).toThrow(
        expect.objectContaining({
          _tag: "HederaInvalidInputError",
          errorCode: HederaErrorCodes.EMPTY_TRANSACTION,
          message: "SignTransactionCommand: transaction is empty",
        }),
      );
    });
  });

  describe("parseResponse", () => {
    const command = new SignTransactionCommand({
      derivationPath: DERIVATION_PATH,
      transaction: new Uint8Array([0x0a]),
    });

    it("should return the 64-byte signature", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGNATURE,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(CommandResultFactory({ data: SIGNATURE }));
    });

    it("should fail on a truncated signature", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(63).fill(0x11),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should map an unsupported transaction body to a Hedera app error", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6e, 0x00]),
        data: new Uint8Array(),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(
        isSuccessCommandResult(result) ? undefined : result.error,
      ).toBeInstanceOf(HederaAppCommandError);
    });
  });
});
