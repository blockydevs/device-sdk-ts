import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { GetAppConfigurationUseCase } from "./GetAppConfigurationUseCase";

describe("GetAppConfigurationUseCase", () => {
  it("should call appBinder.getAppConfiguration and return its result", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAppConfiguration = vi.fn().mockReturnValue(expectedResult);
    const appBinder = { getAppConfiguration } as unknown as HederaAppBinder;
    const useCase = new GetAppConfigurationUseCase(appBinder);

    // ACT
    const result = useCase.execute();

    // ASSERT
    expect(getAppConfiguration).toHaveBeenCalledTimes(1);
    expect(getAppConfiguration).toHaveBeenCalledWith({ skipOpenApp: false });
    expect(result).toBe(expectedResult);
  });

  it("should forward skipOpenApp from the options", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAppConfiguration = vi.fn().mockReturnValue(expectedResult);
    const appBinder = { getAppConfiguration } as unknown as HederaAppBinder;
    const useCase = new GetAppConfigurationUseCase(appBinder);

    // ACT
    const result = useCase.execute({ skipOpenApp: true });

    // ASSERT
    expect(getAppConfiguration).toHaveBeenCalledTimes(1);
    expect(getAppConfiguration).toHaveBeenCalledWith({ skipOpenApp: true });
    expect(result).toBe(expectedResult);
  });
});
