import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { GetMptDescriptorsTask } from "./GetMptDescriptorsTask";

const TRANSACTION = new Uint8Array([0x12, 0x00, 0x00]);
const CERTIFICATE = { keyUsageNumber: 8, payload: new Uint8Array([0x01]) };

const makeDescriptorContext = (payload: string): ClearSignContext => {
  return {
    payload,
    certificate: CERTIFICATE,
    type: ClearSignContextType.XRP_MPT_TOKEN,
  };
};

describe("GetMptDescriptorsTask", () => {
  const api = makeDeviceActionInternalApiMock();
  const getContexts = vi.fn();
  const warn = vi.fn();
  const loggerFactory = () => {
    return {
      warn,
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      subscribers: [],
    } as unknown as LoggerPublisherService;
  };

  const run = () => {
    return new GetMptDescriptorsTask(api, {
      loggerFactory,
      transaction: TRANSACTION,
      contextModule: { getContexts } as unknown as ContextModule,
    }).run();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDeviceSessionState.mockReturnValue({
      deviceModelId: DeviceModelId.FLEX,
    } as ReturnType<typeof api.getDeviceSessionState>);
  });

  it("should ask the context module for the MPT descriptors of the transaction", async () => {
    getContexts.mockResolvedValue([]);

    await run();

    expect(getContexts).toHaveBeenCalledWith(
      { rawTransaction: TRANSACTION, deviceModelId: DeviceModelId.FLEX },
      [ClearSignContextType.XRP_MPT_TOKEN],
    );
  });

  it("should keep the descriptors with their certificate, in order", async () => {
    getContexts.mockResolvedValue([
      makeDescriptorContext("0101"),
      makeDescriptorContext("0202"),
    ]);

    const mptDescriptors = await run();

    expect(mptDescriptors).toStrictEqual([
      { descriptor: new Uint8Array([0x01, 0x01]), certificate: CERTIFICATE },
      { descriptor: new Uint8Array([0x02, 0x02]), certificate: CERTIFICATE },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("should drop and log the error contexts", async () => {
    getContexts.mockResolvedValue([
      { type: ClearSignContextType.ERROR, error: new Error("no descriptor") },
      makeDescriptorContext("0202"),
    ]);

    const mptDescriptors = await run();

    expect(mptDescriptors).toStrictEqual([
      { descriptor: new Uint8Array([0x02, 0x02]), certificate: CERTIFICATE },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["not hex", "zz"],
    ["empty", ""],
    ["larger than one APDU", "aa".repeat(256)],
  ])("should drop a descriptor that is %s", async (_label, payload) => {
    getContexts.mockResolvedValue([makeDescriptorContext(payload)]);

    const mptDescriptors = await run();

    expect(mptDescriptors).toStrictEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("should return no descriptor when the context module fails", async () => {
    getContexts.mockRejectedValue(new Error("CAL is down"));

    const mptDescriptors = await run();

    expect(mptDescriptors).toStrictEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
