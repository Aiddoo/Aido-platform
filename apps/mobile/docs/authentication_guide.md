# 인증 가이드 — 세션 수명주기와 불변식

> **Owner**: Aido Mobile Team · **Last Updated**: 2026-07-07

## 핵심 불변식: 클라이언트는 세션을 먼저 끊지 않는다

**토큰 삭제(=세션 종료)가 허용되는 경로는 정확히 두 가지뿐이다:**

1. **사용자의 명시적 로그아웃** (`AuthService`)
2. **서버의 definitive refresh 거부** — `token-refresher.ts`의 `expireSession`
   (refresh 401 · 2xx 응답 파싱 실패 · 리프레시 토큰 부재)

그 외 어떤 코드도 토큰을 삭제해서는 안 된다. 특히:

- **로컬 휴리스틱(플래그·앱 버전·MMKV 상태 비교)으로 토큰을 선제 삭제하지 않는다.**
  MMKV 플래그 부재는 "재설치"뿐 아니라 "그 플래그가 없던 구버전에서의 업데이트"도
  의미한다. v1.3.5의 첫 실행 가드가 이 오판으로 업데이트한 전체 유저를 강제 로그아웃시켰다
  (v1.4.0 사고, PR #591의 회귀).
- **부팅 시 인증 상태를 네트워크 결과에 걸지 않는다.** 오프라인·서버 장애 중에도
  리프레시 토큰이 있으면 인증 상태로 시작한다(낙관적 부팅, `auth-boot.ts`).
- 이 불변식은 `auth-boot.test.ts`가 회귀 테스트로 강제한다.

## 부팅 흐름 (`bootstrap/providers/auth-boot.ts`)

1. `FIRST_RUN_FLAG`(MMKV)가 없으면 심는다 — 삭제 트리거가 아니라 "이 설치의 첫 부팅" 신호일 뿐.
2. 키체인의 **리프레시 토큰** 존재 여부로 인증 상태 결정 (액세스 토큰은 만료돼도 refresh로 재발급되므로 근거가 아님).
3. 첫 부팅 + 토큰 존재 시에만 백그라운드로 `TokenRefresher`를 1회 호출(fire-and-forget):
   - 토큰 유효(업데이트/재설치 모두) → no-op, 세션 유지
   - 토큰 무효(재설치 잔존 등) → 서버 401 → `expireSession`이 조용히 정리 → 로그인 화면
   - 네트워크 실패 → no-op(토큰 보존)

   이 검증은 잘못 발동해도 최악의 결과가 no-op이며, 세션을 끝낼 수 있는 주체는 여전히 서버의 definitive 401뿐이다.

## 토큰 갱신 (`shared/infra/http/token-refresher.ts`, `auth-client.ts`)

- **단일 인스턴스**: `TokenRefresher`는 DI(`di-provider.tsx`)에서 1개만 생성해
  auth-client의 401 훅과 부팅 검증이 공유한다. 인스턴스가 갈라지면 single-flight mutex가
  분리되어 동시 회전(토큰 패밀리 소모)이 발생한다.
- 실패 분류: definitive(401·파싱 실패·토큰 부재) → 세션 종료 / transient(네트워크·타임아웃·429·5xx) → 토큰 보존 후 재시도.
- 클라 refresh 타임아웃 8s는 서버 reuse grace 10s보다 짧게 유지한다(회전 성공+응답 유실 시 재시도 여백).

## 영속 계약 (변경 시 마이그레이션 필수)

| 항목 | 위치 | 바꾸면 생기는 일 |
|---|---|---|
| 토큰 키 이름 (`accessToken`/`refreshToken`) | `storage-keys.constant.ts` | 기존 설치의 토큰을 못 읽음 → 전체 로그아웃 |
| `keychainAccessible` 등 키체인 옵션 | `secure-storage.ts` | 기존 키체인 항목 접근 불가 → 전체 로그아웃 |
| refresh 응답 envelope (`{ data: { accessToken, refreshToken } }`) | 서버 `v1/auth/refresh` | 클라가 2xx를 파싱 못 해 `invalid-refresh-response`로 세션 종료 |

## 서버 측 운영 불변식 (apps/api)

- **`JWT_REFRESH_SECRET` 회전 = 전체 유저 즉시 로그아웃.** 불가피하면 이중 키 검증 기간을 두고 회전한다.
- `JWT_REFRESH_EXPIRES_IN`(기본 7d)은 회전 시마다 sliding 갱신되므로 활성 유저는 만료되지 않지만,
  그 기간 이상 미접속한 유저는 재로그인이 필요하다. 세션 유지 정책에 맞게 프로덕션 값을 관리한다.
- 리프레시 토큰 재사용 grace는 10s(`TOKEN_REUSE_GRACE_PERIOD_MS`) — 클라 타임아웃(8s)보다 항상 길게 유지한다.
