/**
 * EIP-191 Signing Utilities
 * Provides Ethereum personal message signing for DRVC3 receipts
 */

import { Wallet, HDNodeWallet, verifyMessage } from 'ethers';

/**
 * Signs a hash using EIP-191 (Ethereum Signed Message)
 * @param hash - The hex string hash to sign
 * @param wallet - ethers Wallet instance with private key
 * @returns Promise resolving to the signature hex string
 */
export async function signHash(hash: string, wallet: Wallet | HDNodeWallet): Promise<string> {
  // signMessage automatically prefixes with "\x19Ethereum Signed Message:\n" + message length
  return wallet.signMessage(hash);
}

/**
 * Recovers the signer address from a hash and signature
 * @param hash - The original hash that was signed
 * @param signature - The EIP-191 signature
 * @returns The signer's Ethereum address
 */
export function recoverSigner(hash: string, signature: string): string {
  return verifyMessage(hash, signature);
}

/**
 * Verifies that a signature was created by the expected signer
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
