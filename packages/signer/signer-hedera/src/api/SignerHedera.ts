import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type AppConfigurationOptions } from "@api/model/AppConfigurationOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerHedera {
  getAppConfiguration: (
    options?: AppConfigurationOptions,
  ) => GetAppConfigurationDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
}
