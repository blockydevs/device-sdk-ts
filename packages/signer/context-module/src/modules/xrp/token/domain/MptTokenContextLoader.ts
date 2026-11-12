import { inject, injectable } from "inversify";

import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type XrpTransactionContext } from "@/modules/xrp/model/XrpTransactionContext";
import { type MptTokenDataSource } from "@/modules/xrp/token/data/MptTokenDataSource";
import { tokenTypes } from "@/modules/xrp/token/di/tokenTypes";
import { parseMptIssuanceIds } from "@/modules/xrp/token/domain/parseMptIssuanceIds";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.XRP_MPT_TOKEN,
];

// The XRP app has two descriptor slots.
const MAX_DESCRIPTORS = 2;

@injectable()
export class MptTokenContextLoader
  implements ContextLoader<XrpTransactionContext>
{
  constructor(
    @inject(tokenTypes.MptTokenDataSource)
    private readonly dataSource: MptTokenDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is XrpTransactionContext {
    return (
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "deviceModelId" in input &&
      "rawTransaction" in input &&
      input.rawTransaction instanceof Uint8Array &&
      input.rawTransaction.length > 0
    );
  }

  async load(input: XrpTransactionContext): Promise<ClearSignContext[]> {
    const allIssuanceIds = parseMptIssuanceIds(input.rawTransaction);
    const issuanceIds = allIssuanceIds.slice(0, MAX_DESCRIPTORS);
    if (issuanceIds.length === 0) return [];

    const certificate = await this.certificateLoader.loadCertificate({
      keyId: KeyId.TokenMetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: input.deviceModelId,
    });
    if (!certificate) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] MptTokenContextLoader: token metadata certificate is missing",
          ),
        },
      ];
    }

    return Promise.all(
      issuanceIds.map(async (issuanceId): Promise<ClearSignContext> => {
        const descriptor = await this.dataSource.getMptDescriptor({
          issuanceId,
        });

        return descriptor.caseOf<ClearSignContext>({
          Left: (error) => ({ error, type: ClearSignContextType.ERROR }),
          Right: (payload) => {
            return {
              payload,
              certificate,
              type: ClearSignContextType.XRP_MPT_TOKEN,
            };
          },
        });
      }),
    );
  }
}
