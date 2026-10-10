import type { CoordinateSource } from '@/types/pcode';

const descriptions: Record<CoordinateSource, { title: string; detail: string }> = {
  mimu: { title: 'MIMU coordinate', detail: 'Official surveyed MIMU coordinate.' },
  boundary: { title: 'Boundary centroid', detail: 'Derived from an administrative boundary; not a surveyed point.' },
  villages: { title: 'Village-derived estimate', detail: 'Approximation based on village locations.' },
  town: { title: 'Parent town fallback', detail: 'Uses the parent town coordinate as an approximate location.' },
};

export function getCoordinateSourceDescription(source: CoordinateSource | null) {
  return source ? descriptions[source] : null;
}