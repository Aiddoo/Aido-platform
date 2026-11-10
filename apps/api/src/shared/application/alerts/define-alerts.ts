import { mapValues } from "es-toolkit";

export const ALERT_SEVERITIES = ["warning", "error"] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/**
 * 사람이 확인해야 하는 운영 상황 하나의 정의. key는 Sentry fingerprint라 한 이슈로 모이고,
 * summary는 이슈 제목, runbook은 경보를 받고 처음 볼 것·할 것이다.
 */
export interface AlertDefinition {
  readonly key: string;
  /** key의 첫 마디. Sentry `alert_context` 태그로 Context별로 거른다 */
  readonly context: string;
  readonly severity: AlertSeverity;
  readonly summary: string;
  readonly runbook: string;
}

interface AlertEntry<TContext extends string> {
  readonly key: `${TContext}.${string}`;
  readonly severity: AlertSeverity;
  readonly summary: string;
  readonly runbook: string;
}

/**
 * slice의 `*.alerts.ts`가 경보 정의를 한 형태로 선언한다. key는 `<context>.`로 시작해야 하고,
 * 호출부는 정의를 펼쳐 `alert.raise({ ...TodoAlerts.X, tags })`로 올린다.
 */
export function defineAlerts<
  const TContext extends string,
  const TEntries extends Readonly<Record<string, AlertEntry<TContext>>>,
>(context: TContext, entries: TEntries): Readonly<Record<keyof TEntries, AlertDefinition>> {
  return Object.freeze(
    mapValues(entries, (entry): AlertDefinition => Object.freeze({ ...entry, context })),
  );
}

/** 카탈로그 검사가 `*.alerts.ts`의 export에서 정의만 고른다. */
export function isAlertDefinition(value: unknown): value is AlertDefinition {
  return (
    typeof value === "object" &&
    value != null &&
    "key" in value &&
    typeof value.key === "string" &&
    "context" in value &&
    typeof value.context === "string" &&
    "severity" in value &&
    ALERT_SEVERITIES.some((severity) => severity === value.severity) &&
    "summary" in value &&
    typeof value.summary === "string" &&
    "runbook" in value &&
    typeof value.runbook === "string"
  );
}
