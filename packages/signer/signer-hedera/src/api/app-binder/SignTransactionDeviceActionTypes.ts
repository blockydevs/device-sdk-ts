import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import {
  type HederaErrorCodes,
  type HederaInvalidInputError,
} from "@internal/app-binder/command/utils/hederaApplicationErrors";

type SignTransactionDAUserInteractionRequired =
  UserInteractionRequired.SignTransaction;

export type SignTransactionDAOutput = SendCommandInAppDAOutput<Signature>;

export type SignTransactionDAError =
  | OpenAppDAError
  | HederaInvalidInputError
  | CommandErrorResult<HederaErrorCodes>["error"];

export type SignTransactionDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<SignTransactionDAUserInteractionRequired>;

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
