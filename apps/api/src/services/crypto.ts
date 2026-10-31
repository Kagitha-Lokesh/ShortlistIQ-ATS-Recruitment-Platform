import crypto from 'node:crypto';

// 32-byte encryption key for AES-256-GCM
function getEncryptionKey(): Buffer {
  const envKey = process.env.EMAIL_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    // Derive exactly 32 bytes using SHA-256 hash of the secret string
    return crypto.createHash('sha256').update(envKey).digest();
  }
  // Deterministic fallback for dev/test environment
  return crypto.createHash('sha256').update('shortlistiq-dev-secret-email-encryption-key-2026').digest();
}

/**
 * Encrypts a sensitive refresh token using AES-256-GCM.
 * Output format: `iv:authTag:encryptedData` (all hex encoded)
 */
export function encryptToken(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 * Input format: `iv:authTag:encryptedData`
 */
export function decryptToken(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token payload format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

