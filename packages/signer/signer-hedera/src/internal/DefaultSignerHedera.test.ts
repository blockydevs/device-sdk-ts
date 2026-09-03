import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { DefaultSignerHedera } from "@internal/DefaultSignerHedera";

const DERIVATION_PATH = "44'/3030'/0'/0'/0'";

describe("DefaultSignerHedera", () => {
  const sessionId = "test-session-id" as DeviceSessionId;

  const setup = () => {
    const expectedResult = { observable: from([]), cancel: vi.fn() };
    const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
    const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

    return {
      executeDeviceAction,
      expectedResult,
      signer: new DefaultSignerHedera({ dmk, sessionId }),
    };
  };

  it("getAppConfig should send the app config command and open the app", () => {
    // ARRANGE
    const { executeDeviceAction, expectedResult, signer } = setup();

    // ACT
    const result = signer.getAppConfig();

    // ASSERT
    expect(result).toBe(expectedResult);
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    expect(executeDeviceAction.mock.lastCall).toStrictEqual([
      {
        sessionId,
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new GetAppConfigCommand(),
            appName: APP_NAME,
            requiredUserInteraction: UserInteractionRequired.None,
            skipOpenApp: false,
          },
        }),
      },
    ]);
  });

  it("getAddress should send the get address command and ask to verify the address", () => {
    // ARRANGE
    const { executeDeviceAction, expectedResult, signer } = setup();

    // ACT
    const result = signer.getAddress(DERIVATION_PATH, {
      checkOnDevice: true,
      skipOpenApp: true,
    });

    // ASSERT
    expect(result).toBe(expectedResult);
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    expect(executeDeviceAction.mock.lastCall).toStrictEqual([
      {
        sessionId,
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new GetAddressCommand({
              derivationPath: DERIVATION_PATH,
              checkOnDevice: true,
            }),
            appName: APP_NAME,
            requiredUserInteraction: UserInteractionRequired.VerifyAddress,
            skipOpenApp: true,
          },
        }),
      },
    ]);
  });

  it("getAddress should default to no verification and to opening the app", () => {
    // ARRANGE
    const { executeDeviceAction, signer } = setup();

    // ACT
    signer.getAddress(DERIVATION_PATH);

    // ASSERT
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    expect(executeDeviceAction.mock.lastCall).toStrictEqual([
      {
        sessionId,
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new GetAddressCommand({
              derivationPath: DERIVATION_PATH,
              checkOnDevice: false,
            }),
            appName: APP_NAME,
            requiredUserInteraction: UserInteractionRequired.None,
            skipOpenApp: false,
          },
        }),
      },
    ]);
  });

  it("signTransaction should send the sign transaction command", () => {
    // ARRANGE
    const { executeDeviceAction, expectedResult, signer } = setup();
    const transaction = new Uint8Array([0x0a]);

    // ACT
    const result = signer.signTransaction(DERIVATION_PATH, transaction, {
      skipOpenApp: true,
    });

    // ASSERT
    expect(result).toBe(expectedResult);
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    expect(executeDeviceAction.mock.lastCall).toStrictEqual([
      {
        sessionId,
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new SignTransactionCommand({
              derivationPath: DERIVATION_PATH,
              transaction,
            }),
            appName: APP_NAME,
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            skipOpenApp: true,
          },
        }),
      },
    ]);
  });

  it("signTransaction should default to opening the app", () => {
    // ARRANGE
    const { executeDeviceAction, signer } = setup();
    const transaction = new Uint8Array([0x0a]);

    // ACT
    signer.signTransaction(DERIVATION_PATH, transaction);

    // ASSERT
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    expect(executeDeviceAction.mock.lastCall).toStrictEqual([
      {
        sessionId,
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new SignTransactionCommand({
              derivationPath: DERIVATION_PATH,
              transaction,
            }),
            appName: APP_NAME,
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            skipOpenApp: false,
          },
        }),
      },
    ]);
  });
});
