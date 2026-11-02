/**
 * Minimal .env loader so `tsx watch src/main.ts` matches Nest CLI behavior
 * without pulling in dotenv.
 */
import fs from 'node:fs';
import path from 'node:path';

export function dotenv(): void {
  const candidates = ['.env', '../../.env'];
  for (const rel of candidates) {
    const file = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (key.length > 0 && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
