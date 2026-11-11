import type { PremiumFeature } from "@aido/api/vocabulary";

import type { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { AiClientAppVersionReaderPort } from "#api/modules/ai-assistance/generation/application/ports/client-app-version.reader.port";
import { TodoStatsReaderPort } from "#api/modules/ai-assistance/reports/application/ports/todo-stats.reader.port";
import type {
  AggregateParams,
  AggregationInputs,
} from "#api/modules/ai-assistance/reports/domain/ai-report.constants";
import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type {
  WeatherForecastReaderPort,
  GridInput,
  WeatherForecast,
} from "#api/modules/weather/forecasts/weather-forecasts.public";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 콜백 조립 Stub. 실제 PostgreSQL rollback/lock 보장은 Integration에서 검증한다. */
export class StubAiGenerationUnitOfWork implements UnitOfWorkPort {
  depth = 0;
  runs = 0;
  async run<T>(work: () => Promise<T>): Promise<T> {
    this.runs += 1;
    this.depth += 1;
    try {
      return await work();
    } finally {
      this.depth -= 1;
    }
  }
}

export class StubAiGenerationAccess
  implements Pick<EntitlementReaderPort, "canInTx">, UserMutationLockPort
{
  role = "USER";
  subscriptionStatus = "ACTIVE";
  status = "ACTIVE";
  deletedAt: Date | null = null;
  exists = true;
  readonly reads: Array<{ inUnitOfWork: boolean; eligible: boolean }> = [];
  readonly locks: boolean[] = [];
  readonly unitOfWork: StubAiGenerationUnitOfWork;

  constructor(unitOfWork: StubAiGenerationUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  async canInTx(_userId: UserId, _feature: PremiumFeature): Promise<boolean> {
    const eligible =
      this.exists &&
      this.status === "ACTIVE" &&
      this.deletedAt === null &&
      (this.role === "ADMIN" || this.subscriptionStatus === "ACTIVE");
    this.reads.push({ inUnitOfWork: this.unitOfWork.depth > 0, eligible });
    return eligible;
  }
  async lockById(_userId: UserId): Promise<boolean> {
    this.locks.push(this.unitOfWork.depth > 0);
    return this.exists;
  }
}

export class StubAiTodoStatsReader extends TodoStatsReaderPort {
  readonly calls: AggregateParams[] = [];
  inputs: AggregationInputs = {
    dailyTotalGroups: [],
    dailyCompletedGroups: [],
    prevTotalCount: 0,
    prevCompletedCount: 0,
    catTotalGroups: [],
    catCompletedGroups: [],
    categories: [],
    completedTodos: [],
  };
  async fetchAggregationInputs(params: AggregateParams) {
    this.calls.push(structuredClone(params));
    return structuredClone(this.inputs);
  }
}

export class StubAiWeatherForecastReader implements WeatherForecastReaderPort {
  forecasts = new Map<string, WeatherForecast>();
  failure: Error | null = null;
  calls = 0;
  async getForecastsByGridBatch(_grids: GridInput[], _date: Date) {
    this.calls += 1;
    if (this.failure) {
      throw this.failure;
    }
    return this.forecasts;
  }
}

/** 예약 작업이 읽는 사용자의 앱 버전. 기본은 버전을 알 수 없는 사용자(오래된 앱과 같게 처리)다 */
export class StubAiClientAppVersion extends AiClientAppVersionReaderPort {
  latestAppVersion: string | null = null;

  async findLatestAppVersion(): Promise<string | null> {
    return this.latestAppVersion;
  }
}

export { StubAiDataSharingConsentReader as StubAiDataSharingConsent } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
