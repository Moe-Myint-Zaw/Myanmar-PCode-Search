export function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}