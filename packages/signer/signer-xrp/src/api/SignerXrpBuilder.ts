import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerXrp } from "@internal/DefaultSignerXrp";

type SignerXrpBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerXrp` class.
 */
export class SignerXrpBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private _customContextModule: ContextModule | undefined;

  constructor({ dmk, sessionId }: SignerXrpBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Override the default context module, which gets the MPT descriptors from
   * the Ledger CAL
   *
   * @param contextModule
   * @returns this
   */
  withContextModule(contextModule: ContextModule) {
    this._customContextModule = contextModule;
    return this;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    const contextModule =
      this._customContextModule ??
      new ContextModuleBuilder({
        loggerFactory: (tag: string) =>
          this._dmk.getLoggerFactory()(["ContextModule", tag]),
      })
        .setChain(ContextModuleChainID.Xrp)
        .build();

    return new DefaultSignerXrp({
      contextModule,
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
