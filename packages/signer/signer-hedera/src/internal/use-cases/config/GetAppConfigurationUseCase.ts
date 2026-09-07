import { inject, injectable } from "inversify";

import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type AppConfigurationOptions } from "@api/model/AppConfigurationOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

@injectable()
export class GetAppConfigurationUseCase {
  private readonly _appBinder: HederaAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: HederaAppBinder) {
    this._appBinder = appBinder;
  }

  execute(options?: AppConfigurationOptions): GetAppConfigurationDAReturnType {
    return this._appBinder.getAppConfiguration({
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
