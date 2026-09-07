import {
  type Apdu,
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

import { type Address } from "@api/model/Address";
import {
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";
import {
  encodeKeyIndex,
  keyIndexFromDerivationPath,
} from "@internal/app-binder/command/utils/KeyIndexUtils";
import {
  CLA,
  INS,
  P1_CONFIRM,
  P1_NON_CONFIRM,
  P2_UNUSED,
  PUBLIC_KEY_LENGTH,
} from "@internal/app-binder/constants";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice: boolean;
};

export type GetAddressCommandResponse = Address;

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, HederaErrorCodes>
{
  readonly name = "GetAddress";

  private readonly args: GetAddressCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const keyIndex = keyIndexFromDerivationPath(this.args.derivationPath);

    return new ApduBuilder({
      cla: CLA,
      ins: INS.GET_PUBLIC_KEY,
      p1: this.args.checkOnDevice ? P1_CONFIRM : P1_NON_CONFIRM,
      p2: P2_UNUSED,
    })
      .addBufferToData(encodeKeyIndex(keyIndex))
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const publicKey = parser.extractFieldByLength(PUBLIC_KEY_LENGTH);

      if (publicKey === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract public key"),
        });
      }

      return CommandResultFactory({
        data: { publicKey: parser.encodeToHexaString(publicKey) },
      });
    });
  }
}
