import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpMptTokenDataSource } from "./HttpMptTokenDataSource";

const ISSUANCE_ID = "000000050511E17DB83BB6F113939D67BC8EA539EDC926FC";
// USDX, scale 2, from app-xrp `doc/mpt-integration.md` section 5.4.1.
const DATA =
  "0101900201010304800000900403585250050455534458060102071A1018000000050511E17DB83BB6F113939D67BC8EA539EDC926FC";
const PROD_SIGNATURE =
  "30440220377F1F63363A4F89ABF9DCF80A01054408B926A4D823B71314086A2513827FA602207D54ED5118F5722637D31E9641D714D72D8FA8DBD7ECF54C23253A1227A11E0E";
// 71 bytes
const TEST_SIGNATURE = `3045022100${"AA".repeat(32)}0220${"BB".repeat(32)}`;

describe("HttpMptTokenDataSource", () => {
  let httpMock: { get: ReturnType<typeof vi.fn> };

  const entry = {
    id: `ripple/mpt/${ISSUANCE_ID.toLowerCase()}`,
    ticker: "USDX",
    decimals: 2,
    descriptor: {
      data: DATA,
      descriptorType: "token",
      signatures: { prod: PROD_SIGNATURE, test: TEST_SIGNATURE },
    },
  };

  const makeDataSource = (mode: "prod" | "test") => {
    return new HttpMptTokenDataSource(
      {
        cal: {
          mode,
          url: "https://global.api.prd.ledger.com/cal/v1",
          branch: "main",
        },
      } as ContextModuleServiceConfig,
      httpMock as unknown as DmkNetworkClient,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
  });

  it("should ask CAL for the issuance ID in lowercase", async () => {
    httpMock.get.mockResolvedValue([]);

    await makeDataSource("prod").getMptDescriptor({ issuanceId: ISSUANCE_ID });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/tokens",
      {
        params: {
          id: "ripple/mpt/000000050511e17db83bb6f113939d67bc8ea539edc926fc",
          output: "id,ticker,decimals,descriptor",
          ref: "branch:main",
        },
      },
    );
  });

  it.each([
    ["prod", `${DATA}0846${PROD_SIGNATURE}`],
    ["test", `${DATA}0847${TEST_SIGNATURE}`],
  ] as const)(
    "should append the %s signature as the last TLV field",
    async (mode, expected) => {
      httpMock.get.mockResolvedValue([entry]);

      const result = await makeDataSource(mode).getMptDescriptor({
        issuanceId: ISSUANCE_ID,
      });

      expect(result).toStrictEqual(Right(expected));
    },
  );

  it.each([
    ["an empty list", []],
    ["an entry without descriptor", [{ id: entry.id }]],
    [
      "an empty signature",
      [
        {
          ...entry,
          descriptor: {
            ...entry.descriptor,
            signatures: { prod: "", test: "" },
          },
        },
      ],
    ],
    ["a non-list body", { message: "error" }],
  ])("should return an error for %s", async (_label, body) => {
    httpMock.get.mockResolvedValue(body);

    const result = await makeDataSource("prod").getMptDescriptor({
      issuanceId: ISSUANCE_ID,
    });

    expect(result).toStrictEqual(
      Left(
        new Error(
          `[ContextModule] HttpMptTokenDataSource: no descriptor for issuance id ${ISSUANCE_ID}`,
        ),
      ),
    );
  });

  it("should return an error when the request fails", async () => {
    httpMock.get.mockRejectedValue(new Error("network error"));

    const result = await makeDataSource("prod").getMptDescriptor({
      issuanceId: ISSUANCE_ID,
    });

    expect(result).toStrictEqual(
      Left(
        new Error(
          "[ContextModule] HttpMptTokenDataSource: Failed to fetch the MPT descriptor",
        ),
      ),
    );
  });
});
