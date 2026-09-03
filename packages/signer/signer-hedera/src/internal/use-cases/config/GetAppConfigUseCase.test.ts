import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { GetAppConfigUseCase } from "./GetAppConfigUseCase";

describe("GetAppConfigUseCase", () => {
  it("should call appBinder.getAppConfig and return its result", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAppConfig = vi.fn().mockReturnValue(expectedResult);
    const appBinder = { getAppConfig } as unknown as HederaAppBinder;
    const useCase = new GetAppConfigUseCase(appBinder);

    // ACT
    const result = useCase.execute();

    // ASSERT
    expect(getAppConfig).toHaveBeenCalledTimes(1);
    expect(getAppConfig).toHaveBeenCalledWith({ skipOpenApp: false });
    expect(result).toBe(expectedResult);
  });

  it("should forward skipOpenApp from the options", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAppConfig = vi.fn().mockReturnValue(expectedResult);
    const appBinder = { getAppConfig } as unknown as HederaAppBinder;
    const useCase = new GetAppConfigUseCase(appBinder);

    // ACT
    const result = useCase.execute({ skipOpenApp: true });

    // ASSERT
    expect(getAppConfig).toHaveBeenCalledTimes(1);
    expect(getAppConfig).toHaveBeenCalledWith({ skipOpenApp: true });
    expect(result).toBe(expectedResult);
  });
});
