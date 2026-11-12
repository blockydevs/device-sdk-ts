import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  APDU_MAX_PAYLOAD,
  hexaStringToBuffer,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

export type MptDescriptor = {
  descriptor: Uint8Array;
  certificate: PkiCertificate;
};

type GetMptDescriptorsTaskArgs = {
  contextModule: ContextModule;
  transaction: Uint8Array;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

/**
 * Never fails: without a descriptor, the app chooses between clear signing
 * and blind signing.
 */
export class GetMptDescriptorsTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly api: InternalApi,
    private readonly args: GetMptDescriptorsTaskArgs,
  ) {
    this._logger = args.loggerFactory("GetMptDescriptorsTask");
  }

  async run(): Promise<MptDescriptor[]> {
    let contexts: ClearSignContext[];
    try {
      contexts = await this.args.contextModule.getContexts(
        {
          rawTransaction: this.args.transaction,
          deviceModelId: this.api.getDeviceSessionState().deviceModelId,
        },
        [ClearSignContextType.XRP_MPT_TOKEN],
      );
    } catch (error) {
      this._logger.warn("[run] Failed to get the MPT descriptors", {
        data: { error },
      });
      return [];
    }

    const mptDescriptors: MptDescriptor[] = [];
    for (const context of contexts) {
      if (context.type !== ClearSignContextType.XRP_MPT_TOKEN) {
        this._logger.warn("[run] Dropped a context without MPT descriptor", {
          data: { context },
        });
        continue;
      }

      const descriptor = hexaStringToBuffer(context.payload);
      if (!descriptor?.length || descriptor.length > APDU_MAX_PAYLOAD) {
        this._logger.warn("[run] Dropped an MPT descriptor that is not valid", {
          data: { payload: context.payload },
        });
        continue;
      }

      mptDescriptors.push({ descriptor, certificate: context.certificate });
    }

    return mptDescriptors;
  }
}
