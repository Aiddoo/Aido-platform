# 레거시와 하위 호환

내부 코드는 레거시 없이 현재 구조 하나로 유지하고, 하위 호환은 **배포된 앱·기기·운영 데이터가 보는 외부 계약**에서만 지킨다.

## 1. 내부: 남기지 않는다

- 바뀐 구현의 forwarding 파일·alias·re-export·쓰지 않는 export·옛 이름의 wrapper를 남기지 않는다. 실제 소비를 검색해 함께 지운다.
- "혹시 몰라" 두는 분기·플래그·옛 경로를 만들지 않는다. 문서·주석에도 삭제된 경로를 현행 예제로 남기지 않는다.
- 임시로 남겨야 하는 코드는 `@deprecated`와 제거 조건이 담긴 `TODO`를 함께 둔다(예: AI 프롬프트 v1의 `TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤`). 조건 없는 TODO는 쓰지 않는다.

## 2. 외부 계약: 바꾸지 않는다

| 계약              | 지키는 것                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST(`/v1`)       | 기존 필드의 이름·타입·required/nullable·의미·오류 코드. 새 필드는 additive optional로만 추가한다([REST 계약](../../apps/api/.claude/rest-contracts.md)) |
| 앱 버전별 동작    | 새 동작이 구 앱을 깨면 `X-App-Version` 헤더로 서버가 분기한다. 헤더가 없는 구 앱은 기존 동작이다                                                        |
| 라우트·딥링크     | 공개된 경로와 `aido://` URI. `aido://auth/callback`, `aido://auth/{provider}`는 바꾸지 않는다. 새 경로는 추가만 한다                                    |
| 푸시 payload      | 의미 데이터(type + context id)만 보낸다. 앱이 목적지를 정하므로 라우트를 바꿔도 payload는 그대로다([Push](../../apps/api/docs/push-notifications.md))   |
| 위젯 snapshot·URI | `aido_widget_snapshot_v1` key와 저장 JSON 버전 해석, `aido://feed?…`·`aido://todo/{id}` 형식([위젯](../../apps/mobile/.claude/widgets.md))              |
| 기기 저장 key     | SecureStore 토큰 key, MMKV key, 초안 key 형식. 바꾸면 기존 설치의 로그인·설정·초안을 잃는다                                                             |
| DB·queue·cache    | migration graph는 additive로 쌓고, job 이름·payload·Redis key/TTL은 소유 Context의 계약이다                                                             |

호환 판단은 OpenAPI·released-client fingerprint([E2E](../../apps/api/.claude/e2e-test.md#호환성openapi))와 push/widget resolver 테스트로 확인한다. 고정된 released fixture를 현재 schema로 재생성하지 않는다.
