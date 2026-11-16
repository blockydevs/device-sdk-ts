import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type LoggerPublisherService,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Curve } from "@api/model/Curve";
import { type Signature } from "@api/model/Signature";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { type MptDescriptor } from "@internal/app-binder/task/GetMptDescriptorsTask";

export type SignTransactionDAOutput = Signature;

/**
 * Device-action input for `SignTransactionDeviceAction`.
 *
 * **Serialized transaction (double source):**
 * - Seeded from factory / constructor `input.transaction` on
 *   `executeDeviceAction` (binder path).
 * - Overridden by the parent invoke `input.transaction` when this machine is
 *   nested via `makeStateMachine` (e.g. bytes known only after GetAddress).
 *
 * The sign step always reads `context.input.transaction` and rejects if it is
 * missing or empty (neither factory arg nor invoke/context input provided it).
 */
export type SignTransactionDAInput = {
  readonly derivationPath: string;
  /** Serialized XRP transaction; see double-source note above. */
  readonly transaction: Uint8Array;
  readonly skipOpenApp: boolean;
  readonly curve: Curve;
  /**
   * Loads the MPT descriptors sent before the transaction. Without it, the
   * device action sends no descriptor.
   */
  readonly contextModule?: ContextModule;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<XrpErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export enum SignTransactionDAStep {
  OPEN_APP = "signer.xrp.steps.openApp",
  GET_MPT_DESCRIPTORS = "signer.xrp.steps.getMptDescriptors",
  SIGN_TRANSACTION = "signer.xrp.steps.signTransaction",
}

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: SignTransactionDAStep;
};

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: Signature | null;
  readonly mptDescriptors: MptDescriptor[];
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
