import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repositoryFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
  encoding: 'utf8',
  },
).split('\0').filter(Boolean);

const binaryExtensions = new Set([
  '.gif', '.ico', '.jpeg', '.jpg', '.pdf', '.png', '.woff', '.woff2', '.zip',
]);

const contentPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['JWT-like token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/],
  ['Google service-account JSON', /"type"\s*:\s*"service_account"/],
];

const protectedEnvNames = new Set([
  'GEMINI_API_KEY',
  'GCP_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'LTA_DATAMALL_ACCOUNT_KEY',
  'ONEMAP_PASSWORD',
  'ONEMAP_API_TOKEN',
]);

const findings = [];

for (const file of repositoryFiles) {
  if (file === 'scripts/check-secrets.mjs') continue;
  const suffix = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (binaryExtensions.has(suffix)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const [label, pattern] of contentPatterns) {
    if (pattern.test(content)) findings.push(`${file}: contains ${label}`);
  }

  if (file.split('/').at(-1)?.startsWith('.env')) {
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!match || !protectedEnvNames.has(match[1])) continue;
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      const isPlaceholder = value === '' || /^<[^>]+>$/.test(value) || /^(MY_|CHANGE_ME)/.test(value);
      if (!isPlaceholder) findings.push(`${file}:${index + 1}: ${match[1]} must be empty`);
    }
  }
}

if (findings.length > 0) {
  console.error('Potential committed secrets detected:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret check passed for ${repositoryFiles.length} repository files.`);
