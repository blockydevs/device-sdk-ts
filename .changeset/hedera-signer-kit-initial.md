---
"@ledgerhq/device-signer-kit-hedera": minor
---

Add the Hedera signer kit with support for reading the app configuration, retrieving the public key at a derivation path, and signing a serialized `TransactionBody` protobuf. `getAppConfiguration` takes optional `AppConfigurationOptions` with a `skipOpenApp` flag and returns the app version. A Hedera account is a `shard.realm.num` triplet that is not derivable from a key, so `getAddress` returns the public key only. An empty transaction body, a body over the 251-byte single-APDU limit, and a derivation path the app cannot derive resolve to a typed `HederaInvalidInputError` in the device action error channel.
