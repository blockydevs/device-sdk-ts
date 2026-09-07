/**
 * A Hedera account is identified by a `shard.realm.num` triplet that is not
 * derivable from a key, so the device can only return the public key. The
 * account id has to come from elsewhere, typically a mirror node lookup.
 */
export type Address = {
  /** Raw Ed25519 public key, 32 bytes as a lower-case hex string. */
  publicKey: string;
};
