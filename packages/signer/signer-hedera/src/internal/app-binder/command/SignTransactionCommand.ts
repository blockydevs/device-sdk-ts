import {
  type Apdu,
  APDU_MAX_PAYLOAD,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  HederaErrorCodes,
  HederaInvalidInputError,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";
import {
  encodeKeyIndex,
  keyIndexFromDerivationPath,
} from "@internal/app-binder/command/utils/KeyIndexUtils";
import {
  CLA,
  INS,
  KEY_INDEX_LENGTH,
  P2_UNUSED,
  SIGNATURE_LENGTH,
} from "@internal/app-binder/constants";

/**
 * The app takes the whole transaction body in one APDU, so the key index and
 * the body together have to fit in a single payload.
 */
export const MAX_TRANSACTION_LENGTH = APDU_MAX_PAYLOAD - KEY_INDEX_LENGTH;

const P1_UNUSED = 0x00;

export type SignTransactionCommandArgs = {
  readonly derivationPath: string;
  /** Serialized Hedera `TransactionBody` protobuf. */
  readonly transaction: Uint8Array;
};

export type SignTransactionCommandResponse = Signature;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      HederaErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, transaction } = this.args;

    if (transaction.length === 0) {
      throw new HederaInvalidInputError(
        HederaErrorCodes.EMPTY_TRANSACTION,
        "SignTransactionCommand: transaction is empty",
      );
    }

    if (transaction.length > MAX_TRANSACTION_LENGTH) {
      throw new HederaInvalidInputError(
        HederaErrorCodes.TRANSACTION_TOO_LARGE,
        `SignTransactionCommand: transaction is ${transaction.length} bytes, the app accepts at most ${MAX_TRANSACTION_LENGTH}`,
      );
    }

    const keyIndex = keyIndexFromDerivationPath(derivationPath);

    return new ApduBuilder({
      cla: CLA,
      ins: INS.SIGN_TRANSACTION,
      p1: P1_UNUSED,
      p2: P2_UNUSED,
    })
      .addBufferToData(encodeKeyIndex(keyIndex))
      .addBufferToData(transaction)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const signature = parser.extractFieldByLength(SIGNATURE_LENGTH);

      if (signature === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract signature"),
        });
      }

      return CommandResultFactory({ data: signature });
    });
  }
}
