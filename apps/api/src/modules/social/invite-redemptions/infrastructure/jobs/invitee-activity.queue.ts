import { todoChangedPayloadSchema } from "#api/modules/planning/todos/planning-todos.public";
import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

// 할 일 완료와 같은 트랜잭션에 남아 커밋 직후 프로세스가 내려가도 사용 시작 기록을 잃지 않는다.
// 초대한 사람의 첫날 소식이 몇십 초 늦어도 체감되지 않아 배경 주기로 처리한다
export const INVITEE_ACTIVITY_QUEUE = defineQueue({
  name: "social.invitee-activity.v1",
  payloadSchema: todoChangedPayloadSchema,
  retry: {
    retryLimit: 5,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
    retentionSeconds: 7 * 24 * 60 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
  },
  worker: { localConcurrency: 2, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
});
