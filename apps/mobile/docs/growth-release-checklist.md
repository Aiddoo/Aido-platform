# Growth release checklist — Aido 1.8.0

이 체크리스트는 앱, 서버 설정, 안내 캠페인, App Store/Google Play 소재가 서로 다른
버전으로 배포되는 일을 막습니다. 체크만 준비하며 저장소 변경만으로 외부 게시나
프로덕션 배포를 수행하지 않습니다.

## 단일 릴리스 식별자

- [ ] 앱 버전: `1.8.0`
- [ ] 캠페인 ID: `feature-discovery-2026-08`
- [ ] 캠페인 출시 시각: `2026-08-01T00:00:00.000Z`
- [ ] 서버 최소 앱 버전: `1.8.0`
- [ ] 인앱 번들 레지스트리와 스토어 메타데이터의 캠페인 ID·출시 시각이 일치
- [ ] `pnpm --filter @aido/mobile check:release-assets` 통과

## 기존 사용자 안전성

- [ ] 출시된 구버전 클라이언트의 `/v1` 요청·응답 계약 변경 없음
- [ ] 기존 푸시 권한, 마케팅 동의, 알림 설정, 알림 기록을 초기화하거나 재요청하지 않음
- [ ] 알 수 없는 버전과 1.8.0 미만 버전에 기능 마케팅 푸시를 보내지 않음
- [ ] 서버 설정 오류·네트워크 실패·알 수 없는 캠페인은 자동 열기 없이 종료
- [ ] 가이드를 닫아도 사용자의 실제 Todo, 메모, 친구, 카테고리 데이터는 변경 없음

## 콘텐츠 동기화

- [ ] 웹사이트/랜딩이 있다면 첫 문구를 `메모가 할 일이 되고, 친구와 함께 끝내는 투두.`로 맞춤
- [ ] 현재 패치 노트가 1.8.0이며 사용자 변화부터 설명
- [ ] 친구 찾기 문구가 전부 `이름 또는 Aido ID`인지 한국어·영어로 확인
- [ ] App Store와 Google Play 설명에 AI·친구·정리 organic variant를 준비
- [ ] 스크린샷 순서: 메모 AI → 이름 검색 → 드래그 정리 → 생성 방식 → 친구
- [ ] 한국어/영어 스크린샷에서 작은 화면, 큰 글꼴, reduce-motion 상태 확인

## 단계적 출시와 rollback

1. 서버를 `FEATURE_DISCOVERY_ENABLED=false`로 먼저 배포합니다.
2. 1.8.0 바이너리와 스토어 소재를 검수한 뒤 각 스토어에 별도로 게시합니다.
3. 크래시·로그인·Todo 생성/완료 지표와 1.8.0 도달률을 확인합니다.
4. 캠페인 ID, 최소 버전, 출시 시각을 확인하고 자동 열기를 점진적으로 활성화합니다.
5. 마케팅 푸시는 명시적 동의 + payload v2 + 앱 1.8.0 이상만 대상으로 별도 승인합니다.
6. 문제가 생기면 `FEATURE_DISCOVERY_ENABLED=false`로 즉시 rollback합니다. 번들된 마이페이지
   가이드는 남고 기존 앱 기능과 데이터는 계속 동작합니다.

## 검증과 공개

- [ ] Unit: eligibility, seen/attribution/activation/review 정책
- [ ] Component: 바텀시트, 재진입 카드, 체크리스트, 접근성, 작은 화면
- [ ] Integration/E2E: 실제 `/v1` config, 내부 CTA navigation, mutation success attribution
- [ ] OpenAPI 스냅샷에서 기존 계약 diff 없음
- [ ] App Store Connect, Google Play Console, 웹사이트는 사람이 최종 검수 후 각각 게시
- [ ] 현재 가입자/활성화 게이트가 충족되지 않았으므로 추천인 루프는 포함하지 않음
