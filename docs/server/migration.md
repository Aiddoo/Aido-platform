# 서버 구조 전환

[Epic #882](https://github.com/Aiddoo/Aido-platform/issues/882)의 진행 기록이다.
완료된 검증과 남은 작업을 구분한다. 코드 전환 완료가 운영 배포 완료를 의미하지 않는다.

## 기준과 불변 계약

Prisma 8 기준 커밋은 `823724b5`이며 [PR #884](https://github.com/Aiddoo/Aido-platform/pull/884)로
보존했다. ORM·CLI는 현재 RC다. 기존 `/v1` URL·HTTP 상태·응답·오류 코드·날짜·정렬·페이지네이션,
로그인·토큰·구독·사용량·알림·반복 일정의 의미를 유지한다. CUID와 숫자 ID, 적용된 DB migration
이력을 보존한다. 내부 레거시 구현을 제거하더라도 기존 앱이 소비하는 필드는 현행 계약으로 유지한다.

## 순서와 현재 상태

- [x] 00 Prisma 8 기존 변경 보존, Unit 2,895·Integration 433·E2E 480 재검증
- [x] 01 CI Stack 정책·컨벤션·Workspace 의존성 검사, Unit 2,902·공식 PG service Integration 10·E2E 11 검증
- [ ] 02 `@aido/server` 패키지명과 공유 REST `@aido/api` 통합
- [ ] 03 modules/platform/shared·명시적 조립·로그·키 경계
- [ ] 04 Identity: 계정·세션·설정·동의·계정 생명주기
- [ ] 05 Billing: Webhook·구독 상태 전이
- [ ] 06 Access: ABAC·Entitlement·Quota 예약·서버 capability
- [ ] 07 Planning: 할 일·항목·카테고리·반복 일정
- [ ] 08 Social: 친구·응원·넛지
- [ ] 09 Notes: 메모와 전환
- [ ] 10 Engagement: 댓글·반응·대화·정리
- [ ] 11 Insights: 완료 집계·주간 달성·연속 기록
- [ ] 12 Weather: 위치·좌표·격자·Provider
- [ ] 13 AI Assistance: 파싱·보고서·추천
- [ ] 14 Notification: 알림함·Push·Email·Reminder·Retention·Worker
- [ ] 15 Support·Operations·App Config
- [ ] 16 ORM·N+1·성능·컨테이너 검증
- [ ] 17 미사용 의존성·내부 레거시·빈 폴더 정리와 최종 검증

모든 Context는 같은 Domain/Application/Infrastructure/Presentation 패턴과 파일 접미사를
따른다. Domain/Application은 순수 TypeScript, 데이터 소유자는 Gateway 구현을 소유하며
Composition Root가 의존성을 연결한다. 상태 없는 문의 전달·조회에 가짜 Aggregate나 DB를 만들지 않는다.

서버는 접근·한도·전체 집계·저장 정합성을 판단하고 클라이언트는 표시·입력·상호작용을 계산한다.
신규 capability는 추가 API로 제공한다. 새 클라이언트 출시 전에 서버와 롤백 대상 이미지가 이를 지원해야 한다.

## 검증과 완료 조건

각 단계에서 lint·format·typecheck와 필요한 Unit/실제 PG Integration/HTTP E2E를 실행한다.
고정 구 클라이언트 fixture를 현재 schema로 재생성하지 않는다. 생성·복원·상태 전이·PATCH
presence·경쟁 조건·중복 Webhook/환불·작업 재시도·롤백을 Given/When/Then으로 검증한다.

순환 의존과 레이어 위반 0, 기존 앱 계약 유지, 데이터 전환·롤백 검증 통과, 대표 경로 N+1
제거, 성능 회귀 해결, 임시 내부 Adapter 제거를 완료 기준으로 둔다. BullMQ 제거는 기존
producer와 waiting/active/delayed/retry/repeat 작업의 drain 확인을 배포 전제 조건으로 둔다.

구조 개선을 성능 개선으로 추정하지 않는다. 같은 데이터·리소스에서 commit별 쿼리 수·p50/p95·
CPU·RSS·오류율을 측정하고 Issue/PR에 조건과 한계를 기록한다. 이전 Prisma 8의 8쿼리→5쿼리
측정은 후속 구조 전환 결과로 재사용하지 않는다. 운영 latency와 billed Actions 절감률은 미측정이다.
