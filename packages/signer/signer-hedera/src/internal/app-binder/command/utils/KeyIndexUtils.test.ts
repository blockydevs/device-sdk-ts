import {
  HederaErrorCodes,
  HederaInvalidInputError,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";
import {
  encodeKeyIndex,
  keyIndexFromDerivationPath,
} from "@internal/app-binder/command/utils/KeyIndexUtils";

describe("keyIndexFromDerivationPath", () => {
  it("should take the index from the last element of a full path", () => {
    expect(keyIndexFromDerivationPath("44'/3030'/0'/0'/7'")).toBe(7);
  });

  it("should ignore hardening, which Ledger Live omits", () => {
    expect(keyIndexFromDerivationPath("44/3030/0/0/7")).toBe(7);
  });

  it("should assume index 0 for the hederaBip44 path", () => {
    expect(keyIndexFromDerivationPath("44/3030")).toBe(0);
    expect(keyIndexFromDerivationPath("44'/3030'")).toBe(0);
  });

  it("should accept a path written with a leading m/", () => {
    expect(keyIndexFromDerivationPath("m/44'/3030'/0'/0'/7'")).toBe(7);
  });

  it.each([
    ["44'/60'/0'/0'/0'", "another coin type"],
    ["44'/3030'/0'", "too few elements"],
    ["44'/3030'/0'/0'/0'/0'", "too many elements"],
    ["44'/3030'/1'/0'/0'", "a non-zero account element"],
    ["44'/3030'/0'/1'/0'", "a non-zero change element"],
    ["44'/3030'/0'/0'/index'", "a non-numeric element"],
    ["m/m/44'/3030'", "a second m/ segment"],
  ])("should reject %s: %s", (path) => {
    expect(() => keyIndexFromDerivationPath(path)).toThrow(
      HederaInvalidInputError,
    );
    expect(() => keyIndexFromDerivationPath(path)).toThrow(
      expect.objectContaining({
        _tag: "HederaInvalidInputError",
        errorCode: HederaErrorCodes.UNSUPPORTED_DERIVATION_PATH,
        message: `Hedera derivation path must be 44'/3030' or 44'/3030'/0'/0'/index', got "${path}"`,
      }),
    );
  });
});

describe("encodeKeyIndex", () => {
  it("should encode the index little-endian over 4 bytes", () => {
    expect(encodeKeyIndex(0)).toStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00]),
    );
    expect(encodeKeyIndex(1)).toStrictEqual(
      new Uint8Array([0x01, 0x00, 0x00, 0x00]),
    );
    expect(encodeKeyIndex(0x01020304)).toStrictEqual(
      new Uint8Array([0x04, 0x03, 0x02, 0x01]),
    );
  });
});
