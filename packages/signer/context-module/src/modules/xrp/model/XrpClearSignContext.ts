import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type ClearSignContextType } from "@/shared/model/ClearSignContext";

export type XrpPayloadOverrides = {
  [ClearSignContextType.XRP_MPT_TOKEN]: {
    /** Hex descriptor TLV, signature tag included. */
    payload: string;
    certificate: PkiCertificate;
  };
};
