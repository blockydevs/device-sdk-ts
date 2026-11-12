# Signer xrp

This package provides a signer implementation for xrp.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-xrp
```

## Usage

```typescript
import { SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";

const signer = new SignerXrpBuilder({ dmk, sessionId }).build();

// Get address
const { observable: address$ } = signer.getAddress("44'/144'/0'/0/0");

// Sign transaction
const { observable: signature$ } = signer.signTransaction(
  "44'/144'/0'/0/0",
  transactionBytes,
);
```

### Curves

The signer uses secp256k1 by default, like Ledger Wallet. For an account created with Ed25519, pass the same `curve` to both calls: on another curve, the same derivation path is a different XRPL account, and a signature made with the wrong curve is rejected by the network.

```typescript
import { Curve, SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";

const signer = new SignerXrpBuilder({ dmk, sessionId }).build();
const path = "44'/144'/0'/0/0";

const { observable: address$ } = signer.getAddress(path, {
  curve: Curve.Ed25519,
});

const { observable: signature$ } = signer.signTransaction(
  path,
  transactionBytes,
  { curve: Curve.Ed25519 },
);
```

With Ed25519, the public key starts with `ED` and the signature is 64 raw bytes instead of a DER signature. In both cases, its uppercase hex goes in `TxnSignature`.

Getting an Ed25519 address requires XRP app 2.8.0 or later: older versions answer `6f88`. Signing with Ed25519 works on older versions too.

### Multi-Purpose Tokens (MPT)

XRP app 2.9.0 and later shows the ticker and the amount of an MPT in clear text. To do this, the app needs a signed descriptor for each MPT of the transaction.

`signTransaction` reads the MPT issuance IDs from the transaction and gets their descriptors from the Ledger CAL. Before the transaction, it sends the Ledger certificate (`B0 06`) and the descriptor (`E0 22`) for each MPT, with a maximum of two. You do not have to change your code.

If the signer cannot get or send a descriptor, it still sends the transaction. The app then decides:

- An MPT `Payment` or `Clawback` uses blind signing. If blind signing is disabled in the app settings, the app refuses the transaction (`6985`).
- `MPTokenAuthorize`, `MPTokenIssuanceSet` and `MPTokenIssuanceDestroy` use clear signing, without the "Token" row.

An app older than 2.9.0 refuses the descriptor (`6d00`). The signer then sends the transaction as before.

To get the descriptors from another source, give your own context module:

```typescript
import { SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";

const signer = new SignerXrpBuilder({ dmk, sessionId })
  .withContextModule(contextModule)
  .build();
```

The context module must return `ClearSignContextType.XRP_MPT_TOKEN` contexts, with the descriptor TLV in hex and the certificate.

`SignTransactionDeviceActionFactory` also takes an optional `contextModule`. Without it, the device action sends no certificate and no descriptor.

## Supported devices

Nano S Plus, Nano X, Stax, Flex and Apex P. XRP app 2.9.0 does not support Nano S.

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
