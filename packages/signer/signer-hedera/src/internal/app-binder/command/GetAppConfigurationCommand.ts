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

import { type AppConfiguration } from "@api/model/AppConfiguration";
import {
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";
import { CLA, INS, P2_UNUSED } from "@internal/app-binder/constants";

export type GetAppConfigurationCommandResponse = AppConfiguration;

const P1_UNUSED = 0x00;

/**
 * Retrieves the configuration of the Hedera application.
 *
 * The device answers with 4 bytes: `[rfu, major, minor, patch]`. The first byte
 * is reserved for future use by the app, is always zero, and is therefore
 * skipped.
 */
export class GetAppConfigurationCommand
  implements Command<GetAppConfigurationCommandResponse, void, HederaErrorCodes>
{
  readonly name = "GetAppConfiguration";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigurationCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS.GET_APP_CONFIGURATION,
      p1: P1_UNUSED,
      p2: P2_UNUSED,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigurationCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const rfu = parser.extract8BitUInt();
      const major = parser.extract8BitUInt();
      const minor = parser.extract8BitUInt();
      const patch = parser.extract8BitUInt();

      if (
        rfu === undefined ||
        major === undefined ||
        minor === undefined ||
        patch === undefined
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract app config"),
        });
      }

      return CommandResultFactory({
        data: {
          version: `${major}.${minor}.${patch}`,
        },
      });
    });
  }
}
