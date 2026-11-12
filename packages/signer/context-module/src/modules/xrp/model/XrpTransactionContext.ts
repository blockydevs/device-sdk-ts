import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type XrpTransactionContext = {
  /** Serialized XRPL transaction, as given to the signer. */
  rawTransaction: Uint8Array;
  deviceModelId: DeviceModelId;
};
