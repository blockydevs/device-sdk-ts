import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAppConfigurationCommandResponse } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { type HederaErrorCodes } from "@internal/app-binder/command/utils/hederaApplicationErrors";

type GetAppConfigurationDAUserInteractionRequired =
  UserInteractionRequired.None;

export type GetAppConfigurationDAOutput =
  SendCommandInAppDAOutput<GetAppConfigurationCommandResponse>;

export type GetAppConfigurationDAError =
  | OpenAppDAError
  | CommandErrorResult<HederaErrorCodes>["error"];

export type GetAppConfigurationDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAppConfigurationDAUserInteractionRequired>;

export type GetAppConfigurationDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigurationDAOutput,
  GetAppConfigurationDAError,
  GetAppConfigurationDAIntermediateValue
>;
