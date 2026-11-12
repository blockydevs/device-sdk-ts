/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  DeviceModelId,
  type LoggerPublisherService,
  OpenAppDeviceAction,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

import { SignTransactionDAStep } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Curve } from "@api/model/Curve";
import { XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

const DERIVATION_PATH = "44'/144'/0'/0/0";
const TRANSACTION = new Uint8Array([0x12, 0x00, 0x00]);
const SIGNATURE = new Uint8Array([0x30, 0x44]);

const loggerFactory = (_tag: string): LoggerPublisherService =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService;

const setupOpenAppDAMock = (error?: unknown) => {
  (OpenAppDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              },
            }),
            after: {
              0: "done",
            },
          },
          done: {
            type: "final",
          },
        },
        output: () => (error ? Left(error) : Right(undefined)),
      }),
    ),
  }));
};

describe("SignTransactionDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signTransactionMock = vi.fn();
  const getMptDescriptorsMock = vi.fn();

  const makeDeviceAction = (skipOpenApp: boolean) => {
    const deviceAction = new SignTransactionDeviceAction({
      input: {
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp,
        curve: Curve.Secp256k1,
        loggerFactory,
      },
    });
    vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
      getMptDescriptors: getMptDescriptorsMock,
      signTransaction: signTransactionMock,
    });
    return deviceAction;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    signTransactionMock.mockResolvedValue(
      CommandResultFactory({ data: SIGNATURE }),
    );
  });

  describe("skipOpenApp: true", () => {
    it("signs using derivationPath and transaction from machine input", () =>
      new Promise<void>((resolve, reject) => {
        const deviceAction = makeDeviceAction(true);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                step: SignTransactionDAStep.SIGN_TRANSACTION,
              },
            },
            {
              status: DeviceActionStatus.Completed,
              output: SIGNATURE,
            },
          ],
          apiMock,
          {
            onDone: () => {
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: DERIVATION_PATH,
                    transaction: TRANSACTION,
                    curve: Curve.Secp256k1,
                    mptDescriptors: [],
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("forwards a command error from the sign task", () =>
      new Promise<void>((resolve, reject) => {
        const error = new XrpAppCommandError({
          message: "User refused",
          errorCode: "6985",
        });
        signTransactionMock.mockResolvedValue(CommandResultFactory({ error }));
        const deviceAction = makeDeviceAction(true);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                step: SignTransactionDAStep.SIGN_TRANSACTION,
              },
            },
            {
              status: DeviceActionStatus.Error,
              error,
            },
          ],
          apiMock,
          { onDone: resolve, onError: reject },
        );
      }));
  });

  describe("skipOpenApp: false", () => {
    it("opens the app, forwards ConfirmOpenApp, then signs", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        const deviceAction = makeDeviceAction(false);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                step: SignTransactionDAStep.SIGN_TRANSACTION,
              },
            },
            {
              status: DeviceActionStatus.Completed,
              output: SIGNATURE,
            },
          ],
          apiMock,
          {
            onDone: () => {
              expect(signTransactionMock).toHaveBeenCalledTimes(1);
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: DERIVATION_PATH,
                    transaction: TRANSACTION,
                    curve: Curve.Secp256k1,
                    mptDescriptors: [],
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("errors when opening the app fails and does not sign", () =>
      new Promise<void>((resolve, reject) => {
        const openAppError = new UnknownDAError("OpenApp failed");
        setupOpenAppDAMock(openAppError);
        const deviceAction = makeDeviceAction(false);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Error,
              error: openAppError,
            },
          ],
          apiMock,
          {
            onDone: () => {
              expect(signTransactionMock).not.toHaveBeenCalled();
              resolve();
            },
            onError: reject,
          },
        );
      }));
  });

  describe("serialized transaction validation", () => {
    it("rejects when transaction is empty (neither factory arg nor invoke input)", async () => {
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: DERIVATION_PATH,
          transaction: new Uint8Array(),
          skipOpenApp: true,
          curve: Curve.Secp256k1,
          loggerFactory,
        },
      });
      const { signTransaction } = deviceAction.extractDependencies(apiMock);

      await expect(
        signTransaction({
          input: {
            derivationPath: DERIVATION_PATH,
            transaction: new Uint8Array(),
            curve: Curve.Secp256k1,
          },
        }),
      ).rejects.toMatchObject({
        _tag: "UnknownDAError",
        originalError: {
          message:
            "SignTransactionDeviceAction requires a non-empty serialized transaction (factory arg or invoke/context input)",
        },
      });
    });
  });

  describe("MPT descriptors", () => {
    const contextModule = {
      getContexts: vi.fn(),
    } as unknown as ContextModule;
    const MPT_DESCRIPTORS = [
      {
        descriptor: new Uint8Array([0x01, 0x01, 0x90]),
        certificate: { keyUsageNumber: 8, payload: new Uint8Array([0x01]) },
      },
    ];

    const makeDeviceActionWithContextModule = (skipOpenApp: boolean) => {
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          skipOpenApp,
          contextModule,
          loggerFactory,
          derivationPath: DERIVATION_PATH,
          transaction: TRANSACTION,
          curve: Curve.Secp256k1,
        },
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
        getMptDescriptors: getMptDescriptorsMock,
        signTransaction: signTransactionMock,
      });
      return deviceAction;
    };

    const getMptDescriptorsState = {
      status: DeviceActionStatus.Pending,
      intermediateValue: {
        requiredUserInteraction: UserInteractionRequired.None,
        step: SignTransactionDAStep.GET_MPT_DESCRIPTORS,
      },
    } as const;
    const signState = {
      status: DeviceActionStatus.Pending,
      intermediateValue: {
        requiredUserInteraction: UserInteractionRequired.SignTransaction,
        step: SignTransactionDAStep.SIGN_TRANSACTION,
      },
    } as const;
    const completedState = {
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    } as const;

    const expectSignedWith = (mptDescriptors: unknown) => {
      expect(signTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            mptDescriptors,
            derivationPath: DERIVATION_PATH,
            transaction: TRANSACTION,
            curve: Curve.Secp256k1,
          },
        }),
      );
    };

    beforeEach(() => {
      getMptDescriptorsMock.mockResolvedValue(MPT_DESCRIPTORS);
    });

    it("gets the descriptors, then signs with them, when the app is open", () =>
      new Promise<void>((resolve, reject) => {
        testDeviceActionStates(
          makeDeviceActionWithContextModule(true),
          [getMptDescriptorsState, signState, completedState],
          apiMock,
          {
            onDone: () => {
              expect(getMptDescriptorsMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: { contextModule, transaction: TRANSACTION },
                }),
              );
              expectSignedWith(MPT_DESCRIPTORS);
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("gets the descriptors after the app opens", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

        testDeviceActionStates(
          makeDeviceActionWithContextModule(false),
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            getMptDescriptorsState,
            signState,
            completedState,
          ],
          apiMock,
          {
            onDone: () => {
              expectSignedWith(MPT_DESCRIPTORS);
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("still signs, without descriptors, when getting them fails", () =>
      new Promise<void>((resolve, reject) => {
        getMptDescriptorsMock.mockRejectedValue(new Error("CAL is down"));

        testDeviceActionStates(
          makeDeviceActionWithContextModule(true),
          [getMptDescriptorsState, signState, completedState],
          apiMock,
          {
            onDone: () => {
              expectSignedWith([]);
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("does not get descriptors when opening the app fails", () =>
      new Promise<void>((resolve, reject) => {
        const openAppError = new UnknownDAError("OpenApp failed");
        setupOpenAppDAMock(openAppError);

        testDeviceActionStates(
          makeDeviceActionWithContextModule(false),
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            { status: DeviceActionStatus.Error, error: openAppError },
          ],
          apiMock,
          {
            onDone: () => {
              expect(getMptDescriptorsMock).not.toHaveBeenCalled();
              expect(signTransactionMock).not.toHaveBeenCalled();
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("skips the descriptors step without a context module", () =>
      new Promise<void>((resolve, reject) => {
        testDeviceActionStates(
          makeDeviceAction(true),
          [signState, completedState],
          apiMock,
          {
            onDone: () => {
              expect(getMptDescriptorsMock).not.toHaveBeenCalled();
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("builds a descriptors dependency that asks the context module", async () => {
      const getContexts = vi.fn().mockResolvedValue([]);
      apiMock.getDeviceSessionState.mockReturnValue({
        deviceModelId: DeviceModelId.FLEX,
      } as ReturnType<typeof apiMock.getDeviceSessionState>);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          loggerFactory,
          derivationPath: DERIVATION_PATH,
          transaction: TRANSACTION,
          skipOpenApp: true,
          curve: Curve.Secp256k1,
        },
      });

      const { getMptDescriptors } = deviceAction.extractDependencies(apiMock);
      const descriptors = await getMptDescriptors({
        input: {
          contextModule: { getContexts } as unknown as ContextModule,
          transaction: TRANSACTION,
        },
      });

      expect(descriptors).toStrictEqual([]);
      expect(getContexts).toHaveBeenCalledWith(
        { rawTransaction: TRANSACTION, deviceModelId: DeviceModelId.FLEX },
        [ClearSignContextType.XRP_MPT_TOKEN],
      );
    });
  });
});
