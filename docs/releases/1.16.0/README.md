# 1.16.0: AI 제안·AI 리포트 리디자인

**상태: 작성 중(2026-11-16).** 코드는 `[1/18]`~`[18/18]`이 스택에 있다. CI, 머지, 서버 운영 배포, 스토어 제출, 기기 QA는 아직이다. 남은 예정은 마이너·패치 의존성 정리(Dependabot 5일 냉각 뒤 2026-11-21~: AI SDK, `@nestjs/throttler` 6.8.0, i18next 27.1.3, react-i18next 18.0.2, pnpm 12.21.0)다. 측정하지 않은 값은 적지 않는다.

| 내용        | 문서                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 호환 규칙   | [호환](../../conventions/compatibility.md)                                                                                 |
| 배포·롤백   | [서버 배포와 롤백](../../../apps/api/docs/deployment.md), [앱 빌드와 출시](../../../apps/mobile/docs/build-and-release.md) |
| 스토어 문구 | [release.json](../../../apps/mobile/store-metadata/1.16.0/release.json)                                                    |
| 측정        | [분석 측정 계획](../../../apps/mobile/docs/analytics-measurement-plan.md)                                                  |
| AI 검증     | [AI 문서 검증 기록](../../../apps/api/docs/ai.md#검증-기록)                                                                |
| 사용자 상황 | [1.16.0 사용자 상황 확인표](qa-matrix.md)                                                                                  |
| 이전 버전   | [1.15.2](../1.15.2/README.md)                                                                                              |

## 요약

- **AI 제안**: 빈 화면 대신 서버가 정한 분석 상태 8가지(`HAS_SUGGESTIONS`·`NEEDS_AI_CONSENT`·`NEEDS_MORE_TODOS`·`ANALYZING`·`DONE_FOR_TODAY`·`NO_PATTERN_FOUND`·`UNAVAILABLE_TODAY`·`WAITING_FOR_NEXT_RUN`)를 같은 틀의 영수증 모양 상태 카드로 보인다. 제안 줄은 만들어질 반복 할 일과 같은 모양(시각 · ⟲ 반복 규칙, `TodoRow.TitleLine`·`ScheduleLine`)에 최근 2주 기록 근거 한 줄을 더하고 버튼은 [반복으로 만들기]·[필요 없어요]다. [할 일 적으러 가기]는 오늘 피드로 가서 할 일 추가 시트를 연다. 분석 중에는 3초마다 다시 읽는다. 서버가 분석 실행을 기록하고 목록에 `analysis`를 담으며(`[15/18]`), [지금 분석 받기]는 `POST /v1/ai/suggestions/analyses`와 전용 worker로 받는다(`[16/18]`).
- **AI 제안 프롬프트**: 모델은 후보를 고르기만 한다(`suggestion@4`). 출시 앱이 읽는 `reason`은 서버가 기록 수치로 쓴다. 서버는 띄어쓰기·문장부호·이모지·대소문자·전각 차이만 다른 제목을 한 후보로 묶고, 자모·숫자·기호만인 제목과 이미 반복 중인 할 일을 후보에서 뺀다. 근거(`evidence`)를 저장한다(`[14/18]`). 입력 상한은 36,000자, 응답 이력은 30개다(`[17/18]`).
- **AI 리포트**: 헤드라인(완료율·변화 칩), 날마다 끝낸 할 일 막대, 주로 끝낸 시간 24칸, 최근 8주 추세선, AI 코치 카드로 바뀐다. 프롬프트는 `report@4`로 숫자를 항목 단위로 검사하고 글 길이는 ko 70·55자, en 120·90자다. 템플릿으로 채운 글은 "AI 코치" 대신 "이번 기간 요약"으로 보인다.
- **무료**: 이번 주 내 기록 막대를 실제로 그리고 AI 부분만 잠근다. 샘플 리포트를 지운다. 첫 리포트 전 프리미엄도 같은 기록을 보이고 리포트 끝에 제안 미리보기를 둔다(`[10/18]`).
- **푸시**: 제안 분석 창을 현지 09시대로 옮겼다. `AI_SUGGESTION`은 광고성(마케팅) 집합에서 빠진 **서비스 알림**이라 "(광고)" 표기와 광고성 동의 조건이 없고, 야간 제한(21~08시)에 막히지 않는다. 문구는 "자주 하는 할 일을 찾았어요 ✨"(en "We found to-dos you do often ✨")다. [지금 분석 받기]로 만든 제안은 푸시를 보내지 않는다.
- **버그 수정**: 리포트 도착 시각 표시 08:00 ↔ 푸시 11:30 불일치, 지운 카테고리 이름('기타'가 en에도 하드코딩), en 시작 제안 문구, AI Swagger 설명(`[1/18]`).
- **용어**: "루틴" 대신 "반복 할 일"(en "repeating to-do")이다. 스토어 검색어에만 "루틴"이 남는다.
- **라이브러리**: 카카오 SDK 2.4.11 → 3.2.0(`[11/18]`), `react-native-purchases` 10.16.0 → 11.0.2(`[12/18]`).
- **버전**: 앱 1.16.0. 빌드 번호(EAS remote)와 서버·`@aido/api` 버전은 그대로다.

## 사용자에게 보이는 수정

- AI 제안 화면이 비어 있는 이유와 다음 분석 시각을 알려 준다. 신뢰도 숫자 대신 근거(최근 2주 기록 중 몇 번)를 보인다.
- [지금 분석 받기]로 분석을 바로 받는다. 같은 날 다시 눌러도 job은 하나이고 하루 한 번 LLM 호출 상한은 그대로다.
- AI 리포트 상세는 한눈에 무엇이 나아졌는지 보이게 헤드라인 → 완료·모두 끝낸 날·이 기간 연속 → 일별 막대 → 시간대 차트 → 카테고리 → AI 코치 카드 순이다. 옛 리포트는 일별 막대만 숨긴다.
- 리포트 목록은 최근 리포트 카드(완료율·변화 칩·최근 8주 추세선) 아래에 지난 리포트가 나온다. 상태 배너는 다음 리포트 D-day와 요일·시각 한 줄이다.
- 무료 리포트는 이번 ISO 주 일별 완료를 보이고 오지 않은 날은 "아직"으로 구분한다. 잠금 카드와 무료 제안 미리보기가 `premium_gate_shown`·`premium_gate_cta_tapped`를 보낸다(`[10/18]`·`[13/18]`).
- 차트는 Skia로 그리고 스크린리더에 선택한 값을 읽어 준다. 새 차트 라이브러리는 쓰지 않는다(SDK 58의 Skia 2.14).
- 문구를 새 화면에 맞췄다. 쓰지 않는 키(제안 paywall 제목·설명)를 지우고 "맞춤 제안이 도착했어요"를 바꿨다. Maestro `30-ai.yaml`이 새 문구·testID를 기다리고 새 흐름 `report/see-weekly-record-free`가 있다(`[13/18]`).
- 할 일이 많은 사용자(300개·활동 60종)도 제안을 받는다. 입력 상한에 막혀 세 공급자 모두 BAD_REQUEST였던 사례를 고쳤다(`[17/18]`).

## 의도한 화면 차이

- 제안 카드의 신뢰도·사유·만료 표시를 앱이 더 읽지 않는다(서버는 계속 준다).
- 템플릿 리포트의 요약 제목이 "이번 기간 요약"으로 바뀐다.
- 리포트 상세의 통계 3칸·요일 점·상위 3시간 목록은 위 차트로 대체된다.
- 무료 사용자는 샘플 리포트 대신 이번 주 내 기록을 본다.

## 서버 변경과 호환

[호환](../../conventions/compatibility.md) 규칙대로 응답 모양은 추가만 한다. 출시 앱(1.15.3 이하)은 새 칸을 버린다.

| 변경                                | 출시 앱                        | 새 앱                          | 서버 롤백                  |
| ----------------------------------- | ------------------------------ | ------------------------------ | -------------------------- |
| 목록 `analysis`(optional)           | 버린다                         | 상태 카드                      | 없음 → 버튼 없는 상태      |
| 제안 `evidence`(nullable)           | 버린다                         | 근거 줄                        | 없음 → 숨김                |
| 리포트 `dailyCompletions`(nullable) | 버린다                         | 일별 막대                      | 없음 → 숨김                |
| 리포트 `aiContentSource`(optional)  | 버린다                         | 템플릿이면 AI 코치 표시를 뺀다 | 없음 → AI로 표시           |
| `report@4`·`suggestion@4`           | 같은 칸에 같은 모양의 글       | 코치 카드·서버 근거 문장       | 옛 버전 글                 |
| `POST /v1/ai/suggestions/analyses`  | 부르지 않는다                  | [지금 분석 받기]               | 404 → 앱 오류 토스트       |
| 제안 푸시 분류                      | 광고성 → 서비스(표기 없음)     | 같음                           | 광고성(야간 제한·"(광고)") |
| 큐 두 번째 worker                   | 큐 이름·job key·payload 그대로 | 같음                           | 두 번째 worker 없음        |
| 제안 분석 창 07시대 → 09시대        | 같음                           | 같음                           | 07시대                     |
| 리포트 도착 표시 08:00 → 11:30      | 실제 도착과 맞음               | 같음                           | 08:00                      |

- 앱은 옛 서버 분기를 두지 않고 optional 계약의 nullish만 정리한다. 서버 배포 → 안정화 → 앱 제출 순서다.
- 큐 이름·job key·payload는 그대로다. 같은 큐에 두 번째 worker(`AI_SUGGESTION_ON_DEMAND_WORKER`: 1칸·2초·`minPriority` 10)가 붙고 우선순위는 `SCHEDULED` 0, `ON_DEMAND` 10이다. worker 동시성 합은 41에서 42가 된다. payload의 `weatherGrid`는 배포 겹침 때문에 남겼고 다음 버전에서 지운다. payload `localDate`·`trigger`는 optional이라 옛 job은 `SCHEDULED`·실행 시각 현지 날짜로 읽는다.
- `POST /v1/ai/suggestions/analyses`는 202다. 가드는 `AiDataSharingConsentGuard` → 사용자별 throttle(1분 5회)이고 오류는 `AI_1309`·`AI_1311`·429 `SYS_0001`이다. `AI_SUGGESTION_ON_DEMAND_ENABLED`(기본 true)를 끄면 `canRequestNow`가 false다.
- 요청 분석은 `taskClass` interactive라 배경 자리·배경 중단과 분리된다.
- 제안 문맥 reader는 최근 기록과 응답 이력만 읽는다. 쓰지 않게 된 활동 reader 메서드 4개, `LatestReportStatsReaderPort`, 날씨 `WeatherForecastReaderPort`·묶음 조회 UseCase를 지웠다.
- 계약 지문: released fixture(1.7.x·1.8.2)에 옛 schemas 지문을 `preAiSuggestionAnalysis`로 남겼고 paths 지문은 같다. `[16/18]`의 새 경로·DTO도 released 지문은 그대로다.

### 분석 이벤트

값은 각 `constants/*.events.ts`가 원본이다([분석 측정 계획](../../../apps/mobile/docs/analytics-measurement-plan.md)).

| 이벤트                                                                                            | 파라미터                                                          |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ai_suggestions_viewed`(추가)                                                                     | `state`(분석 상태 8가지), `suggestion_count`                      |
| `ai_suggestion_analysis_requested`(추가)                                                          | `source`(`suggestions_screen`·`feed_entry`)                       |
| `ai_suggestion_acted`(변경)                                                                       | `action` 그대로 + `source`(`suggestions_screen`·`report_preview`) |
| `ai_report_chart_tapped`(추가)                                                                    | `chart`(`daily_completions`·`completion_hours`)                   |
| `premium_gate_shown`·`premium_gate_cta_tapped`(무료 리포트 잠금 카드·제안 미리보기에서 추가 발송) | inline 노출, `surface`(`report_list`·`suggestions`)               |

서버 신호(분석 결과·대기 시간·AI 비용·수락률·리포트 생성 시간)는 측정 계획 3절 표에 있다. 분석 실행 로그는 `ai.suggestion-analysis.finished`(`trigger`·`outcome`·`createdSuggestionCount`·`queueWaitMs`·`durationMs`)와 `ai.suggestion-analysis.requested`·`deduplicated`·`disabled`다. 리포트 job 완료 로그에 `durationMs`, 공급자 불가 로그에 `userId`를 더했다(`[9/18]`).

## DB 마이그레이션

둘이다: `20261116120320_suggestion_analysis_run`(추가만)과 `20261116151519_drop_retired_columns`(1.15.2에서 스키마만 뺀 칸 삭제, `[18.1/18]`).

| 내용                                                                                                        | 잠금                                                                 |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `SuggestionAnalysisRun` 테이블 생성(`userId` PK, `User` FK cascade)                                         | 새 테이블                                                            |
| `AiReport.dailyCompletions` jsonb(nullable)                                                                 | `AiReport` AccessExclusive(칸 추가, 메타데이터만)                    |
| `RecurringSuggestion.evidenceRecordedCount`·`evidenceCompletedCount`·`evidencePeriodDays` integer(nullable) | `RecurringSuggestion` AccessExclusive(칸 추가), FK가 `User`를 잠근다 |

- 첫 문장이 `SET LOCAL lock_timeout = '500ms'`라 잠금을 못 잡으면 물러나고 앱 요청이 밀리지 않는다.
- 옛 행은 새 칸이 비어 있고 앱은 숨긴다. 되돌리기는 코드만 되돌리면 되고 칸은 남겨 둔다.
- `drop_retired_columns`: `User.twoFactorEnabled`·`User.twoFactorSecret`·`Subscription.dataRetentionUntil`을 지운다. 운영 읽기 전용 확인(2026-11-16 15:13 UTC, `ssh aido`, `aido_app`, `transaction_read_only` on): 사용자 424 · 2단계 인증 켬 0 · secret 0, 구독 8 · `dataRetentionUntil` 0. 운영 이미지는 `main`(`0276315`, 앱 1.15.3)이라 롤백 바닥 1.15.2 조건을 만족한다. 값이 생겼으면 guard가 `RAISE EXCEPTION`으로 migrate를 멈추고 API는 바뀌지 않는다. 되돌리기(모양만)는 [1.15.2 기록](../1.15.2/README.md#db-마이그레이션)의 `ADD COLUMN` 세 줄이다.

### 쿼리 수와 EXPLAIN

`[14/18]`~`[16/18]` 커밋 본문에 적힌 측정이다.

| 경로                                     | 측정                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 배치 한 묶음(사용자 3명)                 | 잠금 1 + 실행 기록 select 1 + upsert 1 + `enqueueMany` 1. 사람마다 쿼리 없음                                                                                                  |
| GET 상태                                 | 실행 기록 1 + 동의 2 + 저장 시간대 1 → 단건 할 일 `$count` 1(앞 셋은 `Promise.all`)                                                                                           |
| POST(기록 있음)                          | 권한 1 + 저장 시간대 1 + 단건 할 일 `$count` 1 + UoW(잠금 1·실행 기록 select 1·upsert 1·job insert 1) + 상태(대기 제안 1, 실행 기록·동의 2·시간대 → `$count`는 `Promise.all`) |
| 반복 중 제목(사용자 200명 × 반복 20개)   | `TodoSeries_userId_nextOccurrenceDate_idx` Bitmap Index Scan → Sort → Unique, Seq Scan 없음, 실행 0.021ms                                                                     |
| 단건 할 일 `$count`(사용자 200명 × 40개) | `Todo_userId_startDate_endDate_idx` Bitmap Index Scan, Seq Scan 없음, 실행 0.015ms                                                                                            |

## AI 평가

2026-11-16 live eval이다. 원본은 [AI 문서 검증 기록](../../../apps/api/docs/ai.md#검증-기록)이고 `[17/18]` 커밋 본문과 같다. 기본 체인은 claude-haiku-5-5(`anthropic`)이고 대조는 gemini-3.1-flash-lite·gpt-6-luna다. 총 $0.27이고 재평가는 약 $0.16이다.

`suggestion@3`과 `suggestion@4`는 골든 모양이 바뀌어(후보 묶기·반복 중 제외 기대값) 같은 데이터로 비교할 수 없다. `@3` 대 `@4` 비교는 하지 않았고 아래 Before는 같은 `@4`의 1차 평가다.

### 제안(`suggestion@4`, 41건)

Before는 막힌 2건을 뺀 39건, After는 41건 모두의 지표다. 지연은 p50 / p95다.

| 공급자           | Before(1차)                                                                           | After                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 세 공급자 공통   | 할 일 300개 사례(`sg-ko-05`·`sg-en-05`) BAD_REQUEST(user 턴 20,206자 > 상한 16,000자) | 생성 오류 0(상한 36,000자, 이력 30개)                                  |
| Haiku(anthropic) | precision·recall 1.0, 금지·중복 0, 근거 약함 빈 배열 1.0, 1058 / 1619ms, $0.0065      | precision·recall 1.0, 금지·중복 0, 빈 배열 1.0, 1133 / 1612ms, $0.0084 |
| OpenAI           | precision·recall 1.0, 금지·중복 0, 빈 배열 1.0, 2029 / 4787ms, $0.0040                | precision·recall 1.0, 금지·중복 0, 빈 배열 1.0, 2128 / 4213ms, $0.0056 |
| Gemini           | precision·recall 0.983, 금지 0.017, 중복 0, 1770 / 3440ms, $0.048                     | precision 0.986, recall 1.0, 금지·중복 각 0.014, 2085 / 3735ms, $0.058 |

### 리포트(`report@4`, 20건)

After는 마지막 프롬프트로 잰 값이다. 기본 체인의 첫 업체가 Haiku라 기본 체인은 Haiku 두 번으로 대신했다(중간 프롬프트의 기본 체인은 aiWritten 0.85였다).

| 공급자           | Before(1차) aiWritten · numbersKept · 길이 · 지연 | After aiWritten · numbersKept · 길이 · 지연                                  |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Haiku            | 0.55 · 0.6 · 0.85 · 1542 / 1774ms                 | 1회 0.95 · 1.0 · 0.95 · 1446 / 1702ms, 2회 0.95 · 0.95 · 1.0 · 1394 / 1588ms |
| 기본 체인(Haiku) | 0.65 · 0.7 · 0.95 · 1529 / 1692ms                 | 위 Haiku 두 번                                                               |
| Gemini           | 0.7 · 0.7 · 0.95 · 2982 / 5135ms                  | 모든 지표 1.0 · 1978 / 4001ms                                                |
| OpenAI           | 0.95 · 1.0 · 0.95 · 2474 / 4856ms                 | 모든 지표 1.0 · 2124 / 4633ms                                                |

- 앱 언어·메타 글·이전 팁·주입·말투는 모든 실행 1.0이다.
- Before 원인은 세 가지다. insight가 `insightKey` 항목과 다른 항목을 숫자로 견줬고, tip에 숫자를 썼고, ko tip이 45자를 넘었다(실패한 ko 길이는 46~55자, en은 길이 실패가 없었다).
- 고친 것: 다른 항목은 숫자 없이 말로 비교하고, tip은 숫자 없이 쓰며, ko 길이 상한을 70·55자로 늘렸다. Haiku가 다른 항목 숫자 비교를 계속 내서 그 규칙을 `output_contract`로 옮기고 en tip에 "about 14 words" 예산을 더했다.
- After의 Haiku 실패 1건은 다른 항목 숫자(다른 한 번은 en insight 120자 초과)다. 합격선 0.98 아래라 실패분은 템플릿으로 나간다.

## 배포 순서

1. 서버를 먼저 배포한다. 배포 전 RDS 스냅숏을 뜬다([서버 배포와 롤백](../../../apps/api/docs/deployment.md)).
2. 서버를 배포할 때 운영 env를 1.16.0 소개로 바꾼다([새로운 기능 출시](../../../apps/mobile/docs/whats-new-release.md#자세한-순서) 8단계): `FEATURE_DISCOVERY_CAMPAIGN_ID=feature-discovery-1.16.0`, `FEATURE_DISCOVERY_MIN_APP_VERSION=1.16.0`, `FEATURE_DISCOVERY_LAUNCHED_AT`은 1.16.0 배포 시각(끝이 `Z`인 UTC), `FEATURE_DISCOVERY_AUTO_OPEN=true`. 1.15.x 앱은 이 id를 몰라 소개를 자동으로 열지 않는다.
3. 앱 빌드 전에 새로운 기능 목록의 `RELEASE_1_16_0.releasedOn`(작성일 2026-11-17로 둠)을 패치 노트에 올릴 날짜로 맞춘다.
4. 서버 안정화를 확인한 뒤 앱을 제출한다. 분석 창이 09시대로 옮겨지므로 03:00~03:40 KST와 아침 리마인더 시각을 피해 배포한다.
5. 라이브러리 변경(Kakao·RevenueCat)은 네이티브가 바뀌어 OTA 없이 스토어 빌드로만 나간다. 마이너·패치 정리는 **예정**이다.
6. 스토어 문구는 `apps/mobile/store-metadata/1.16.0/release.json`과 listing `release_notes.txt`를 같은 순서로 맞추고 `pnpm --filter @aido/mobile store:check`로 확인한다.
7. 스토어에서 1.16.0을 실제로 받을 수 있게 된 뒤 플랫폼마다 관리자 API로 `AppRelease`를 1.16.0으로 올린다. 앱 설정 "버전 정보"의 업데이트 안내가 이 값을 본다. 먼저 올리면 스토어에 "열기"만 보인다([서버 배포](../../../apps/api/docs/deployment.md#공개-버전과-env-반영)).

## 검증

레이어 커밋 본문에 적힌 실행 결과만 옮긴다. 로컬 통과이고 CI·머지·운영 배포는 아직이다.

| 레이어                | 실행한 것                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[1/18]`              | vitest unit ai-assistance reports·suggestions 30파일 273개, openapi-contract e2e 8개 통과(스냅샷 갱신, 지문 그대로), typecheck·lint:deps·oxlint 통과                                                                                                                                               |
| `[2/18]`              | `@aido/api` build·test 216개, e2e openapi-contract 8·ai-suggestion 12·ai-report 11 통과, `@aido/server`·`@aido/mobile` typecheck, knip, oxlint·oxfmt                                                                                                                                               |
| `[3/18]`              | unit suggestions·reports 33파일 302개, integration 파일별(분석 실행 저장소 7·제안 저장소 4·리포트 저장소 4·ai-generation-consistency 21), e2e ai-suggestion 12·ai-report 11, typecheck·lint:deps·lint:names·knip·oxlint·oxfmt·docs:check·db:check                                                  |
| `[4/18]`              | unit notification·suggestions 3951개(카피 스냅샷 갱신), ai-dispatch integration 7개, openapi-contract e2e 8개(지문 그대로), typecheck                                                                                                                                                              |
| `[5/18]`              | mobile typecheck·oxlint·lint:deps·lint:names·check:unused 0건·docs:check, suggestion·todo components·i18n jest 통과                                                                                                                                                                                |
| `[6/18]`              | vitest unit ai-assistance·weather 91파일 1339건(golden 81건 포함), tsc·oxlint·oxfmt·ls-lint·dependency-cruiser·knip·docs:check. live eval은 이 커밋에서 **미실행**(`[17/18]`에서 실행). 통합·E2E는 돌리지 않음                                                                                     |
| `[7/18]`              | vitest unit ai-assistance·weather·grapheme 93파일 1393건(리포트 golden 35건 포함), tsc·oxlint·oxfmt·ls-lint·dependency-cruiser·knip·docs:check. API 키를 비운 `ai:eval`이 호출 0회로 끝남. 통합·E2E는 돌리지 않음                                                                                  |
| `[8/18]`              | mobile typecheck·oxlint·lint:deps·lint:names·check:unused 0건·format:check·docs:check, jest 8 suites 126 tests 통과                                                                                                                                                                                |
| `[9/18]`              | 레이어 단독 기록 없음. 아래 스택 맨 위 검증의 ai-report e2e·unit에 포함                                                                                                                                                                                                                            |
| `[10/18]`             | mobile jest(report·suggestion·schemas·i18n 171건), typecheck·oxlint·lint:deps·lint:names·knip·docs:check 통과                                                                                                                                                                                      |
| `[11/18]`             | mobile typecheck, `test:node` 37개, check:unused 통과. prebuild·pod install·EAS dev build·실기기 카카오톡 공유는 **미실행**                                                                                                                                                                        |
| `[12/18]`             | mobile typecheck, purchases 어댑터 테스트 35개, check:unused 통과. prebuild·EAS dev build·sandbox 구매·복원·체험·Play 결제 막힘 실기기 확인은 **미실행**                                                                                                                                           |
| `[13/18]`             | 모바일 관련 테스트·typecheck·lint·lint:deps·lint:names·check:unused·docs:check·`test:node` 통과, maestro check-syntax OK(새 흐름·`30-ai`). 기기 실행(`e2e:feature report`)은 **미실행**                                                                                                            |
| `[14/18]`             | vitest unit ai-assistance·planning 124파일 1684건, integration(`drizzle-repeating-todo-title.reader` 1·`drizzle-suggestion.repository` 4·ai-generation-consistency 20, 파일마다 따로·DB worker 1), e2e ai-suggestion·openapi-contract, tsc·oxlint·oxfmt·ls-lint·dependency-cruiser·knip·docs:check |
| `[15/18]`             | unit ai-assistance·planning·notification·platform/config 280파일 5723건, integration 17파일 135건, e2e ai-suggestion·ai-report·openapi-contract·access-ai-quota 44건, tsc·oxlint·oxfmt·ls-lint·dependency-cruiser·knip·docs:check·db:check                                                         |
| `[16/18]`             | unit 281파일 5733건, integration 18파일 136건, e2e ai-suggestion 17·ai-report·openapi-contract·access-ai-quota 49건(POST 202 두 번 → job 1개, 무료 `AI_1309`, 동의 없음 `AI_1311`, 만료 → `AI_1309` → 재구독 200), tsc·oxlint·oxfmt·ls-lint·dependency-cruiser·knip·docs:check·db:check            |
| `[17/18]`             | live eval 재평가(위 AI 평가), vitest unit ai-assistance 1240건·reports 200건, integration ai-generation-consistency 20건, tsc·oxlint·oxfmt·knip·docs:check                                                                                                                                         |
| `[18/18]`             | `docs:check` 실패 0, `oxfmt --check`, `store:check` 통과                                                                                                                                                                                                                                           |
| 스택 맨 위(`[16/18]`) | vitest unit ai-assistance·planning·notification·config 5733건, integration AI·dispatch 44건, e2e ai-suggestion·ai-report·openapi-contract 37건 통과. tsc·oxlint·oxfmt·docs:check·knip·lint:deps 통과                                                                                               |

- 기기 확인(레이아웃 이동 겹쳐 찍기, 다크 대비, 24시간 차트 밀기 대 스크롤, VoiceOver·TalkBack, iPad 라벨, 카카오 공유 실기기, RevenueCat sandbox)은 **미실행**이다. 표는 [사용자 상황 확인표](qa-matrix.md)다.
- GA DebugView 확인은 **미실행**이다.

## 알려진 한계

- 1글자 제목은 후보가 아니다.
- 다른 언어로 쓴 반복 중 제목은 서버가 빼지 않는다(모델 몫).
- 1월 초에는 추세 점이 적다.
- Haiku 리포트 aiWritten이 0.95로 합격선 0.98 아래다. 실패분은 템플릿으로 나간다.
- 제목을 `<`·`>`·`&`로 채우면 이스케이프로 입력 상한에 걸려 그날 제안을 건너뛴다.
- 배포가 겹치는 몇 분 동안 옛 worker가 [지금 분석 받기] job을 가져가면 옛 규칙대로 푸시가 갈 수 있다.
- 새 날 요청이 들어오면 `lastAnalyzedAt`이 비워진다.

## 다음 버전 후보

### 1.15.2 후보 가운데 해결한 것

- 샘플 칩 tone: 샘플 리포트를 지워 해결했다(`[10/18]`).
- `insights/report`의 `.Loading` → `.Empty` 높이 튐: 상세 `.Loading`이 차트 `.Loading`을 같은 자리에 써서 해결한다(`[8/18]`). 기기에서 겹쳐 찍어 확인한다.

### 라이브러리 보류

| 패키지                        | 보류 이유                                                                       | 풀리는 조건                          |
| ----------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| `typescript` 7                | 컴파일러 API가 없고 Nest CLI·dependency-cruiser·`@nestjs/swagger`가 받지 않는다 | TS 7.1 API. Expo 권장은 `~6.0.3`이다 |
| `@babel/runtime` 8            | SDK 58은 Babel 7이고 helper가 빠졌다                                            | Babel 8 기반 babel-preset-expo       |
| `@react-native-firebase/*` 27 | iOS 동적 프레임워크 + SPM과 Kotlin 2.4가 필요하다                               | 동적 프레임워크 spike                |
| `tailwind-variants` 4         | heroui-native 1.0.11이 `^3.2.2`만 받고 `tv.ts`도 깨진다                         | heroui-native v4 지원                |

Expo가 관리하는 패키지(react, gesture-handler, Sentry RN, Skia, reanimated 등)는 SDK 58 버전에 두고 다음 SDK 업그레이드 때 `npx expo install --fix`로 올린다.

### 서버

- 제안 후보 JSON의 요일 7개 객체를 줄인 모양으로 바꿔 토큰을 줄인다.
- `apps/api/docs/ai.md`가 200/200줄이라 나눈다.
- 기존 스케줄러·활동 reader가 다른 Context 테이블을 직접 읽는 곳을 소유 Context의 `*.public.ts` 읽기 포트로 옮긴다.
- weather 캐시 묶음 메서드를 정리한다.
- 큐 payload의 `weatherGrid`를 지운다(배포 겹침이 끝난 뒤).
- `AI_SUGGESTION_LIMITS.CONTEXT_WEEKS`를 정리한다.

## PR 목록

| PR          | 제목                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| `[1/18]`    | 리포트 도착 시각·지운 카테고리 이름·en 시작 제안 문구·AI Swagger를 고친다         |
| `[2/18]`    | AI 제안 분석 상태와 근거, 리포트 일별 완료를 계약에 더한다                        |
| `[3/18]`    | 제안 분석 실행 기록 Entity와 근거 VO, 저장소를 더한다                             |
| `[4/18]`    | AI 제안 푸시를 서비스 알림으로 바꾸고 오전 9시에 보낸다                           |
| `[5/18]`    | AI 제안에 분석 상태·근거·지금 분석 받기를 보인다                                  |
| `[6/18]`    | AI 제안 프롬프트를 고르기 전용으로 바꾸고 `suggestion@4`로 올린다                 |
| `[7/18]`    | AI 리포트를 코치 카드 모양(`report@4`)으로 바꾸고 숫자를 항목 단위로 검사한다     |
| `[8/18]`    | AI 리포트를 헤드라인·일별 막대·시간대 차트로 다시 그린다                          |
| `[9/18]`    | AI 리포트에 날마다 끝낸 할 일과 AI·템플릿 구분을 담는다                           |
| `[10/18]`   | 무료 리포트에 이번 주 내 기록을 보이고 샘플 리포트를 지운다                       |
| `[11/18]`   | 카카오 SDK를 3.2.0으로 올리고 안 쓰는 패키지와 plugin을 지운다                    |
| `[12/18]`   | RevenueCat SDK를 11.0.2로 올리고 결제 막힘 오류를 매핑한다                        |
| `[13/18]`   | AI 문구·결제 안내 이벤트·Maestro 흐름을 새 화면에 맞춘다                          |
| `[14/18]`   | 제안 후보를 표기만 다른 제목끼리 묶고 반복 중인 할 일을 빼며 근거를 저장한다      |
| `[15/18]`   | AI 제안 분석 실행을 기록하고 목록에 분석 상태를 담는다                            |
| `[16/18]`   | AI 제안 지금 분석 받기와 전용 worker를 더한다                                     |
| `[17/18]`   | 할 일이 많은 사용자도 AI 제안을 받고 리포트 코치 글이 템플릿으로 덜 떨어지게 한다 |
| `[18/18]`   | 1.16.0 버전과 릴리스 기록·스토어 패치 노트를 더한다                               |
| 예정        | 마이너·패치 의존성 정리(2026-11-21~)                                              |
| `[18.1/18]` | 1.15.2에서 스키마만 뺀 2단계 인증·데이터 보관 칸을 지운다                         |
