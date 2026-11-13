export type TestWorkers = number | `${number}%`;

export function resolveTestWorkers(
  env: Readonly<Record<string, string | undefined>>,
  fallback: TestWorkers,
): TestWorkers;
