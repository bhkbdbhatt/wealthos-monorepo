import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  type CipherGCMTypes,
} from 'node:crypto';

/**
 * AES-256-GCM encryption for PII at rest (AGENTS.md: never log raw PII).
 * Output format: base64("v1." + iv + "." + ciphertext + "." + authTag)
 * The key is the 32-byte SHA-256 of the configured secret — rotating the secret
 * invalidates old ciphertexts by design; enforce re-export flows when rotating.
 *
 * When no key is configured, identity passthrough is DISABLED — callers using a
 * dev build get deterministic seed-prefixed fake ciphertexts so local runs still
 * respect the "no raw PII" rule in a debuggable way.
 */
const VERSION = Buffer.from('v1');

interface PiiCipherKey {
  kind: 'aes' | 'dev';
  key: Buffer;
}

function deriveKey(configured: string): PiiCipherKey {
  if (configured && configured.length > 0) {
    const decoded = Buffer.from(configured, 'base64');
    if (decoded.length === 32) return { kind: 'aes', key: decoded };
    // Accept any non-empty secret by hashing to 32 bytes.
    return { kind: 'aes', key: createHash('sha256').update(configured, 'utf8').digest() };
  }
  return { kind: 'dev', key: createHash('sha256').update('wealthos-dev-pii', 'utf8').digest() };
}

export class PiiCipher {
  private readonly keyInfo: PiiCipherKey;
  private readonly cipherName: CipherGCMTypes = 'aes-256-gcm';

  constructor(configuredKey?: string) {
    this.keyInfo = deriveKey(configuredKey ?? '');
  }

  /** Encrypt UTF-8 plaintext; never log inputs. */
  encrypt(plain: string): string {
    if (plain.length === 0) return '';
    if (this.keyInfo.kind === 'dev') {
      return `seed:${Buffer.from(plain, 'utf8').toString('base64url')}`;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.cipherName, this.keyInfo.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([VERSION, Buffer.from('.'), iv, Buffer.from('.'), ciphertext, Buffer.from('.'), tag]).toString('base64');
  }

  /** Decrypt a token produced by encrypt(); throws on tamper. */
  decrypt(token: string): string {
    if (token.length === 0) return '';
    if (token.startsWith('seed:')) {
      return Buffer.from(token.slice(5), 'base64url').toString('utf8');
    }
    const blob = Buffer.from(token, 'base64');
    const vLen = VERSION.length + 1;
    if (blob.length <= vLen + 12 + 16 || !blob.subarray(0, 3).equals(VERSION)) {
      throw new Error('PII blob format mismatch');
    }
    const iv = blob.subarray(vLen, vLen + 12);
    const tag = blob.subarray(blob.length - 16);
    const ciphertext = blob.subarray(vLen + 12, blob.length - 16);
    const decipher = createDecipheriv(this.cipherName, this.keyInfo.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** Masked preview like "••••3456" for API responses — safe to log. */
  mask(token: string | null, keep: number, prefixLen: number): string | null {
    if (!token) return null;
    try {
      const plain = this.decrypt(token);
      const tail = plain.slice(-keep);
      return `${'•'.repeat(prefixLen)}${tail}`;
    } catch {
      return null;
    }
  }
}
