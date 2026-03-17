# Adapter ethers → noble – build log

**Date:** 2026-03-17

## What was done

1. **Dependencies** ([uvrn-adapter/package.json](../uvrn-adapter/package.json))  
   - Removed `ethers`.  
   - Added `@noble/hashes` (^1.4.0) and `@noble/secp256k1` (^2.0.0).  
   - Added devDependencies for Jest ESM handling: `babel-jest`, `@babel/core`, `@babel/preset-env`.

2. **Signer** ([uvrn-adapter/src/signer.ts](../uvrn-adapter/src/signer.ts))  
   - EIP-191: prefixed message (UTF-8) → keccak_256 → secp256k1 sign; signature serialized as r‖s‖v (v = recovery + 27).  
   - Recovery: parse signature, recover public key via `secp.Signature.fromBytes(compact).addRecoveryBit(recovery).recoverPublicKey(messageHash)`, then address = last 20 bytes of keccak256(uncompressed pubkey sans first byte), EIP-55 checksummed.  
   - New helper: `privateKeyToAddress(privateKeyHex)`.

3. **Wrapper** ([uvrn-adapter/src/wrapper.ts](../uvrn-adapter/src/wrapper.ts))  
   - `wrapInDRVC3(deltaReceipt, signerPrivateKeyHex, options)`; uses `signHash` and `privateKeyToAddress` for signature and `integrity.signer_address`.  
   - No ethers imports; JSDoc updated.

4. **Tests** ([uvrn-adapter/tests/wrapper.test.ts](../uvrn-adapter/tests/wrapper.test.ts), [uvrn-adapter/tests/integration.test.ts](../uvrn-adapter/tests/integration.test.ts))  
   - Fixed test key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`; expected address derived via `privateKeyToAddress`.  
   - All `wrapInDRVC3(..., testWallet, ...)` → `wrapInDRVC3(..., TEST_PRIVATE_KEY_HEX, ...)`.

5. **Jest** ([uvrn-adapter/jest.config.js](../uvrn-adapter/jest.config.js), [uvrn-adapter/babel.config.cjs](../uvrn-adapter/babel.config.cjs))  
   - `transformIgnorePatterns: ['/node_modules/(?!.*@noble)']` so @noble is transformed.  
   - `transform: { '.*@noble.*\\.js$': 'babel-jest' }`; Babel preset-env with `modules: 'commonjs'` for ESM→CJS.

6. **Exports** ([uvrn-adapter/src/index.ts](../uvrn-adapter/src/index.ts))  
   - Exported `privateKeyToAddress`.

7. **Docs and discipline**  
   - [uvrn-adapter/README.md](../uvrn-adapter/README.md): usage with private key hex.  
   - [uvrn-adapter/CHANGELOG.md](../uvrn-adapter/CHANGELOG.md): Created with Unreleased Changed/Breaking.  
   - [CHANGELOG.md](../CHANGELOG.md): Unreleased entry for adapter refactor.  
   - This report and build log.

## Good next steps

- Bump @uvrn/adapter version (e.g. 1.4.0) when cutting a release that includes this breaking change.  
- Update any consumers (CLI, API, or external apps) that call `wrapInDRVC3` or `signHash` with an ethers Wallet to pass the private key hex instead.  
- Run `pnpm run build` and `pnpm test` from repo root to confirm full workspace still passes.
