# Aido Mobile

Expo SDK 58 · React Native 0.88 · React 19(Compiler) · Expo Router · TanStack Query 5 · Zod 4 · react-hook-form · heroui-native · Uniwind. 앱·서버 공통 규칙은 [루트 AGENTS.md](../../AGENTS.md)가 원본이고, 이 파일은 앱의 입구다. 상세는 아래 문서에 있고 작업에 맞는 문서만 읽는다.

## 명령

- `pnpm dev`(Expo) · `pnpm ios` · `pnpm android`
- `pnpm check`(루트): 커밋 전 한 번 돌린다. 단계와 순서는 [루트 AGENTS](../../AGENTS.md#명령), 걸린 규칙은 [guardrails](docs/architecture/guardrails.md)다
- `pnpm --filter @aido/mobile test -- <경로>`: 바꾼 기능의 테스트만 돈다. `AIDO_TEST_WORKERS`로 worker를 줄인다
- `pnpm --filter @aido/mobile e2e:smoke`: Maestro E2E

## 무엇을 할 때 무엇을 읽나

| 작업                                                                       | 문서                                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기능 위치, 폴더 골격, 층·의존, DI                                          | [architecture/structure.md](docs/architecture/structure.md), 지금 걸린 lint 규칙 [guardrails.md](docs/architecture/guardrails.md)                         |
| 새 기능·화면·엔티티 추가 절차                                              | 스킬 `new-feature`(`.claude/skills/new-feature/SKILL.md`)                                                                                                 |
| 모델·Policy, mapper, 스키마, 서버와 공유, 파싱·null·호환                   | [architecture/model.md](docs/architecture/model.md)                                                                                                       |
| Api·service·repository·store, 저장 값, 쿼리 키·select·무효화, mutation, 폼 | [architecture/data.md](docs/architecture/data.md)                                                                                                         |
| 상태 원천, params 튜플, 라우팅·Link·시트                                   | [architecture/state-and-routing.md](docs/architecture/state-and-routing.md)                                                                               |
| 훅 규칙과 공용 훅 목록, `useStepper`                                       | [architecture/hooks.md](docs/architecture/hooks.md)                                                                                                       |
| 컴포넌트·스크린 패턴, 배치, CLS, 목록, 모션·Skia, 기기                     | [architecture/ui.md](docs/architecture/ui.md)                                                                                                             |
| 어떤 UI 부품을 쓰나(heroui-native·shared/ui)                               | [architecture/ui-catalog.md](docs/architecture/ui-catalog.md)                                                                                             |
| 아직 목표 모양이 아닌 코드                                                 | [architecture/migration-status.md](docs/architecture/migration-status.md)                                                                                 |
| 디자인 기준(Aido가 덮어쓰는 것, 안내 노출 규칙)                            | [DESIGN.md](DESIGN.md) → [design.md](docs/design.md)                                                                                                      |
| 테스트                                                                     | [testing.md](docs/testing.md)                                                                                                                             |
| 분석·로그·Sentry                                                           | [observability.md](docs/observability.md)                                                                                                                 |
| 날짜·시간대·언어·문구                                                      | [dates-and-i18n.md](docs/dates-and-i18n.md)                                                                                                               |
| 오류 처리                                                                  | [error-handling.md](docs/error-handling.md)                                                                                                               |
| 푸시 · 위젯 · 인증 · 댓글                                                  | [push-notifications.md](docs/push-notifications.md) · [widgets.md](docs/widgets.md) · [auth.md](docs/auth.md) · [todo-comments.md](docs/todo-comments.md) |
| 빌드·배포·EAS·스토어·환경 변수                                             | [build-and-release.md](docs/build-and-release.md), 새 기능 소개 [whats-new-release.md](docs/whats-new-release.md)                                         |
| 문서·rules·스킬 고치기                                                     | [문서 규칙](../../docs/conventions/docs.md)                                                                                                               |

## 꼭 지키는 규칙

끝의 링크가 그 규칙의 원본이다. 괄호 안 이름은 그 규칙을 막는 검사다.

- **사용성이 먼저다.** 입력칸과 저장 버튼은 키보드 위에 보이고, 키보드가 열린 채 첫 탭에 눌리고, 저장이 실패해도 글자가 남는다. 구조를 고치다 나빠지면 구조를 양보한다([ui](docs/architecture/ui.md#사용성-구조보다-먼저)).
- **같은 일은 한 가지 방법으로, 변경점은 한 곳이다.** 공용 부품·훅·도구가 있으면 그것을 쓰고, 없으면 만들기 전에 [ui-catalog](docs/architecture/ui-catalog.md)·[hooks](docs/architecture/hooks.md)를 확인한다. 라이브러리가 주는 것을 다시 만들지 않는다.
- **모델은 업무 규칙만 담는다.** 문구 키·색·배치·표시 방식은 view-model·컴포넌트로 보낸다. 모델은 계약을 import하지 않고 mapper가 바꾼다. Policy 첫 인자는 모델 전체다(`domain-model-contract`, `aido/policy-facade`, [model](docs/architecture/model.md#모델과-policy)).
- **데이터는 쓰는 컴포넌트가 조회한다.** 화면 id는 route 튜플 훅(`const [todoId] = useTodoId()`)으로 읽고, 컴포넌트는 바깥 여백을 모른다. 원본을 확장하면 `Omit<ComponentProps<typeof X>, …>`로 원본 Props를 유지한다(`aido/no-route-id-props`, [ui](docs/architecture/ui.md#컴포넌트-계약)).
- **스크린은 위에서 아래로 읽힌다.** 경계·`Suspense`·`Spacing`·화면 문구를 스크린에 나열한다. 위치만 말하는 이름(`*Section`, `*Detail`, `*Content`, `*Panel`)을 만들지 않는다(`aido/component-name`, [ui](docs/architecture/ui.md#스크린)).
- **부모 없이 의미 없는 조각은 `Parent.Part` 네임스페이스로 둔다.** 반복 고정 UI는 역할이 드러나는 컴포넌트로 추상화하고 항목마다 한 줄씩 쓴다(설정 배열 map 금지, [ui](docs/architecture/ui.md#네임스페이스반복-ui추출)).
- **상태 원천은 하나다.** 서버는 Query, URL은 params 튜플, 기기 값은 `useStoredValue`, 폼은 RHF다. 라이브러리가 주는 `isPending`·`error`를 다시 만들지 않는다([state-and-routing](docs/architecture/state-and-routing.md#상태-원천)).
- **캐시는 cache helper만 만진다.** mutation은 `onSuccess`에서 응답을 쓰고 `onSettled`에서 무효화한다. 오류 피드백은 `meta.errorFeedback` 하나로 한다(`aido/query-client-location`, `aido/mutation-error-feedback`, [data](docs/architecture/data.md#무효화), [오류 처리](docs/error-handling.md#mutation-오류-피드백)).
- **SDK는 `shared/infra`에서만 import한다.** 기능은 `di-context` 훅으로 포트·Api·서비스를 꺼낸다. 테스트는 포트 stub으로 하고 `jest.mock`은 어댑터 테스트에만 쓴다(`sdk-outside-infra`, `aido/no-jest-module-mock`, [structure](docs/architecture/structure.md#di포트수명)).
- **타입 안전 100%다.** `as`(`as const` 제외)·`any`·`!`·`@ts-*`를 쓰지 않는다. 유니온은 `match().exhaustive()`, 표는 `satisfies Record<…>`다. null·undefined는 [nullish](../../docs/conventions/nullish.md#6-클라이언트-모바일) 표를 따른다.
- **메모리와 프레임.** 구독·타이머·Skia 네이티브 객체는 만든 곳에서 정리한다. 애니메이션은 화면 밖·앱 뒤·모션 줄이기에서 멈춘다([data](docs/architecture/data.md#메모리와-수명), [ui](docs/architecture/ui.md#모션과-skia)).
- **문구는 ko·en 카탈로그에 함께 넣는다.** 해요체이고 앱 이름은 "아이두"/"Aido"다. 1.15.2 앱은 옛 서버·옛 앱 분기를 두지 않는다([날짜·언어](docs/dates-and-i18n.md#문구-톤과-용어), [호환](../../docs/conventions/compatibility.md)).
- **테스트는 중요한 로직만 쓴다.** 대상은 모델·Policy, 비자명한 mapper, 캐시·롤백, 핵심 흐름, 버그 재현이다. 표시·배치 테스트는 쓰지 않는다([testing](docs/testing.md#도구와-범위)).

## 디자인

Follow [DESIGN.md](./DESIGN.md) for all visual and interaction decisions. Aido가 덮어쓰는 값(테마 토큰, 주황 역할, 글꼴 5단계, 일러스트 톤)은 [docs/design.md](docs/design.md)에 있다. UI는 heroui-native → `shared/ui` → React Native 순서로 고른다.

<!-- HEROUI-NATIVE-AGENTS-MD-START -->

[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|components/(buttons):{button.mdx,close-button.mdx,link-button.mdx}|components/(collections):{menu.mdx,tag-group.mdx}|components/(controls):{slider.mdx,switch.mdx}|components/(data-display):{chip.mdx}|components/(feedback):{alert.mdx,skeleton-group.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox.mdx,control-field.mdx,description.mdx,field-error.mdx,input-group.mdx,input-otp.mdx,input.mdx,label.mdx,radio-group.mdx,search-field.mdx,select.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx}|components/(media):{avatar.mdx}|components/(navigation):{accordion.mdx,list-group.mdx,tabs.mdx}|components/(overlays):{bottom-sheet.mdx,dialog.mdx,popover.mdx,toast.mdx}|components/(typography):{text.mdx}|components/(utilities):{pressable-feedback.mdx,scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,portal.mdx,provider.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{design-principles.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,design-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{beta-10.mdx,beta-11.mdx,beta-12.mdx,beta-13.mdx,cli-v1-0-0.mdx,rc-1.mdx,rc-2.mdx,rc-3.mdx,rc-4.mdx,v1-0-0.mdx,v1-0-1.mdx,v1-0-10.mdx,v1-0-11.mdx,v1-0-2.mdx,v1-0-3.mdx,v1-0-4.mdx,v1-0-5.mdx,v1-0-6.mdx,v1-0-7.mdx,v1-0-8.mdx,v1-0-9.mdx}
<!-- HEROUI-NATIVE-AGENTS-MD-END -->
