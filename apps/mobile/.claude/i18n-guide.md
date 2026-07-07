# i18n 가이드 (다국어)

> **Version**: 1.0.0 · **Last Updated**: 2026-07-07 · **Owner**: Aido Mobile Team

한국어(소스 언어, 원문 보존) + 영어. i18next + react-i18next + expo-localization 기반.

---

## 구조

```
src/shared/i18n/
├── index.ts           # i18n 싱글턴, t(비컴포넌트용), tDynamic(런타임 키), useTranslation re-export
├── init.ts            # 폴리필 → 동기 init → languageChanged→dayjs.locale 동기화 (app/_layout.tsx에서 로드)
├── i18next.d.ts       # 타입 안전 — ko 카탈로그가 타입 소스, 키 오타는 typecheck에서 실패
├── resources.ts       # ko/en JSON 집계
└── locales/{ko,en}/   # 네임스페이스별 카탈로그 (ko = 원문)
```

**네임스페이스**: feature 1:1 (`todo, auth, memo, friend, notification, user, subscription, ai, achievement, inquiry, weather, appIcon`) + 횡단 4개 (`common, errors, validation, settings`).

**언어 상태**: `src/shared/preferences/language.preference.ts` (MMKV `aido_language`, `'system'|'ko'|'en'`) + `src/shared/providers/language-provider.tsx` (`useLanguage()` — `resolvedLanguage` 파생, useEffect로 i18n 단방향 동기화). 설정 화면: `app/(app)/settings/language.tsx`.

---

## 규칙

### 새 문자열 추가
1. **하드코딩 금지** — 사용자 노출 문자열은 반드시 ko/en 카탈로그 동시 추가 (`locale-parity.test.ts`가 키·보간 변수 불일치를 CI에서 잡음)
2. 키: `{screen|section}.{element}` camelCase, 최대 3단계 (예: `todo:detail.deleteConfirm.title`)
3. 공용 문구(확인/취소/저장 등)는 `common:actions.*` 재사용

### 컴포넌트 vs 비컴포넌트
```tsx
// 컴포넌트 — 언어 변경 시 자동 리렌더
const { t } = useTranslation('todo');
<Text>{t('list.empty')}</Text>

// 비컴포넌트(에러 팩토리, mutation onError, 토스트 헬퍼) — 싱글턴
import { t } from '@src/shared/i18n';
toast.error(t('friend:toast.sendFailed'));
```
- **모듈 로드 시점 평가 금지**: `const MSG = t('...')` (톱레벨) ❌ — 언어 변경 시 갱신 안 됨. 반드시 호출 시점 `t()`.
- ns 바인딩된 `useTranslation('ns')`의 t는 크로스 ns 접두사 키를 타입에서 거부 → 크로스 ns는 `useTranslation(['ns', 'common'])` 배열 또는 싱글턴 `t as tGlobal`.

### 패턴
- **보간**: `t('repeat.weekly', { days })` / 카탈로그 `"매주 {{days}} 반복"`
- **복수형**: ko는 단일 키(`"{{count}}개"`), en은 `_one`/`_other` 접미사 — `t('list.count', { count })`
- **enum 라벨 맵**: 값 대신 키를 담는다
  ```ts
  export const INQUIRY_CATEGORY_LABEL_KEYS = {
    BUG_REPORT: 'inquiry:category.bugReport',
    ...
  } as const satisfies Record<InquiryCategory, string>;
  // 사용처: t(INQUIRY_CATEGORY_LABEL_KEYS[category])
  ```
- **런타임 키**(에러 코드 등): `tDynamic('errors', code, fallback)` — 타입 검증 우회 전용
- **날짜/시간**: `@src/shared/utils/date`(formatFullDate, getWeekdayLabels, formatRelativeTime, getDateSectionLabel 등)와 `time.ts`가 이미 로케일 인지 — 재구현 금지. dayjs 전역 locale은 init이 관리 (`dayjs.locale()` 직접 호출 금지)

### 에러 메시지
- 서버 에러: `errors` 네임스페이스, **키 = ErrorCode 그대로** (145개 전 코드 커버). `error-handler.ts`의 `resolveMessage`가 카탈로그 → 서버 message → `errors:fallback` 순으로 해석
- 보안 마스킹 그룹(EMAIL_0502/0507, USER_0602 등)은 **두 언어 모두 동일 문구 유지** — 번역 시에도 그룹 단위로 같게
- `@aido/validators`의 zod message는 서버 소유(한국어 유지) — 모바일 폼은 필드+에러타입 → `validation:*` 키로 표시

### 비번역 대상
- 코드 주석, 로그, Sentry breadcrumb/이벤트 메시지 (개발자용)
- 언어 이름 자체("한국어", "English" — 해당 언어로 고정 표기)
- 서버가 조립해 내려주는 텍스트(푸시 알림 title/body — 서버 locale이 처리)

### 레이아웃 안전 (영어 장문)
- Row 내 텍스트 `shrink`(flexShrink), 고정 width 금지(padding 기반), 필요 시 `numberOfLines` + `ellipsizeMode`
- en 번역은 ko 대비 ~1.4배 길이 상한 가이드
- QA 최악 조합: **en × xlarge 글꼴 스케일**

---

## 자산 배치 원칙 (모노레포)

- **카탈로그(locales/*.json)는 앱 소유** — 소비자가 모바일 하나뿐이라 패키지화하지 않는다 (dist 빌드 체인·Metro 우회 비용만 추가). 서버 푸시 템플릿과 중복 문자열 0건 확인됨 (2026-07)
- **공유 계약은 `@aido/errors`의 ErrorCode뿐** — 클라 errors.json이 코드를 키로 소비. 메시지 문구는 서버(정중체)/클라(구어체)로 의도적 분리 유지
- **서버 발송·생성 텍스트(푸시 템플릿, AI 프롬프트)는 서버 소유** — `apps/api/src/modules/notification/templates/locales/`
- **저장된 히스토리는 생성 당시 언어 유지가 설계** — 과거 알림 title/body, 과거 AI 리포트 본문은 언어 변경 후에도 그대로 (본문-라벨 일관성)

## 서버 연동

- Ky 클라이언트가 `Accept-Language: <i18n.language>` 헤더 전송 (auth/public 공통, beforeRequest 훅)
- 서버는 푸시 토큰 등록 시 `UserPreference.locale` upsert → 푸시 알림 언어 결정 (`apps/api/src/modules/notification/templates/`)
- 미전송(1.3.x)·미지원 언어는 서버가 'ko'로 처리 — 하위 호환

## 테스트

- 카탈로그 정합성: `src/shared/i18n/__tests__/locale-parity.test.ts` (키 집합·보간 변수·빈 값)
- 언어별 동작 검증은 실제 카탈로그로 init 후 `i18n.changeLanguage()` — 카탈로그 모킹 금지
- 테스트 후 `afterEach(() => i18n.changeLanguage('ko'))`로 복원
- 잔여 한국어 검출: `grep -rn '[가-힣]' src app --include='*.ts*' | grep -v locales/ | grep -v '.test.'` (주석 제외 0건 유지)
