export function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Invalid client version');
  const parts = value.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part) || part > 65535)) throw new Error('Invalid client version');
  return parts;
}
export function compareVersions(a, b) {
  const left = versionParts(a), right = versionParts(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
export function releaseFor(manifest, target) {
  if (manifest?.schema !== 1 || !['win32-x64', 'darwin-x64', 'darwin-arm64'].includes(target)) throw new Error('Unsupported release manifest');
  const release = manifest.releases?.[target];
  versionParts(release?.version);
  if (!release.url && !release.sha256) return { version: release.version, url: null, sha256: null };
  const url = new URL(release.url);
  if (url.protocol !== 'https:' || url.username || url.password || !/^[a-f0-9]{64}$/i.test(release.sha256 || '')) throw new Error('Invalid installer URL or SHA-256');
  return { version: release.version, url: url.href, sha256: release.sha256.toLowerCase() };
}
