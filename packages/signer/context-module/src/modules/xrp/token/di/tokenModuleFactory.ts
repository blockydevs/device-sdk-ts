import { ContainerModule } from "inversify";

import { HttpMptTokenDataSource } from "@/modules/xrp/token/data/HttpMptTokenDataSource";
import { tokenTypes } from "@/modules/xrp/token/di/tokenTypes";
import { MptTokenContextLoader } from "@/modules/xrp/token/domain/MptTokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tokenTypes.MptTokenDataSource).to(HttpMptTokenDataSource);
    bind(tokenTypes.MptTokenContextLoader).to(MptTokenContextLoader);
  });
