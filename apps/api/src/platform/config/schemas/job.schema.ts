import { z } from "zod";

export const jobSchema = z.object({
  JOB_SCHEMA: z.string().min(1).default("pgboss"),
  JOB_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  // false면 이 프로세스는 작업을 넣기만 하고 worker·정기 작업·큐 유지보수를 돌리지 않는다
  JOB_WORKER_ENABLED: z.stringbool().default(true),
  // 앱 풀(DATABASE_POOL_MAX)과 따로 잡는 연결이다. 프로세스 수 × (앱 풀 + 이 값)이 RDS 한도 안이어야 한다
  JOB_POOL_MAX: z.coerce.number().int().min(1).max(10).default(3),
});

export type JobConfig = z.infer<typeof jobSchema>;
