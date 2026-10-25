import type { ReservedRegion } from 'react-native-reserved-regions';

/** 화면을 좌우로 나누는 접힘선(세로 division). 반쯤 접은 iPhone Duo·Android 폴더블에서만 있다. */
export function findVerticalFold(reservedRegions: readonly ReservedRegion[]) {
  return reservedRegions.find(
    (region) => region.kind === 'division' && region.frame.height > region.frame.width,
  );
}
