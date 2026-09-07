import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/3030'/0'/0'/0'";

  it("should forward the options to appBinder.getAddress", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getAddress = vi.fn().mockReturnValue(expectedResult);
    const appBinder = { getAddress } as unknown as HederaAppBinder;
    const useCase = new GetAddressUseCase(appBinder);

    // ACT
    const result = useCase.execute(derivationPath, {
      checkOnDevice: true,
      skipOpenApp: true,
    });

    // ASSERT
    expect(getAddress).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: true,
      skipOpenApp: true,
    });
    expect(result).toBe(expectedResult);
  });

  it("should default both flags to false when no options are given", () => {
    // ARRANGE
    const getAddress = vi.fn();
    const appBinder = { getAddress } as unknown as HederaAppBinder;
    const useCase = new GetAddressUseCase(appBinder);

    // ACT
    useCase.execute(derivationPath);

    // ASSERT
    expect(getAddress).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: false,
      skipOpenApp: false,
    });
  });
});
