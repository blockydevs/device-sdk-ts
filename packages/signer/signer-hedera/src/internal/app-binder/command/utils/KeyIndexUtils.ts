import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  HederaErrorCodes,
  HederaInvalidInputError,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";
import { KEY_INDEX_LENGTH } from "@internal/app-binder/constants";

const HARDENED = 0x80000000;

/**
 * The device app hardcodes the path as m/44'/3030'/0'/0'/index' and takes the
 * index alone, so only paths that fit that shape can be honoured.
 *
 * Two shapes are accepted:
 * - `44'/3030'/0'/0'/index'`, the full path, index taken from the last element.
 * - `44'/3030'`, the shape Ledger Live's `hederaBip44` derivation mode sends,
 *   for which the app assumes index 0.
 *
 * A leading `m/` is optional. Hardening is ignored: the app hardens every
 * element itself, and Ledger Live writes this path unhardened as `44/3030`.
 *
 * @throws HederaInvalidInputError when the path does not fit that shape
 */
export function keyIndexFromDerivationPath(derivationPath: string): number {
  const shapeError = () =>
    new HederaInvalidInputError(
      HederaErrorCodes.UNSUPPORTED_DERIVATION_PATH,
      `Hedera derivation path must be 44'/3030' or 44'/3030'/0'/0'/index', got "${derivationPath}"`,
    );

  const path = derivationPath.replace(/^m\//, "");

  let elements: number[];
  try {
    elements = DerivationPathUtils.splitPath(path).map(
      (element) => element & ~HARDENED,
    );
  } catch {
    throw shapeError();
  }

  if (elements[0] !== 44 || elements[1] !== 3030) {
    throw shapeError();
  }

  if (elements.length === 2) {
    return 0;
  }

  const index = elements[4];

  if (
    elements.length !== 5 ||
    elements[2] !== 0 ||
    elements[3] !== 0 ||
    index === undefined
  ) {
    throw shapeError();
  }

  return index;
}

/** The app reads the key index with U4LE, so it goes on the wire little-endian. */
export function encodeKeyIndex(keyIndex: number): Uint8Array {
  const encoded = new Uint8Array(KEY_INDEX_LENGTH);
  new DataView(encoded.buffer).setUint32(0, keyIndex, true);
  return encoded;
}
