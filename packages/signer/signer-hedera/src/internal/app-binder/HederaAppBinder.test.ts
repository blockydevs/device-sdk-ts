import {
  type DeviceManagementKit,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

const DERIVATION_PATH = "44'/3030'/0'/0'/0'";

describe("HederaAppBinder", () => {
  const sessionId = "test-session-id";

  type ExecutedAction = {
    sessionId: string;
    deviceAction: {
      input: {
        command: unknown;
        appName: string;
        requiredUserInteraction: UserInteractionRequired;
        skipOpenApp: boolean;
      };
    };
  };

  const makeBinder = (executeDeviceAction: ReturnType<typeof vi.fn>) => {
    const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;
    return new HederaAppBinder(dmk, sessionId);
  };

  const executedAction = (
    executeDeviceAction: ReturnType<typeof vi.fn>,
  ): ExecutedAction => executeDeviceAction.mock.calls[0]![0] as ExecutedAction;

  it("getAppConfiguration should send GetAppConfigurationCommand without user interaction", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceAction);

    // ACT
    const result = binder.getAppConfiguration({ skipOpenApp: false });

    // ASSERT
    const args = executedAction(executeDeviceAction);
    expect(args.sessionId).toBe(sessionId);
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(
      GetAppConfigurationCommand,
    );
    expect(args.deviceAction.input.appName).toBe(APP_NAME);
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(result).toBe(expectedResult);
  });

  it("getAddress should request VerifyAddress interaction when checkOnDevice is true", () => {
    // ARRANGE
    const executeDeviceAction = vi.fn();
    const binder = makeBinder(executeDeviceAction);

    // ACT
    binder.getAddress({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: true,
      skipOpenApp: false,
    });

    // ASSERT
    const args = executedAction(executeDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(GetAddressCommand);
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.VerifyAddress,
    );
  });

  it("getAddress should require no interaction when checkOnDevice is false", () => {
    // ARRANGE
    const executeDeviceAction = vi.fn();
    const binder = makeBinder(executeDeviceAction);

    // ACT
    binder.getAddress({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: false,
      skipOpenApp: true,
    });

    // ASSERT
    const args = executedAction(executeDeviceAction);
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(args.deviceAction.input.skipOpenApp).toBe(true);
  });

  it("signTransaction should send SignTransactionCommand and require signing", () => {
    // ARRANGE
    const executeDeviceAction = vi.fn();
    const binder = makeBinder(executeDeviceAction);

    // ACT
    binder.signTransaction({
      derivationPath: DERIVATION_PATH,
      transaction: new Uint8Array([0x0a]),
      skipOpenApp: false,
    });

    // ASSERT
    const args = executedAction(executeDeviceAction);
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(
      SignTransactionCommand,
    );
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.SignTransaction,
    );
  });
});
