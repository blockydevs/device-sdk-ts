import { bufferToHexaString } from "@ledgerhq/device-management-kit";

/**
 * Walks the XRPL binary format with the same type-length rules as app-xrp
 * 2.9.0 (`read_field_value` in `src/xrp/xrp_parse.c`).
 */

const TYPE_UINT16 = 1;
const TYPE_UINT32 = 2;
const TYPE_UINT64 = 3;
const TYPE_HASH128 = 4;
const TYPE_HASH256 = 5;
const TYPE_AMOUNT = 6;
const TYPE_BLOB = 7;
const TYPE_ACCOUNT = 8;
const TYPE_OBJECT = 14;
const TYPE_ARRAY = 15;
const TYPE_UINT8 = 16;
const TYPE_PATHSET = 18;
const TYPE_VECTOR256 = 19;
const TYPE_HASH192 = 21;
const TYPE_ISSUE = 24;

const FIXED_LENGTHS: Record<number, number> = {
  [TYPE_UINT8]: 1,
  [TYPE_UINT16]: 2,
  [TYPE_UINT32]: 4,
  [TYPE_UINT64]: 8,
  [TYPE_HASH128]: 16,
  [TYPE_HASH192]: 24,
  [TYPE_HASH256]: 32,
};

const MPTOKEN_ISSUANCE_ID_FIELD = 1;
const ISSUANCE_ID_LENGTH = 24;

const AMOUNT_IOU_BIT = 0x80;
const AMOUNT_MPT_BIT = 0x20;
const XRP_AMOUNT_LENGTH = 8;
const MPT_AMOUNT_LENGTH = 33;
const IOU_AMOUNT_LENGTH = 48;
const MPT_ISSUANCE_ID_OFFSET = 9;

const PATH_END = 0x00;
const PATH_BOUNDARY = 0xff;
const PATH_STEP_ACCOUNT = 0x01;
const PATH_STEP_CURRENCY = 0x10;
const PATH_STEP_ISSUER = 0x20;
const PATH_STEP_FLAGS =
  PATH_STEP_ACCOUNT | PATH_STEP_CURRENCY | PATH_STEP_ISSUER;
const PATH_STEP_PART_LENGTH = 20;

const ISSUE_CURRENCY_LENGTH = 20;
const ISSUE_LENGTH = 40;

type FieldHeader = { typeCode: number; fieldCode: number; next: number };

function readFieldHeader(
  bytes: Uint8Array,
  offset: number,
): FieldHeader | undefined {
  const first = bytes[offset];
  if (typeof first !== "number") return undefined;

  let typeCode = first >> 4;
  let fieldCode = first & 0x0f;
  let next = offset + 1;

  if (typeCode === 0) {
    typeCode = bytes[next] ?? 0;
    next++;
  }

  if (fieldCode === 0) {
    fieldCode = bytes[next] ?? 0;
    next++;
  }

  if (typeCode === 0 || fieldCode === 0) return undefined;

  return { typeCode, fieldCode, next };
}

function readVariableLength(
  bytes: Uint8Array,
  offset: number,
): { length: number; next: number } | undefined {
  const b1 = bytes[offset];
  if (typeof b1 !== "number") return undefined;
  if (b1 <= 192) {
    return { length: b1, next: offset + 1 };
  }

  const b2 = bytes[offset + 1];
  if (typeof b2 !== "number") return undefined;
  if (b1 <= 240) {
    return { length: 193 + (b1 - 193) * 256 + b2, next: offset + 2 };
  }

  const b3 = bytes[offset + 2];
  if (typeof b3 !== "number" || b1 > 254) return undefined;

  return {
    length: 12481 + (b1 - 241) * 65536 + b2 * 256 + b3,
    next: offset + 3,
  };
}

function readPathSetEnd(bytes: Uint8Array, offset: number): number | undefined {
  let next = offset;
  for (;;) {
    const step = bytes[next];
    if (typeof step !== "number") return undefined;
    next++;
    if (step === PATH_END) return next;
    if (step === PATH_BOUNDARY) continue;
    if ((step & ~PATH_STEP_FLAGS) !== 0) return undefined;

    for (const flag of [
      PATH_STEP_ACCOUNT,
      PATH_STEP_CURRENCY,
      PATH_STEP_ISSUER,
    ]) {
      if ((step & flag) !== 0) next += PATH_STEP_PART_LENGTH;
    }
  }
}

function readValueEnd(
  bytes: Uint8Array,
  offset: number,
  typeCode: number,
): number | undefined {
  const fixedLength = FIXED_LENGTHS[typeCode];
  if (typeof fixedLength === "number") return offset + fixedLength;

  switch (typeCode) {
    case TYPE_AMOUNT: {
      const first = bytes[offset];
      if (typeof first !== "number") return undefined;
      if ((first & AMOUNT_IOU_BIT) !== 0) return offset + IOU_AMOUNT_LENGTH;
      if ((first & AMOUNT_MPT_BIT) !== 0) return offset + MPT_AMOUNT_LENGTH;
      return offset + XRP_AMOUNT_LENGTH;
    }
    case TYPE_BLOB:
    case TYPE_ACCOUNT:
    case TYPE_VECTOR256: {
      const vl = readVariableLength(bytes, offset);
      return vl && vl.next + vl.length;
    }
    case TYPE_OBJECT:
    case TYPE_ARRAY:
      return offset;
    case TYPE_PATHSET:
      return readPathSetEnd(bytes, offset);
    case TYPE_ISSUE: {
      const isXrp = bytes
        .subarray(offset, offset + ISSUE_CURRENCY_LENGTH)
        .every((byte) => byte === 0);
      return offset + (isXrp ? ISSUE_CURRENCY_LENGTH : ISSUE_LENGTH);
    }
    default:
      return undefined;
  }
}

function findIssuanceId(
  bytes: Uint8Array,
  header: FieldHeader,
): Uint8Array | undefined {
  const isIssuanceIdField =
    header.typeCode === TYPE_HASH192 &&
    header.fieldCode === MPTOKEN_ISSUANCE_ID_FIELD;
  if (isIssuanceIdField) {
    return bytes.subarray(header.next, header.next + ISSUANCE_ID_LENGTH);
  }

  const first = bytes[header.next];
  if (header.typeCode !== TYPE_AMOUNT || typeof first !== "number") {
    return undefined;
  }

  const isMptAmount =
    (first & AMOUNT_IOU_BIT) === 0 && (first & AMOUNT_MPT_BIT) !== 0;
  if (!isMptAmount) return undefined;

  const start = header.next + MPT_ISSUANCE_ID_OFFSET;
  return bytes.subarray(start, start + ISSUANCE_ID_LENGTH);
}

/**
 * Returns the distinct MPT issuance IDs of a serialized XRPL transaction, in
 * transaction order, as uppercase hex. Returns an empty list when the
 * transaction holds no MPT or cannot be walked to its end.
 */
export function parseMptIssuanceIds(transaction: Uint8Array): string[] {
  const ids = new Set<string>();
  let offset = 0;

  while (offset < transaction.length) {
    const header = readFieldHeader(transaction, offset);
    if (!header) return [];

    const end = readValueEnd(transaction, header.next, header.typeCode);
    if (typeof end !== "number" || end > transaction.length) return [];

    const issuanceId = findIssuanceId(transaction, header);
    if (issuanceId) {
      ids.add(bufferToHexaString(issuanceId, false).toUpperCase());
    }

    offset = end;
  }

  return [...ids];
}
