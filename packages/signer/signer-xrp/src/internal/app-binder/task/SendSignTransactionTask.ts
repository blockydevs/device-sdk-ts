import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidArgumentError,
  isSuccessCommandResult,
  LoadCertificateCommand,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Nothing } from "purify-ts";

import { type Curve } from "@api/model/Curve";
import { type Signature } from "@api/model/Signature";
import { ProvideMptDescriptorCommand } from "@internal/app-binder/command/ProvideMptDescriptorCommand";
import {
  SignTransactionCommand,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { validateDerivationPath } from "@internal/app-binder/command/utils/validateDerivationPath";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { type MptDescriptor } from "@internal/app-binder/task/GetMptDescriptorsTask";

const PATH_SIZE = 4;

type SendSignTransactionTaskArgs = {
  derivationPath: string;
  serializedTransaction: Uint8Array;
  /** Curve to sign with, sent on every chunk. */
  curve: Curve;
  /** Sent before the transaction, each after its certificate. */
  mptDescriptors?: MptDescriptor[];
  loggerFactory: (tag: string) => LoggerPublisherService;
};

/**
 * Drives {@link SignTransactionCommand} over a whole transaction: prepends the
 * encoded derivation path, splits the result into APDU-sized chunks and
 * returns the signature the app answers with on the last one.
 *
 * The MPT descriptors go in the same task because the app deletes them when
 * it gets any other `E0` command before the Sign command.
 */
export class SendSignTransactionTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendSignTransactionTaskArgs,
  ) {
    this._logger = args.loggerFactory("SendSignTransactionTask");
  }

  async run(): Promise<CommandResult<Signature, XrpErrorCodes>> {
    const { derivationPath, serializedTransaction, curve } = this.args;

    if (serializedTransaction.length === 0) {
      return CommandResultFactory({
        error: new InvalidArgumentError("Cannot sign an empty transaction"),
      });
    }

    let paths: number[];
    try {
      paths = validateDerivationPath(derivationPath);
    } catch (error) {
      return CommandResultFactory({
        error: new InvalidArgumentError(
          error instanceof Error ? error.message : "Invalid derivation path",
        ),
      });
    }

    await this.provideMptDescriptors(this.args.mptDescriptors);

    const chunks = this.getChunks(paths, serializedTransaction);
    this._logger.debug("[run] Sending transaction in chunks", {
      data: {
        chunksCount: chunks.length,
        transactionLength: serializedTransaction.length,
      },
    });

    let resultData: SignTransactionCommandResponse = Nothing;
    for (let i = 0; i < chunks.length; i++) {
      const result = await this.api.sendCommand(
        new SignTransactionCommand({
          chunkedData: chunks[i]!,
          isFirstChunk: i === 0,
          isLastChunk: i === chunks.length - 1,
          curve,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        this._logger.error("[run] Failed to send transaction chunk", {
          data: { chunkIndex: i, error: result.error },
        });
        return result;
      }

      resultData = result.data;
    }

    return resultData.mapOrDefault(
      (signature) =>
        CommandResultFactory<Signature, XrpErrorCodes>({ data: signature }),
      CommandResultFactory<Signature, XrpErrorCodes>({
        error: new InvalidArgumentError("No signature returned"),
      }),
    );
  }

  // A refused certificate or descriptor never fails the signature: the app
  // then signs without the descriptors it does not hold.
  private async provideMptDescriptors(
    mptDescriptors: MptDescriptor[] = [],
  ): Promise<void> {
    for (const { descriptor, certificate } of mptDescriptors) {
      const certificateResult = await this.api.sendCommand(
        new LoadCertificateCommand({
          keyUsage: certificate.keyUsageNumber,
          certificate: certificate.payload,
        }),
      );
      if (!isSuccessCommandResult(certificateResult)) {
        this._logger.warn(
          "[provideMptDescriptors] Certificate refused, signing without more MPT descriptors",
          { data: { error: certificateResult.error } },
        );
        return;
      }

      const descriptorResult = await this.api.sendCommand(
        new ProvideMptDescriptorCommand({ descriptor }),
      );
      if (!isSuccessCommandResult(descriptorResult)) {
        this._logger.warn(
          "[provideMptDescriptors] MPT descriptor refused, signing without more MPT descriptors",
          { data: { error: descriptorResult.error } },
        );
        return;
      }
    }
  }

  /**
   * Build `[nDerivations][index x n] ++ transaction` and cut it into
   * APDU-sized chunks.
   *
   * The path prefix is part of the buffer rather than a special case for the
   * first chunk: the app reads the payload as one stream, so a uniform cut
   * gives it the same bytes with less arithmetic.
   */
  private getChunks(
    paths: number[],
    serializedTransaction: Uint8Array,
  ): Uint8Array[] {
    const builder = new ByteArrayBuilder(
      1 + paths.length * PATH_SIZE + serializedTransaction.length,
    );
    builder.add8BitUIntToData(paths.length);
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    builder.addBufferToData(serializedTransaction);
    const buffer = builder.build();

    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < buffer.length; offset += APDU_MAX_PAYLOAD) {
      chunks.push(buffer.slice(offset, offset + APDU_MAX_PAYLOAD));
    }
    return chunks;
  }
}
