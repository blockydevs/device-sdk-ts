import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  const derivationPath = "44'/3030'/0'/0'/0'";
  const transaction = new Uint8Array([0x0a, 0x0b]);

  it("should forward the transaction and options to appBinder.signTransaction", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const signTransaction = vi.fn().mockReturnValue(expectedResult);
    const appBinder = { signTransaction } as unknown as HederaAppBinder;
    const useCase = new SignTransactionUseCase(appBinder);

    // ACT
    const result = useCase.execute(derivationPath, transaction, {
      skipOpenApp: true,
    });

    // ASSERT
    expect(signTransaction).toHaveBeenCalledWith({
      derivationPath,
      transaction,
      skipOpenApp: true,
    });
    expect(result).toBe(expectedResult);
  });

  it("should default skipOpenApp to false when no options are given", () => {
    // ARRANGE
    const signTransaction = vi.fn();
    const appBinder = { signTransaction } as unknown as HederaAppBinder;
    const useCase = new SignTransactionUseCase(appBinder);

    // ACT
    useCase.execute(derivationPath, transaction);

    // ASSERT
    expect(signTransaction).toHaveBeenCalledWith({
      derivationPath,
      transaction,
      skipOpenApp: false,
    });
  });
});
