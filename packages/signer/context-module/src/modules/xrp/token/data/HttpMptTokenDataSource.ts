import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  type GetMptDescriptorParams,
  mptTokenDataResponsesCodec,
  type MptTokenDataSource,
} from "@/modules/xrp/token/data/MptTokenDataSource";
import { networkTypes } from "@/shared/network/di/networkTypes";

const SIGNATURE_TAG = "08";

@injectable()
export class HttpMptTokenDataSource implements MptTokenDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getMptDescriptor(
    params: GetMptDescriptorParams,
  ): Promise<Either<Error, string>> {
    const noDescriptor = () => {
      return Left(
        new Error(
          `[ContextModule] HttpMptTokenDataSource: no descriptor for issuance id ${params.issuanceId}`,
        ),
      );
    };

    try {
      const response = await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          id: `ripple/mpt/${params.issuanceId.toLowerCase()}`,
          output: "id,ticker,decimals,descriptor",
          ref: `branch:${this.config.cal.branch}`,
        },
      });

      return mptTokenDataResponsesCodec.decode(response).caseOf({
        Left: noDescriptor,
        Right: (entries) => {
          const descriptor = entries[0]?.descriptor;
          const signature = descriptor?.signatures[this.config.cal.mode];
          if (!descriptor?.data || !signature) return noDescriptor();

          const signatureLength = (signature.length / 2)
            .toString(16)
            .padStart(2, "0");
          return Right(
            `${descriptor.data}${SIGNATURE_TAG}${signatureLength}${signature}`,
          );
        },
      });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpMptTokenDataSource: Failed to fetch the MPT descriptor",
        ),
      );
    }
  }
}
