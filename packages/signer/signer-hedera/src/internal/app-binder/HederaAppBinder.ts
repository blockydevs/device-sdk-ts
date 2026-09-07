import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { APP_NAME } from "@internal/app-binder/constants";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { SignTransactionCommand } from "./command/SignTransactionCommand";

@injectable()
export class HederaAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAppConfiguration(args: {
    skipOpenApp: boolean;
  }): GetAppConfigurationDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigurationCommand(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand({
            derivationPath: args.derivationPath,
            checkOnDevice: args.checkOnDevice,
          }),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Uint8Array;
    skipOpenApp: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignTransactionCommand({
            derivationPath: args.derivationPath,
            transaction: args.transaction,
          }),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}
