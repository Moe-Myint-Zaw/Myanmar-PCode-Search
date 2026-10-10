export function compareDatasetVersions(first: string, second: string): number {
  const firstParts = first.split('.').map(Number);
  const secondParts = second.split('.').map(Number);
  if (
    firstParts.length === 0 ||
    secondParts.length === 0 ||
    firstParts.some((part) => !Number.isInteger(part) || part < 0) ||
    secondParts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    throw new TypeError('Dataset versions must contain numeric dot-separated segments.');
  }

  const segmentCount = Math.max(firstParts.length, secondParts.length);
  for (let index = 0; index < segmentCount; index += 1) {
    const firstPart = firstParts[index] ?? 0;
    const secondPart = secondParts[index] ?? 0;
    if (firstPart !== secondPart) return firstPart > secondPart ? 1 : -1;
  }
  return 0;
}