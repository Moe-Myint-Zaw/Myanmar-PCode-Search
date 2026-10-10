import type { Coordinates, PlaceRecord } from '@/types/pcode';

export type MapPinKind = 'place' | 'current-location';

export type MapSurfaceProps = {
  center: Coordinates;
  marker?: Coordinates | null;
  currentLocation?: Coordinates | null;
  selectedPlace?: PlaceRecord | null;
  isPlaceLoading?: boolean;
  placeError?: string | null;
  onCoordinatePress?: (coordinates: Coordinates) => void;
  onPinPress?: (coordinates: Coordinates, kind: MapPinKind) => void;
  onPlacePress?: (place: PlaceRecord) => void;
  onDismissPlace?: () => void;
  onCoverageChange?: (bounds: [number, number, number, number]) => void;
};

export function MapSurface(_props: MapSurfaceProps) {
  return null;
}