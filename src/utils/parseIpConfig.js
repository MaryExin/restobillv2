// Parses the "KEY: value" line format used by public/ip.txt, e.g.:
//   LOCAL: http://localhost
//   WEB: https://jeremiahd254.sg-host.com
export function parseIpConfigText(text) {
  const map = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const idx = line.indexOf(": ");
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toUpperCase();
      const val = line.slice(idx + 2).trim();
      if (key && val) map[key] = val;
    }
  }
  return map;
}
