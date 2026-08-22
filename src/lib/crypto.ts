/**
 * Cryptographic utilities for:
 * - Secure temporary key generation
 * - Key hashing (bcrypt)
 * - Provider credential encryption/decryption (AES-256-GCM)
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const KEY_PREFIX = "tmp_";
const KEY_BYTES = 24; // 192-bit entropy → 32 hex chars

// ─── Key Generation ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure temporary API key.
 * Returns the full plaintext key (displayed once to user).
 */
export function generateSandboxKey(): string {
  const bytes = crypto.randomBytes(KEY_BYTES);
  return KEY_PREFIX + bytes.toString("hex");
}

/**
 * Hash a sandbox key for storage (bcrypt).
 * We never store the plaintext key in the database.
 */
export async function hashSandboxKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS);
}

/**
 * Verify a submitted key against its stored hash.
 */
export async function verifySandboxKey(
  key: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Extract the display prefix from a key (first 14 chars, e.g. "tmp_a8f91c7d...")
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 14) + "...";
}

// ─── Provider Credential Encryption ─────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    // Fallback for dev — NOT safe for production
    if (process.env.NODE_ENV !== "production") {
      return Buffer.from("0".repeat(64), "hex");
    }
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a provider API key for secure database storage.
 * Returns a base64-encoded string containing IV + ciphertext + auth tag.
 */
export function encryptCredential(plaintext: string): string {
  const encKey = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv) as crypto.CipherGCM;
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  
  // Format: iv (16B) + tag (16B) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a provider API key from secure database storage.
 */
export function decryptCredential(ciphertext: string): string {
  const encKey = getEncryptionKey();
  const data = Buffer.from(ciphertext, "base64");
  
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, encKey, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

// ─── Password Hashing ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Request ID ─────────────────────────────────────────────────────────────

export function generateRequestId(): string {
  return "req_" + crypto.randomBytes(8).toString("hex");
}

// ─── IP Hashing (for privacy) ────────────────────────────────────────────────

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + (process.env.ENCRYPTION_KEY ?? "salt")).digest("hex").substring(0, 16);
}
