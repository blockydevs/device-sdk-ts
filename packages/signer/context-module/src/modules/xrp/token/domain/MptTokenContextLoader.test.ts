import {
  DeviceModelId,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type MptTokenDataSource } from "@/modules/xrp/token/data/MptTokenDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { MptTokenContextLoader } from "./MptTokenContextLoader";

const ISSUANCE_A = "0631381B71048C4D35D2044917EE3C26F60E6CA8FC954A71";
const ISSUANCE_B = "064E278B6D15D1F5614B4D4E3183F835BCD62E7F6FD9FFD8";
const ISSUANCE_C = "000000050511E17DB83BB6F113939D67BC8EA539EDC926FC";

const XRP_PAYMENT =
  "120000220000000024000000036140000000000f424068400000000000000f81140511e17db83bb6f113939d67bc8ea539edc926fc";

const CERTIFICATE = {
  keyUsageNumber: 8,
  payload: new Uint8Array([0x01, 0x02]),
};

// Amount (field 1), SendMax (field 9) and DeliverMin (field 10), each an MPT
// amount of the given issuance.
const makeMptPayment = (...issuanceIds: string[]) => {
  const headers = ["61", "69", "6a"];
  const amounts = issuanceIds
    .map((id, i) => `${headers[i]}600000000000000001${id}`)
    .join("");
  return hexaStringToBuffer(
    `120000${amounts}81140511e17db83bb6f113939d67bc8ea539edc926fc`,
  )!;
};

const makeSuccessContext = (issuanceId: string) => {
  return {
    certificate: CERTIFICATE,
    type: ClearSignContextType.XRP_MPT_TOKEN,
    payload: `descriptor-${issuanceId}`,
  };
};

describe("MptTokenContextLoader", () => {
  let dataSource: { getMptDescriptor: ReturnType<typeof vi.fn> };
  let certificateLoader: { loadCertificate: ReturnType<typeof vi.fn> };
  let loader: MptTokenContextLoader;

  const load = (rawTransaction: Uint8Array) => {
    return loader.load({ rawTransaction, deviceModelId: DeviceModelId.FLEX });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dataSource = {
      getMptDescriptor: vi
        .fn()
        .mockImplementation(({ issuanceId }: { issuanceId: string }) => {
          return Promise.resolve(Right(`descriptor-${issuanceId}`));
        }),
    };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(CERTIFICATE),
    };
    loader = new MptTokenContextLoader(
      dataSource as unknown as MptTokenDataSource,
      certificateLoader as unknown as PkiCertificateLoader,
    );
  });

  describe("canHandle", () => {
    const input = {
      rawTransaction: makeMptPayment(ISSUANCE_A),
      deviceModelId: DeviceModelId.FLEX,
    };

    it("should handle a transaction when the MPT type is expected", () => {
      expect(
        loader.canHandle(input, [ClearSignContextType.XRP_MPT_TOKEN]),
      ).toBe(true);
    });

    it("should not handle it when the MPT type is not expected", () => {
      expect(loader.canHandle(input, [ClearSignContextType.TRON_TOKEN])).toBe(
        false,
      );
    });

    it.each([
      ["null", null],
      ["an empty object", {}],
      ["no device model", { rawTransaction: input.rawTransaction }],
      [
        "a hex string",
        { rawTransaction: "1200", deviceModelId: DeviceModelId.FLEX },
      ],
      [
        "an empty transaction",
        { rawTransaction: new Uint8Array(), deviceModelId: DeviceModelId.FLEX },
      ],
    ])("should not handle %s", (_label, value) => {
      expect(
        loader.canHandle(value, [ClearSignContextType.XRP_MPT_TOKEN]),
      ).toBe(false);
    });
  });

  describe("load", () => {
    it("should return nothing for a transaction without MPT", async () => {
      const contexts = await load(hexaStringToBuffer(XRP_PAYMENT)!);

      expect(contexts).toStrictEqual([]);
      expect(certificateLoader.loadCertificate).not.toHaveBeenCalled();
      expect(dataSource.getMptDescriptor).not.toHaveBeenCalled();
    });

    it("should return the descriptor of one issuance with the coin meta certificate", async () => {
      const contexts = await load(makeMptPayment(ISSUANCE_A));

      expect(contexts).toStrictEqual([makeSuccessContext(ISSUANCE_A)]);
      expect(certificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.TokenMetadataKey,
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: DeviceModelId.FLEX,
      });
    });

    it("should return the descriptors of two issuances in transaction order", async () => {
      const contexts = await load(makeMptPayment(ISSUANCE_A, ISSUANCE_B));

      expect(contexts).toStrictEqual([
        makeSuccessContext(ISSUANCE_A),
        makeSuccessContext(ISSUANCE_B),
      ]);
      expect(certificateLoader.loadCertificate).toHaveBeenCalledTimes(1);
    });

    it("should keep only the first two issuances", async () => {
      const contexts = await load(
        makeMptPayment(ISSUANCE_A, ISSUANCE_B, ISSUANCE_C),
      );

      expect(contexts).toStrictEqual([
        makeSuccessContext(ISSUANCE_A),
        makeSuccessContext(ISSUANCE_B),
      ]);
      expect(dataSource.getMptDescriptor).toHaveBeenCalledTimes(2);
    });

    it("should return one error when the certificate is missing", async () => {
      certificateLoader.loadCertificate.mockResolvedValue(undefined);

      const contexts = await load(makeMptPayment(ISSUANCE_A, ISSUANCE_B));

      expect(contexts).toStrictEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] MptTokenContextLoader: token metadata certificate is missing",
          ),
        },
      ]);
      expect(dataSource.getMptDescriptor).not.toHaveBeenCalled();
    });

    it("should return an error for the issuance the data source fails on", async () => {
      const error = new Error("no descriptor");
      dataSource.getMptDescriptor.mockImplementation(
        ({ issuanceId }: { issuanceId: string }) => {
          const descriptor =
            issuanceId === ISSUANCE_A
              ? Left(error)
              : Right(`descriptor-${issuanceId}`);
          return Promise.resolve(descriptor);
        },
      );

      const contexts = await load(makeMptPayment(ISSUANCE_A, ISSUANCE_B));

      expect(contexts).toStrictEqual([
        { error, type: ClearSignContextType.ERROR },
        makeSuccessContext(ISSUANCE_B),
      ]);
    });
  });
});
