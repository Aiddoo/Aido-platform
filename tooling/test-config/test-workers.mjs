const POSITIVE_INTEGER = /^[1-9]\d*$/;
const PERCENTAGE = /^([1-9]\d?|100)%$/;

export function resolveTestWorkers(env, fallback) {
  const configured = env.AIDO_TEST_WORKERS;
  if (configured == null || configured === '') {
    return fallback;
  }
  if (POSITIVE_INTEGER.test(configured)) {
    return Number(configured);
  }
  if (PERCENTAGE.test(configured)) {
    return configured;
  }
  throw new Error(
    `AIDO_TEST_WORKERS must be a positive integer or a percentage from 1% to 100%, received "${configured}"`,
  );
}
