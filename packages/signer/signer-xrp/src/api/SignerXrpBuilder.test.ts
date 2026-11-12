import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { from } from "rxjs";

import { SignerXrpBuilder } from "@api/SignerXrpBuilder";
import { type SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";
import { DefaultSignerXrp } from "@internal/DefaultSignerXrp";

const getSignedContextModule = (
  makeBuilder: (dmk: DeviceManagementKit) => SignerXrpBuilder,
) => {
  const executeDeviceAction = vi
    .fn()
    .mockReturnValue({ observable: from([]), cancel: vi.fn() });
  const dmk = {
    executeDeviceAction,
    getLoggerFactory: () => () => ({}),
  } as unknown as DeviceManagementKit;

  makeBuilder(dmk)
    .build()
    .signTransaction("44'/144'/0'/0/0", new Uint8Array([0x12, 0x00]));

  const call = executeDeviceAction.mock.calls[0]![0] as {
    deviceAction: SignTransactionDeviceAction;
  };
  return call.deviceAction.input.contextModule;
};

describe("SignerXrpBuilder", () => {
  it("should build a SignerXrp instance", () => {
    // ARRANGE
    const dmk = {} as DeviceManagementKit;
    const sessionId = "test-session-id";
    const builder = new SignerXrpBuilder({ dmk, sessionId });

    // ACT
    const signer = builder.build();

    // ASSERT
    expect(signer).toBeInstanceOf(DefaultSignerXrp);
  });

  describe("context module", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should sign with a default context module of the XRP chain", () => {
      const setChain = vi.spyOn(ContextModuleBuilder.prototype, "setChain");

      const contextModule = getSignedContextModule(
        (dmk) => new SignerXrpBuilder({ dmk, sessionId: "test-session-id" }),
      );

      expect(setChain).toHaveBeenCalledTimes(1);
      expect(setChain).toHaveBeenCalledWith(ContextModuleChainID.Xrp);
      expect(contextModule?.getContexts).toBeTypeOf("function");
    });

    it("should sign with the context module given to withContextModule", () => {
      const custom = { getContexts: vi.fn() } as unknown as ContextModule;

      const contextModule = getSignedContextModule((dmk) => {
        return new SignerXrpBuilder({
          dmk,
          sessionId: "test-session-id",
        }).withContextModule(custom);
      });

      expect(contextModule).toBe(custom);
    });
  });
});
