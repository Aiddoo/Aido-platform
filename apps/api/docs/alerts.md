# 경보 카탈로그

운영 경보를 받았을 때 처음 볼 것을 찾거나, 경보를 더하고 바꿀 때 읽는다. 원본은 slice의 `*.alerts.ts`(`defineAlerts`)이고, 이 표는 단위 테스트(`alert-catalog.spec.ts`)가 카탈로그와 한 글자씩 맞춰 본다. 흐름별 조건·임계값과 Sentry 규칙은 [관측](observability.md#중요-흐름과-경보)에 있다.

## 더하는 법

1. 그 slice의 `application/<slice>.alerts.ts`에 `defineAlerts("<context>", { … })` 항목을 더한다. key는 `<context>.<subject>.<outcome>`, summary는 한 줄 상황, runbook은 처음 볼 것·할 것이다.
2. 호출부는 정의를 펼쳐 올린다: `alert.raise({ ...TodoAlerts.TIMEZONE_REBASE_FAILED, details })`. key·심각도·문구를 호출부에서 쓰지 않는다.
3. 조건의 임계값은 재는 코드 옆에 `*_THRESHOLD`·`*_WINDOW_MS` 상수로 둔다.
4. 아래 표에 같은 행을 더한다(테스트가 어긋나면 실패한다).

- tags에는 고정 기호만, details에는 id·숫자만 넣는다. 사용자 원문·토큰·공급자 message는 넣지 않는다.
- 같은 key는 Sentry에서 한 이슈다(fingerprint = key). 큐·스케줄처럼 원인을 나눠야 하면 고정 기호 `subject`를 더해 `<key>:<subject>`가 이슈 단위가 된다(사용자 값 금지).
- 반복 억제는 경보 포트를 감싸는 `DeduplicatingOperationalAlertAdapter`가 이슈 단위로 맡는다(한 시간에 한 번, 다시 보내기는 시간당 2건).

## 표

<!-- alert-catalog:start -->

| key                                              | 심각도  | 언제                                                                   | 첫 대응                                                                                                                                                                      |
| ------------------------------------------------ | ------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access.quota.stale-reservation`                 | error   | 돌려주지 못한 횟수 예약이 남아 사용자 한도가 월말까지 깎인다           | details의 failedCount·staleCount와 같은 시각 DB 경보를 본다. 다음 정리 주기에도 남으면 그 예약을 직접 환불한다.                                                              |
| `ai.provider.all-circuits-open`                  | error   | 모든 AI 업체 회로가 열려 AI 기능이 실패한다                            | /health의 outbound 상태와 업체 상태 페이지를 본다. 결제·인증 경보가 함께 왔으면 그것부터 풀고, 일시 장애면 쿨다운 뒤 회복을 확인한다.                                        |
| `ai.provider.auth-circuit-opened`                | error   | AI 업체 인증 실패가 이어져 그 업체를 건너뛴다                          | 태그 policy 업체의 API 키가 만료·폐기됐는지 보고 security.md 절차로 키를 바꿔 재배포한다.                                                                                    |
| `ai.provider.billing-circuit-opened`             | error   | AI 업체 결제 실패로 그 업체를 건너뛴다                                 | 태그 policy 업체 콘솔에서 크레딧·결제 수단을 확인한다. 충전하면 쿨다운 뒤 자동으로 다시 쓴다.                                                                                |
| `ai.provider.health-circuit-opened`              | warning | AI 업체 시간 초과·5xx·과부하가 이어져 그 업체를 잠시 건너뛴다          | 태그 policy 업체 상태 페이지와 태그 reason(TIMEOUT·UPSTREAM·OVERLOADED)을 본다. 쿨다운 뒤 시험 호출로 저절로 다시 쓴다. 다른 업체까지 열리면 all-circuits-open이 따로 온다.  |
| `ai.provider.none-available`                     | error   | 키·모델이 설정된 AI 업체가 하나도 없어 AI 기능이 실패한다              | 태그 task의 업체 API 키·모델 설정과 AI_PROVIDER_ORDER를 확인하고 키를 넣어 재배포한다. 동의 범위 때문에 업체가 없는 사용자는 이 경보 없이 AI_1301로 끝난다.                  |
| `ai.spend.background-halted`                     | error   | AI 비용이 배경 중단 기준에 닿아 배경 AI 작업을 멈췄다                  | 사용자 요청 AI는 계속 돈다. 원인을 본 뒤 더 쓸 거면 AI_BUDGET_DAILY_BACKGROUND_USD·AI_BUDGET_MONTHLY_BACKGROUND_USD를 올려 재배포한다. 다음 기간에 저절로 풀린다.            |
| `ai.spend.halted`                                | error   | AI 비용이 전체 중단 기준에 닿아 모든 AI 생성을 멈췄다                  | 앱의 AI 기능이 모두 실패한다. 업체 청구와 원인을 확인하고 더 쓸 거면 AI_BUDGET_DAILY_USD·AI_BUDGET_MONTHLY_USD를 올려 재배포한다.                                            |
| `ai.spend.model-pricing-unknown`                 | error   | 가격표에 없는 AI 모델이 설정돼 비용을 최고 단가로 잡는다               | details.providers의 모델 설정을 확인하고 ai-model-pricing.constants.ts에 단가를 더하거나 모델 설정을 되돌린다.                                                               |
| `ai.spend.threshold-reached`                     | warning | AI 추정 비용이 일·월 경고 기준선에 닿았다                              | 태그 window와 details 금액을 업체 청구와 비교한다. 특정 사용자·작업이 몰렸는지 ai 로그로 본다.                                                                               |
| `billing.subscription.reconcile.failed`          | error   | 구독 스토어 상태 대조가 재시도 뒤에도 실패했다                         | 결제 공급자 API 키 권한·만료와 공급자 상태 페이지를 확인한다. 실패한 사용자는 다음 대조 주기에 다시 돈다.                                                                    |
| `billing.subscription.webhook.invalid`           | warning | 계약과 다른 결제 공급자 웹훅 원문을 받아 처리하지 않았다               | 태그 eventType과 issueCount로 공급자 웹훅 형식 변경인지 보고 공급자 어댑터의 웹훅 Zod 스키마를 고친다.                                                                       |
| `billing.subscription.webhook.processing-failed` | error   | 결제 공급자 웹훅을 영구 실패로 닫아 구독 상태가 반영되지 않았다        | 태그 storeEnvironment가 SANDBOX면 넘긴다. details.eventId로 결제 공급자 대시보드의 고객 이력과 사용자 권한을 맞춰 보고, 고친 뒤 이벤트를 다시 보내거나 대조 작업을 기다린다. |
| `database.unique-constraint.unknown`             | warning | 저장소가 번역하지 않은 unique 충돌을 409 SYS_0004로 돌려줬다           | 태그 constraint를 가진 저장소에 isUniqueConstraintViolation 번역을 더해 업무 오류로 바꾼다.                                                                                  |
| `identity.account-purge.failed`                  | error   | 탈퇴 계정 영구 삭제가 일부 실패해 보관 기한을 넘길 수 있다             | identity.account-purge.user.failed 로그의 userId·errorType으로 원인(FK·잠금)을 고친다. 다음 날 03시 배치가 다시 지우는지 확인하고, 이틀 넘게 남으면 직접 삭제한다.           |
| `identity.session.refresh-token-reused`          | warning | 이미 바꾼 refresh token이 다시 쓰여 그 로그인 묶음을 모두 끊었다       | 한두 건은 앱의 늦은 재시도일 수 있다. 같은 사용자가 되풀이하거나 여러 사용자가 한꺼번에 오면 토큰 유출을 의심하고 SecurityLog의 SUSPICIOUS_ACTIVITY를 본다.                  |
| `job.failed`                                     | error   | 작업이 재시도를 모두 쓰고 실패해 DLQ로 옮겨졌다                        | 태그 queue·error.type과 jobs.job.failed 로그로 원인을 고친다. DLQ에 남은 작업은 고친 뒤 다시 넣고, 같은 오류가 이어지면 큐를 멈출지 정한다.                                  |
| `notification.email.budget-exhausted`            | warning | 이메일 발송 예산을 다 써서 메일을 보내지 못했다                        | 인증 메일이 막혀 가입이 멈춘다. 원인을 본 뒤 요금제와 EMAIL_SEND_BUDGET 상수를 함께 올린다.                                                                                  |
| `notification.email.circuit-open`                | error   | 이메일 공급자 호출이 연속 실패해 발송을 잠시 멈췄다                    | Resend 상태 페이지와 API 키를 확인한다. 회로는 1분 뒤 다시 시험하고 큐의 메일은 pg-boss 재시도로 이어진다.                                                                   |
| `notification.email.daily-budget-near`           | warning | 오늘 이메일 발송 수가 무료 한도 경고 기준에 닿았다                     | 가입 급증인지 남용인지 notification.email 로그로 보고, 계속 늘면 요금제를 검토한다.                                                                                          |
| `notification.email.delivery-rejected`           | error   | 이메일 공급자가 다시 보내도 소용없다고 거절해 메일을 버렸다            | 태그 reason을 보고 Resend API 키와 발신 도메인 DNS 인증을 확인한다.                                                                                                          |
| `notification.email.delivery-retry-exhausted`    | error   | 이메일을 재시도 끝에도 보내지 못했다                                   | 같은 시각 이메일 회로 경보와 Resend 장애를 먼저 본다. 사용자는 다시 요청해야 한다.                                                                                           |
| `notification.email.delivery-unseal-failed`      | error   | 발송 큐의 이메일을 풀지 못해 버렸다                                    | 최근 암호화 키 교체나 롤백이 있었는지 본다. 버린 인증·문의 메일은 사용자가 다시 요청해야 한다.                                                                               |
| `notification.email.monthly-budget-near`         | warning | 이번 달 이메일 발송 수가 무료 한도 경고 기준에 닿았다                  | 남은 일수로 한도를 넘을지 가늠하고, 넘을 것 같으면 요금제 상향을 준비한다.                                                                                                   |
| `notification.email.provider-quota-exhausted`    | error   | 이메일 공급자가 발송 한도를 넘었다고 거절했다                          | Resend 대시보드 사용량을 확인한다. 한도가 풀릴 때까지 메일이 막히므로 요금제를 검토한다.                                                                                     |
| `notification.push.receipt-failure-ratio-high`   | error   | 푸시 receipt의 공급자 쪽 실패 비율이 기준을 넘었다                     | 태그 topFailureKind가 PROVIDER_REJECTED면 Expo 프로젝트의 FCM·APNs 자격 증명을, RATE_LIMITED면 발송량을, PROVIDER_UNAVAILABLE면 Expo 상태 페이지를 본다.                     |
| `notification.reminder.late-skips-high`          | warning | 늦어서 버린 할 일 리마인더가 한 시간 기준 수를 넘었다                  | 배포·worker 정지나 todo-reminder 큐 적체를 /health jobs로 본다. 버린 리마인더는 다시 보내지 않는다.                                                                          |
| `notification.reminder.sweep-catch-up-capped`    | error   | 시간대 리마인더 sweep이 따라잡기 상한을 넘겨 놓친 분을 버렸다          | worker가 15분 넘게 멈췄다. 배포·컨테이너 재시작·DB 장애 시각을 확인한다. details.skippedMinutes 동안의 정시 알림은 보내지 않았다.                                            |
| `operations.admin-notification.rejected`         | warning | 관리자 알림 채널이 재시도해도 소용없다고 거절했다                      | 태그 channel의 Discord webhook이 지워지거나 바뀌었는지 보고 env의 URL을 고친다.                                                                                              |
| `operations.broadcast.delivery-exhausted`        | error   | 수신자 현지 시각 브로드캐스트 발송이 재시도를 다 써 일부가 받지 못했다 | 태그 campaignId의 발송 결과와 같은 시각 푸시 경보를 본다. 필요하면 남은 대상에게 다시 보낸다.                                                                                |
| `planning.todo-series.materialize-failed`        | error   | 반복 할 일 회차 채우기가 실패했거나 제한 시간 안에 끝나지 않았다       | details의 failedCount·timedOut과 planning.todo-series 로그를 본다. 다음 주기나 앱 열기 따라잡기가 채우는지 확인한다.                                                         |
| `planning.todo-timezone-rebase-failed`           | error   | 할 일 시간대 재계산이 재시도 뒤에도 실패해 알림이 옛 시간대로 울린다   | details.userId와 errorType으로 원인을 고친 뒤 그 사용자의 재계산 작업을 다시 넣는다.                                                                                         |
| `queue.dead-letter`                              | warning | DLQ에 작업이 들어왔다                                                  | 태그 queue의 원래 큐에서 같은 시각 job.failed 경보를 본다. 원인을 고친 뒤 DLQ 작업을 다시 넣거나 지운다.                                                                     |
| `runtime.event-loop.delay-high`                  | warning | 이벤트 루프 지연 p99가 기준을 넘었다                                   | 같은 시각 배치·대량 발송과 CPU를 본다. 되풀이되면 그 작업을 나누거나 동시성을 줄인다.                                                                                        |
| `runtime.heap.usage-high`                        | warning | 힙 사용률이 기준을 넘었다                                              | /health runtime의 heap·rss 추세를 본다. 계속 오르면 누수를 의심해 최근 배포를 되돌리고 컨테이너를 재시작한다.                                                                |
| `runtime.pool.waiting-sustained`                 | warning | DB 커넥션 풀 대기가 기준 시간 넘게 이어진다                            | /health runtime.pool과 RDS 연결 수·CPU를 본다. pg_stat_statements로 느린 쿼리와 긴 트랜잭션을 찾는다.                                                                        |
| `schedule.failing`                               | error   | 최근 예정 실행이 모두 실패했다                                         | 같은 큐의 job.failed 경보와 로그에서 오류 종류를 찾아 고친다. 고친 뒤 다음 예정 실행이 끝나는지 확인한다.                                                                    |
| `schedule.overdue`                               | error   | 예정 실행 두 번이 지나도록 끝난 실행이 없다                            | 태그 schedule.key의 큐가 pg-boss에 스케줄로 남아 있는지, worker가 살아 있는지(/health jobs, Sentry cron 모니터)를 본다. 배포 직후면 다음 실행을 기다린다.                    |
| `social.invite-reward.retry-exhausted`           | error   | 초대 보상 지급이 자동 재시도를 다 썼다                                 | details.grantId의 지급 상태와 태그 errorCode를 보고, 원인을 고친 뒤 지급을 다시 적용한다.                                                                                    |
| `voice.note-digest.duration-over-limit`          | warning | 앱이 보낸 녹음 길이가 등급별 한 번 상한을 넘었다(앱 타이머 우회 의심)  | 1.15.1은 거절하지 않는다. 같은 사용자·앱 버전이 되풀이되는지 보고 1.15.2 거절 전환 근거로 남긴다.                                                                            |
| `weather.weatherkit.monthly-calls`               | warning | WeatherKit 이번 달 호출 수가 무료 한도 경고 기준선에 닿았다            | details.total과 남은 일수로 무료 한도를 넘을지 가늠한다. 넘을 것 같으면 예보 캐시 TTL을 늘린다.                                                                              |

<!-- alert-catalog:end -->
