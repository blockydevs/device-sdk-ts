import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";

describe("GetAppConfigurationCommand", () => {
  let command: GetAppConfigurationCommand;

  beforeEach(() => {
    command = new GetAppConfigurationCommand();
  });

  describe("getApdu", () => {
    it("should build CLA=0xe0 INS=0x01 with no data", () => {
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should skip the reserved byte and read the version", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x01, 0x04, 0x02]),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { version: "1.4.2" },
        }),
      );
    });

    it("should fail on a truncated response", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x01]),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract app config"),
        }),
      );
    });

    it("should surface a device error status word", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6d, 0x00]),
        data: new Uint8Array(),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
