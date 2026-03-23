// ---------------------------------------------------------------------------
// Application-level secret encryption — AES-256-GCM
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive a 256-bit key from the master secret using scrypt.
 * Salt is prepended to the ciphertext so each encryption produces unique output.
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

function getMasterKey(): string {
  const key = process.env.SOVEREIGN_SECRET_KEY;
  if (!key || key.length < 16) {
    throw new Error(
      "SOVEREIGN_SECRET_KEY environment variable must be set (min 16 chars) for credential encryption",
    );
  }
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM with a derived key.
 * Output format: base64(salt + iv + tag + ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const masterKey = getMasterKey();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: salt(16) + iv(16) + tag(16) + ciphertext
  const packed = Buffer.concat([salt, iv, tag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a value encrypted by encryptSecret.
 */
export function decryptSecret(encryptedBase64: string): string {
  const masterKey = getMasterKey();
  const packed = Buffer.from(encryptedBase64, "base64");

  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(masterKey, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf-8");
}
