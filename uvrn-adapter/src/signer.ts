/**
 * EIP-191 Signing Utilities
 * Provides Ethereum personal message signing for DRVC3 receipts using @noble/hashes and @noble/secp256k1
 */

import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils';
import * as secp from '@noble/secp256k1';

const EIP191_PREFIX = '\x19Ethereum Signed Message:\n';

/**
 * Build EIP-191 prefixed message and return its keccak256 hash (what gets signed).
 * Message is treated as UTF-8 (matches ethers signMessage behavior for string input).
 */
function eip191MessageHash(message: string): Uint8Array {
  const messageBytes = utf8ToBytes(message);
  const prefix = utf8ToBytes(EIP191_PREFIX + messageBytes.length);
  const prefixed = concatBytes(prefix, messageBytes);
  return keccak_256(prefixed);
}

/**
 * Normalize hex private key to 32-byte Uint8Array (strip 0x, require 64 hex chars).
 */
function privateKeyToBytes(privateKeyHex: string): Uint8Array {
  const hex = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('Invalid private key: expected 64 hex chars (with or without 0x)');
  }
  return hexToBytes(hex);
}

/**
 * Serialize signature to 65-byte Ethereum format: r (32) || s (32) || v (1), v = recovery + 27.
 */
function signatureToEthereumFormat(sig: { toBytes: () => Uint8Array; recovery: number }): string {
  const compact = sig.toBytes();
  const v = sig.recovery + 27;
  const out = new Uint8Array(65);
  out.set(compact, 0);
  out[64] = v;
  return '0x' + bytesToHex(out);
}

/**
 * Parse 0x-prefixed 65-byte signature into r, s, recovery for recovery.
 */
function parseSignature(signature: string): { r: Uint8Array; s: Uint8Array; recovery: number } {
  const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
  if (hex.length !== 130) {
    throw new Error('Invalid signature: expected 65 bytes (130 hex chars)');
  }
  const bytes = hexToBytes(hex);
  const r = bytes.slice(0, 32);
  const s = bytes.slice(32, 64);
  const v = bytes[64];
  if (v !== 27 && v !== 28) {
    throw new Error('Invalid signature: v must be 27 or 28');
  }
  const recovery = v - 27;
  return { r, s, recovery };
}

/**
 * Ethereum address from uncompressed public key: keccak256(pubkey[1:65]), last 20 bytes.
 */
function publicKeyToAddress(pubKey: Uint8Array): string {
  if (pubKey.length !== 65) {
    throw new Error('Expected 65-byte uncompressed public key');
  }
  const hash = keccak_256(pubKey.slice(1));
  const addressBytes = hash.slice(-20);
  return toChecksumAddress('0x' + bytesToHex(addressBytes));
}

/**
 * EIP-55 checksum: keccak256(lowercase address hex), then uppercase hex chars where hash nibble >= 8.
 */
function toChecksumAddress(address: string): string {
  const hex = address.startsWith('0x') ? address.slice(2).toLowerCase() : address.toLowerCase();
  if (hex.length !== 40) {
    throw new Error('Invalid address length');
  }
  const hash = keccak_256(utf8ToBytes(hex));
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    const nibble = (hash[Math.floor(i / 2)] >> (4 * (1 - (i % 2)))) & 0xf;
    result += nibble >= 8 ? hex[i].toUpperCase() : hex[i];
  }
  return result;
}

/**
 * Signs a hash using EIP-191 (Ethereum Signed Message).
 * @param hash - The hex string hash (or message) to sign; treated as UTF-8 for EIP-191 prefixing
 * @param privateKeyHex - Raw hex private key (64 hex chars, optional 0x prefix)
 * @returns Promise resolving to the signature hex string (0x-prefixed, 65 bytes)
 */
export async function signHash(hash: string, privateKeyHex: string): Promise<string> {
  const messageHash = eip191MessageHash(hash);
  const privKey = privateKeyToBytes(privateKeyHex);
  const sig = await secp.signAsync(messageHash, privKey);
  return signatureToEthereumFormat(sig);
}

/**
 * Recovers the signer address from a hash and EIP-191 signature.
 * @param hash - The original hash (message) that was signed
 * @param signature - The EIP-191 signature (0x-prefixed 65-byte hex)
 * @returns The signer's Ethereum address (EIP-55 checksummed)
 */
export function recoverSigner(hash: string, signature: string): string {
  const messageHash = eip191MessageHash(hash);
  const { r, s, recovery } = parseSignature(signature);
  // Reconstruct RecoveredSignature for noble: we need a Signature-like with recovery.
  // noble's recoverPublicKey(sig, msg) expects sig to have r, s, recovery. Build from compact bytes.
  const compact = concatBytes(r, s);
  const sig = secp.Signature.fromBytes(compact).addRecoveryBit(recovery);
  const pubKey = sig.recoverPublicKey(messageHash);
  const pubKeyBytes = pubKey.toBytes(false);
  return publicKeyToAddress(pubKeyBytes);
}

/**
 * Derives the Ethereum address (EIP-55) for a given private key.
 * @param privateKeyHex - Raw hex private key (64 hex chars, optional 0x prefix)
 * @returns The address (checksummed)
 */
export function privateKeyToAddress(privateKeyHex: string): string {
  const privKey = privateKeyToBytes(privateKeyHex);
  const pubKey = secp.getPublicKey(privKey, false);
  return publicKeyToAddress(pubKey);
}

/**
 * Verifies that a signature was created by the expected signer.
 * @param hash - The original hash that was signed
 * @param signature - The EIP-191 signature
 * @param expectedAddress - The expected signer address
 * @returns True if the signature is valid and matches the expected address
 */
export function verifySignature(
  hash: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = recoverSigner(hash, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}
