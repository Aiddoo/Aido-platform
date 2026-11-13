# Aido

Turborepo + pnpm 모노레포. AI 할 일 관리 서비스의 API 서버와 모바일 앱이다. 이 파일이 Claude·Codex 공통 지침의 단일 원본이고 `CLAUDE.md`는 `@AGENTS.md` 한 줄이다. 세션마다 읽히므로 얇게 두고 상세는 각 앱 문서에 둔다.

## 작업 진입점

서버·앱 파일을 고치기 전에 그 앱의 `AGENTS.md`를 먼저 읽는다(Codex는 실행 위치 아래 `AGENTS.md`를 자동으로 읽지 않는다).

- API: [`apps/api/AGENTS.md`](apps/api/AGENTS.md) → 필요한 문서만 [서버 문서 안내](apps/api/docs/README.md)에서 고른다. 새 서버 기능은 [새 기능 추가](apps/api/docs/new-feature.md) 순서를 따른다.
- Mobile: [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md).
- 앱·서버 공통: [오류](docs/conventions/errors.md) · [날짜·언어](docs/conventions/dates.md) · [호환](docs/conventions/compatibility.md) · [nullish](docs/conventions/nullish.md) · [테스트 파일](docs/conventions/testing.md) · [Git](docs/conventions/git.md).
- 문서·`AGENTS.md`·rules·스킬을 고칠 때는 [문서 규칙](docs/conventions/docs.md)을 읽는다.

## 스택

Node 26(EAS 모바일 빌드 24) · NestJS 12 ESM · Drizzle ORM 1.0 RC · PostgreSQL 16 · pg-boss 12 · Expo SDK 58 · React Native 0.88 · React 19 · TypeScript 6 · Zod 4 · Oxlint·Oxfmt · Turbo 2 · pnpm 12. 정확한 버전은 `pnpm-workspace.yaml` catalog와 `.nvmrc`가 정본이다. 상세: [README](README.md).

## 모노레포

```text
apps/api        NestJS 서버 (문서: apps/api/docs)
apps/mobile     Expo 앱
packages/api    REST 계약·오류 코드·공용 어휘 (@aido/api)
tooling/*       공유 설정(vitest·typescript), migration CLI
docs/           앱·서버 공통 규칙(conventions), 릴리스 기록(releases)
```

## 명령

- `pnpm install` · `pnpm docker:up`(PostgreSQL) · `pnpm dev` · `pnpm build`
- `pnpm check`: lint(관례 포함) → format:check → docs:check → 이름(ls-lint) → 경계(dependency-cruiser) → 미사용(knip) → typecheck(커밋 전 한 번)
- 가드레일: `pnpm lint`(Oxlint, 관례 규칙은 `tooling/oxlint-plugin-aido`의 `aido/*`) · `pnpm docs:check`(문서 링크·경로·길이·에이전트 파일) · `pnpm lint:names`(ls-lint) · `turbo run lint:deps`(dependency-cruiser, 서버·모바일) · `pnpm check:unused`(knip: 모바일을 뺀 모든 workspace의 파일·export·의존성·catalog) · `pnpm --filter @aido/mobile check:unused`(모바일 knip)
- `pnpm lint` · `pnpm format` · `pnpm format:check` · `pnpm typecheck`
- `pnpm test` · `pnpm test:integration` · `pnpm test:e2e` · `pnpm test:contract`. 여러 러너가 함께 돌면 `AIDO_TEST_WORKERS`·`AIDO_TEST_DB_WORKERS`로 worker를 줄인다
- `pnpm db:generate` · `pnpm db:migrate` · `pnpm commit`
- Swagger UI: `http://localhost:8080/api/docs`(로컬 `pnpm dev` 실행에서만)

## 공통 코드 규칙

서버·앱 공통이다. 앱·서버 문서는 여기로 링크하고 되풀이하지 않는다.

**가독성**

- 같이 실행되지 않는 코드는 나눈다. 버전·권한별 분기를 한 함수에 섞지 않는다.
- 구현 상세는 감춘다. 흐름이 위에서 아래로 읽히고 SQL·SDK·네이티브 호출은 어댑터에 둔다.
- 로직 종류로 묶은 만능 클래스·훅을 만들지 않는다. 행동 하나가 함수·UseCase 하나다.
- 복잡한 조건·매직 넘버에 이름을 붙인다. 상수는 단위를 이름에 넣는다(`timeoutMs`).
- 한 번만 쓰는 작은 조회표는 쓰는 함수 안에 둬 시점 이동을 줄인다.
- 중첩 삼항을 쓰지 않는다. 유니온 분기는 ts-pattern `match().exhaustive()`, 그 밖은 `if`다. 한 줄 `if`도 중괄호를 쓴다(`curly`).
- 범위 비교는 `min <= value && value <= max`로 쓴다.

**예측 가능성**

- 라이브러리와 겹치는 이름(`HttpService`·`Logger`)을 쓰지 않는다. 역할로 짓고 포트 이름에 SDK·공급자 이름을 쓰지 않는다.
- 같은 종류 함수는 반환 모양을 통일한다(`find*`는 `T | null`, 판정은 판별 유니온).
- 숨은 부수효과를 만들지 않는다. 저장소·매퍼는 로그·발송·캐시 정리를 하지 않는다.

**응집도·결합도**

- 함께 바뀌는 파일은 같은 기능 폴더에 둔다. 함께 바뀌지 않으면 버그가 나는 것(계약·큐 payload·잠금 키)은 한 곳에 응집한다.
- 책임은 하나씩(SOLID). 계산·변환은 부수효과 없는 순수 함수이고 클래스·훅은 그것을 감싼다.
- 기능 사이 중복은 허용한다. 공용화는 함께 바뀌어야 할 때만 한다. props·인자 드릴링은 구조로 없앤다.
- 재수출(`export … from`)은 정해진 공개 진입 파일(서버 slice `*.public.ts`·`@aido/api` exports·Drizzle schema 묶음, 앱 공개 면 `shared/*`·`di-context`·`src/testing/core.ts`)에서만 한다. 새 barrel `index.ts`를 만들지 않는다(`aido/no-re-export`·`aido/no-barrel-file`).

**TypeScript**

- `strict`. `as`(`as const` 제외)·`any`·`!`·`@ts-ignore`/`@ts-expect-error` 금지(`consistent-type-assertions`·`no-explicit-any`·`no-non-null-assertion`·`ban-ts-comment`). 타입은 Zod·props·`as const` 튜플에서 유도한다.
- 비공개 멤버는 `#` 하나다. TS `private` 키워드와 생성자 파라미터 프로퍼티를 쓰지 않는다(`aido/no-member-accessibility`·`parameter-properties`).
- 값 비교는 `===`, "없음"만 `== null`. 기본값은 `??`다(`eqeqeq`·`aido/no-strict-nullish`). 상세: [nullish](docs/conventions/nullish.md).
- 공유 값 목록(상태·종류·언어)은 `@aido/api/vocabulary` 튜플 한 곳에서 선언하고 나머지는 유도한다.

**그 밖**

- 라이브러리·프레임워크가 주는 기능을 다시 만들지 않는다(es-toolkit, ts-pattern, Zod, 공식 Nest·Expo 모듈). 공식 문서의 권장 방식을 먼저 본다.
- 주석은 코드로 알 수 없는 이유(제약·버전·정책·순서·호환·QA 근거)만 한 줄로 남긴다. 이름을 되풀이하는 JSDoc, 다음 줄 설명, 구역 구분선, 변경 이력을 쓰지 않는다. 테스트의 `// Given`·`// When`·`// Then`은 남긴다.
- 테스트는 중요한 비즈니스 로직과 공용 유틸에만 쓴다. 이름과 형식(GWT 한 줄 주석·한국어 제목·포트 stub)은 [테스트 파일](docs/conventions/testing.md)이다.
- 안 쓰는 코드·파일·빈 폴더·레거시는 지운다. 하위 호환에 필요한 계약만 남긴다([호환](docs/conventions/compatibility.md)).
- env 값·토큰·키를 로그·문서·커밋에 쓰지 않는다.
- 판단이 갈리면 사용자 사용성 > 일관성 > 구현 편의다.

## 금칙과 계약

- 요청·응답 계약은 `@aido/api`, 앱 모델은 앱이 소유한다. 오류는 `@aido/api/errors`의 `ErrorCode`를 쓰고 문자열을 하드코딩하지 않는다.
- 서버 Controller에서 `@Headers("x-…")`를 쓰지 않는다. `RequestClient`(`@CurrentRequestClient()`·`@AppVersion()`)로 읽는다.
- 출시 앱이 보는 외부 계약(HTTP·푸시 payload·딥링크·기기 저장 key·DB·큐 이름)은 추가만 한다.
- 커밋·PR은 한국어 Conventional Commits(`refactor(server): …`), 본문 줄 100자 이하(commitlint), `Co-Authored-By` 트레일러 없음, `--no-verify` 금지. PR에는 실제 검증과 측정한 숫자만 쓴다. stack 라벨·tip CI·머지 순서는 [Git](docs/conventions/git.md)이다.

## 검증

- 범위는 바꾼 동작과 위험에 맞춘다. 문서만 바꾸면 `pnpm docs:check`·`pnpm format:check`와 예제를 확인한다. 코드는 관련 정적 검사와 의미 있는 테스트로 확인한다.
- 통과한 검사는 추가 변경·실패·미확인 위험이 있을 때만 다시 돌린다. 결과에는 실행한 명령과 범위, 남은 한계를 적는다.
- 데이터 삭제·운영 migration·배포·공유 Git 이력 재작성은 사용자의 기존 승인 범위에서만 한다. 서버의 일회성 테스트 DB 생성·삭제는 테스트의 정상 수명주기다.
- Mobile 검증 규칙은 앱 지침을 따른다.
