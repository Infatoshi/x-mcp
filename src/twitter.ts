export function parseTweetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/[^/\s]+\/status\/(\d+)/);
  if (match) return match[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  throw new Error(`Invalid tweet ID or URL: ${input}`);
}
