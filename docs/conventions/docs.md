# 문서 규칙

문서·에이전트 지침(`AGENTS.md`·rules·스킬)을 쓰거나 고칠 때 읽는다. 검사는 `pnpm docs:check`([docs-check](../../scripts/docs/docs-check.mjs))이고 `pnpm check`·pre-commit·CI lint job이 돈다.

## 쓰는 법

- 한 문서에 주제 하나, 200줄 이하. 첫 줄은 언제 읽는지 한 문장이다.
- 규칙은 주인 문서 한 곳에만 쓰고 다른 문서는 한 줄 링크로 가리킨다.
- 도구가 막는 규칙은 한 문장과 규칙 이름만 쓴다(`aido/component-name`). 모바일 목록은 [가드레일](../../apps/mobile/docs/architecture/guardrails.md#규칙)이다.
- 문장은 코드로 확인할 수 있게 실제 경로·이름·명령으로 쓴다. 예시는 지금 코드에 있는 경로만 든다.
- 코드에서 바로 보이는 것(폴더 트리, 설정 값, 스크립트·파일 목록)은 옮겨 적지 않는다.
- 지금 규칙만 쓴다. "전환 중"·옛 구조·버전별 이력은 git에 남기고, 제목에 버전을 넣지 않는다.
- 출시 기록(`docs/releases/`, `apps/mobile/docs/releases/`)은 그때 상태로 두고 고치지 않는다.
- 검증은 실제 실행한 범위·조건·결과로 적는다. 로컬 통과·병합·운영 배포를 구분한다.

## 에이전트 파일

- `CLAUDE.md`는 `@AGENTS.md` 한 줄이다. 지침은 Claude·Codex가 함께 읽는 `AGENTS.md`에 쓴다.
- `AGENTS.md`는 입구다. 명령, 꼭 지키는 규칙(끝에 주인 문서 링크), "무엇을 할 때 무엇을 읽나" 표만 둔다. 루트는 100줄, `apps/mobile`은 150줄 이하다.
- `.claude/rules/*.md`는 `paths:` frontmatter와 40줄 이하다. Codex는 rules를 읽지 않으므로 같은 규칙이 `AGENTS.md` 링크로도 닿아야 한다.
- 스킬 정본은 Codex가 읽는 `.agents/skills/<이름>/SKILL.md`이고 Claude용으로 `.claude/skills/<이름>` 심볼릭 링크를 둔다. frontmatter `name`은 폴더 이름, `description`이 있다. 절차만 쓰고 규칙은 문서에 링크한다.
- 팀 규칙·운영 절차는 저장소 문서에 쓴다. 에이전트 개인 메모리(Claude auto memory, Codex memories)에는 개인 선호만 두고 저장소 규칙을 옮겨 적지 않는다.
- `apps/mobile/src/shared/ui/<이름>/`마다 `<이름>.md`를 둔다([틀](../../apps/mobile/docs/architecture/ui-catalog.md#새-부품-추가)).

## docs-check

| 검사          | 실패 조건                                                                           |
| ------------- | ----------------------------------------------------------------------------------- |
| `link`        | 상대 링크의 파일·폴더가 없다                                                        |
| `anchor`      | `#제목`이 대상 문서의 GitHub 제목 slug에 없다                                       |
| `path`        | 백틱 안 저장소 경로(`apps/`·`features/`·`app/`… 또는 `*.md`)가 없다(무시 파일 제외) |
| `limit`       | 줄 수 한도를 넘는다                                                                 |
| `agent-files` | 위 에이전트 파일 모양과 다르거나 루트+앱 `AGENTS.md`가 24KB를 넘는다                |
| `ui-doc`      | shared/ui 부품 문서가 없다                                                          |
| `allow-stale` | 허용 항목이 더는 걸리지 않는다                                                      |

- 출시 기록은 링크한 파일만 본다. changesets·`CHANGELOG.md`·heroui 스킬·스토어 메타데이터는 보지 않는다.
- 예외는 [docs-check.config.json](../../scripts/docs/docs-check.config.json)의 `allow`에 `reason`과 함께 둔다.
- 백틱 식별자가 코드에 있는지는 `node scripts/docs/docs-check.mjs --idents`로 릴리스 끝에 한 번 사람이 읽는다. 반례·외부 API가 섞여 실패로 보지 않는다.
