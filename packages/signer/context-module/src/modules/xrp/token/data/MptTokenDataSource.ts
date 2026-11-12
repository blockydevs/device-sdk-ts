import { array, Codec, type Either, string } from "purify-ts";

export type GetMptDescriptorParams = {
  /** Uppercase hex, 24 bytes. */
  issuanceId: string;
};

/**
 * Only the fields the payload is read from are validated: a CAL change to the
 * ones we ignore must not downgrade a signable descriptor to a blind signature.
 */
export const mptTokenDataResponsesCodec = array(
  Codec.interface({
    descriptor: Codec.interface({
      data: string,
      signatures: Codec.interface({
        prod: string,
        test: string,
      }),
    }),
  }),
);

export interface MptTokenDataSource {
  /** Resolves to the hex descriptor TLV, signature tag included. */
  getMptDescriptor(
    params: GetMptDescriptorParams,
  ): Promise<Either<Error, string>>;
}
