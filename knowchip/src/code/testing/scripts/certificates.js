import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const certificateDirectory = fileURLToPath(new URL('../.certs/', import.meta.url));
export function ensureCertificates() {
  const key = resolve(certificateDirectory, 'localhost-key.pem');
  const cert = resolve(certificateDirectory, 'localhost.pem');
  if (existsSync(key) && existsSync(cert)) return { key, cert };
  mkdirSync(certificateDirectory, { recursive: true, mode: 0o700 });
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256',
      '-keyout', key, '-out', cert, '-days', '30',
      '-subj', '/CN=KnowChip Local Cookie Lab',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-addext', 'extendedKeyUsage=serverAuth',
    ], { stdio: 'pipe' });
  } catch (error) {
    throw new Error('Could not generate the local certificate. Install OpenSSL, or supply .certs/localhost.pem and .certs/localhost-key.pem with SANs localhost and 127.0.0.1.', { cause: error });
  }
  return { key, cert };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureCertificates();
  console.log('Created/found local-only certificate in .certs/. It is not a trusted public certificate.');
}
