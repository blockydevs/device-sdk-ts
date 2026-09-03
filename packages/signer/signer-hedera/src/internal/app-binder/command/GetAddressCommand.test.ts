import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import {
  HederaAppCommandError,
  HederaErrorCodes,
  HederaInvalidInputError,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";

const PUBLIC_KEY = new Uint8Array(32).fill(0xab);

describe("GetAddressCommand", () => {
  describe("getApdu", () => {
    it("should send the key index little-endian and P1=0x01 when not checking on device", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/3030'/0'/0'/258'",
        checkOnDevice: false,
      });
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x02, 0x01, 0x00, 0x04, 0x02, 0x01, 0x00, 0x00]),
      );
    });

    it("should use P1=0x00 when the key must be shown on device", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/3030'/0'/0'/0'",
        checkOnDevice: true,
      });
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x02, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00]),
      );
    });

    it("should reject a path the app cannot derive", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/60'/0'/0'/0'",
        checkOnDevice: false,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(HederaInvalidInputError);
      expect(() => command.getApdu()).toThrow(
        expect.objectContaining({
          _tag: "HederaInvalidInputError",
          errorCode: HederaErrorCodes.UNSUPPORTED_DERIVATION_PATH,
        }),
      );
    });
  });

  describe("parseResponse", () => {
    const command = new GetAddressCommand({
      derivationPath: "44'/3030'/0'/0'/0'",
      checkOnDevice: false,
    });

    it("should return the public key as hex", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: PUBLIC_KEY,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(
        CommandResultFactory({ data: { publicKey: "ab".repeat(32) } }),
      );
    });

    it("should fail when the key is shorter than 32 bytes", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(31).fill(0xab),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should map a rejection on device to a Hedera app error", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array(),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      expect(
        isSuccessCommandResult(result) ? undefined : result.error,
      ).toBeInstanceOf(HederaAppCommandError);
    });
  });
});
