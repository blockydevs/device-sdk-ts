# Signer Hedera

This package provides a signer implementation for Hedera.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-hedera
```

## Usage

```typescript
import { SignerHederaBuilder } from "@ledgerhq/device-signer-kit-hedera";

const signer = new SignerHederaBuilder({ dmk, sessionId }).build();

// Read the app version, optionally skipping the automatic app opening
const { observable } = signer.getAppConfig({ skipOpenApp: false });

// Get the public key at m/44'/3030'/0'/0'/0'
signer.getAddress("44'/3030'/0'/0'/0'", { checkOnDevice: true });

// Sign a serialized Hedera TransactionBody protobuf
signer.signTransaction("44'/3030'/0'/0'/0'", transactionBody);
```

## App configuration

`getAppConfig` takes optional `AppConfigOptions` and returns the app version.
The first response byte from the device is reserved for future use and is not
surfaced.

```typescript
type AppConfigOptions = {
  skipOpenApp?: boolean;
};

type AppConfig = {
  version: string;
};
```

## Derivation path

The device app hardcodes the path as `m/44'/3030'/0'/0'/index'` and takes the
index alone over the wire. Two shapes are accepted:

- `44'/3030'/0'/0'/index'`, the full path.
- `44'/3030'`, the shape Ledger Live's `hederaBip44` derivation mode sends, for
  which the index is 0.

A leading `m/` is optional. Any other path is rejected. Hardening is ignored,
so `44/3030` and `44'/3030'` are the same path.

## Addresses

A Hedera account is a `shard.realm.num` triplet and is not derivable from a
key, so `getAddress` returns the public key only. The account id has to come
from elsewhere, typically a mirror node lookup.

## Transaction size

The app takes the whole transaction body in one APDU, so the body is limited to
251 bytes: the 255-byte APDU payload less the 4-byte key index.

An empty body, a body over the limit, and a path the app cannot derive all
reach the observable as a `HederaInvalidInputError` whose `errorCode` is
`empty_transaction`, `transaction_too_large` or `unsupported_derivation_path`.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```
