import { round } from 'es-toolkit';

const METERS_PER_KILOMETER = 1000;
/** 10km 미만은 소수 한 자리까지 보여 줘야 1.2km 같은 짙은 안개가 0km로 뭉개지지 않는다. */
const VISIBILITY_DECIMAL_BELOW_KM = 10;

export function toVisibilityKilometers(meters: number): number {
  const kilometers = meters / METERS_PER_KILOMETER;
  return kilometers < VISIBILITY_DECIMAL_BELOW_KM ? round(kilometers, 1) : Math.round(kilometers);
}
