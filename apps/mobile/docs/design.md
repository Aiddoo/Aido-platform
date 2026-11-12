# Aido 디자인: DESIGN.md 위에 덮어쓰는 것

시각·상호작용 결정은 [DESIGN.md](../DESIGN.md)(HeroUI Native 기본 테마)를 따른다. 이 파일은 Aido가 그것과 다르게 두는 것만 적고, 둘이 다르면 이 파일이 먼저다. 토큰 값의 정본은 `global.css`다. 부품 고르기는 [ui-catalog](./architecture/ui-catalog.md), 화면 규칙은 [ui](./architecture/ui.md)를 본다.

- 리팩터는 화면 모양을 바꾸지 않는다. 부품을 바꾸면 전후 스크린샷을 겹쳐 비교한다.

## 테마 토큰

heroui 기본은 푸른 회색(hue 286)과 파란 accent다. Aido는 무채색 회색과 주황이라 앱 화면에 그려지는 heroui 변수를 `global.css`의 `light`·`dark`에서 앱 값으로 덮는다.

| heroui 변수                                                     | 라이트                 | 다크                   | 그려지는 곳                                                                              |
| --------------------------------------------------------------- | ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `--background`·`--foreground`·`--surface`·`--muted`·`--default` | 무채색 앱 값           | 무채색 앱 값           | 화면·글자·카드 면, `Tabs` 바탕, 꺼진 Switch                                              |
| `--accent`·`--danger`·`--warning`·`--success`                   | 앱 주황·빨강·노랑·초록 | 라이트와 같다          | 컨트롤 선택·파괴 동작·주의·완료                                                          |
| `--separator`                                                   | `--gray-5`             | `--gray-2`             | `Separator` 기본색, InputOTP 가운데 줄(50%)                                              |
| `--border`                                                      | `--gray-4`             | `--gray-2`             | `HintPopover` 테두리·화살표, 팝오버 안 `bg-border` 줄(`plan-review`·`quick-voice-quota`) |
| `--overlay`                                                     | heroui 기본(`--white`) | `--gray-1`(전 #18181b) | `ConfirmDialog`·`HintPopover` 면. 시트 면(`bg-white dark:bg-gray-1`)과 같다              |
| `--field-background`                                            | heroui 기본(`--white`) | `--gray-1`(전 #18181b) | Checkbox 안쪽, InputOTP 칸                                                               |
| `--segment`                                                     | heroui 기본(`--white`) | `--gray-2`(전 #46464c) | primary `Tabs`의 선택 알약                                                               |

선 색의 전후와 대비다. 화면은 `bg-white`(다크 #121212), 면은 카드·메뉴의 `gray-1`이다.

| 변수          | 테마   | heroui 기본 → Aido           | 화면 위       | `gray-1` 면 위 |
| ------------- | ------ | ---------------------------- | ------------- | -------------- |
| `--separator` | 라이트 | #aaaaad → `--gray-5` #bdbdbd | 2.32 → 1.88:1 | 2.18 → 1.77:1  |
| `--separator` | 다크   | #47474b → `--gray-2` #424242 | 2.03 → 1.86:1 | 1.74 → 1.60:1  |
| `--border`    | 라이트 | #dedee0 → `--gray-4` #dedede | 1.34 → 1.35:1 | 1.27 → 1.27:1  |
| `--border`    | 다크   | #28282c → `--gray-2` #424242 | 1.28 → 1.86:1 | 1.10 → 1.60:1  |

- 구분선은 iOS 불투명 구분선(라이트 #c6c6c8, 다크 #38383a)에 가장 가까운 앱 회색이다. 화면과 `gray-1` 면(댓글 ⋯ 메뉴 등) 위에서 모두 1.5:1 이상으로 보이고 조용하다. 직접 색을 준 실선(`gray-2`·`gray-3`)은 디자인 톤을 지키려고 옮기지 않는다([migration-status](./architecture/migration-status.md#1152에서-바꾸지-않기로-한-것)).
- 테두리는 heroui 기본과 같은 밝기에서 푸른 기만 뺐다. 다크는 시트·메뉴 면(`--gray-1`) 위에서 보이도록 구분선과 같은 `--gray-2`다.
- InputOTP 가운데 줄(구분선 50%)은 라이트 #d4d4d6 → #dedede(`--gray-4`와 같다), 다크 #2d2d2f → #2a2a2a라 덮지 않는다.
- 나머지 heroui 변수는 기본값이다. 무채색(`--snow`·`--backdrop`·그림자), 위 값을 따르는 것(`--focus`·`--field-placeholder`·대부분의 `*-foreground`), 거의 검정인 글자(라이트 `--default-foreground` #18181b), 앱에 그려지지 않는 것(`--surface-secondary`·`--surface-tertiary`·`--field-foreground`·`--field-border`)이다. 그려지기 시작하면 이 표에 먼저 더한다.
- 매핑을 바꾸면 라이트·다크 스크린샷으로 Switch, Checkbox, Radio, Spinner, Chip soft, Tabs, Menu·Popover, InputOTP, 구분선을 확인한다.
- 앱 토큰은 `@theme inline`에 있다: `main`, `secondary`, `error`, `error-light`, `success`, `info`, `warning-text`, `highlight`, `white`, `gray-1`~`gray-10`, `on-sky`.

### 주황 두 가지

| 토큰       | 값      | 역할                                                                                                       |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `--main`   | #FF6843 | 브랜드 채움: 주 버튼 면, 강조 아이콘, 일러스트 포인트, 입력 초점 테두리                                    |
| `--accent` | #F0503D | heroui 컨트롤의 선택·초점: Switch 켬, Checkbox·Radio 선택, `Tabs` 밑줄, InputOTP 초점 칸, Spinner, soft 칩 |

- accent가 더 진한 이유는 대비다. 흰 화면 위 컨트롤 면이 accent 3.55:1로 WCAG 비텍스트 기준 3:1을 넘고 main은 2.87:1이다. 선택 표시 위 흰 체크·점(`--accent-foreground`)은 3.46:1이다.
- soft accent 칩 글자는 `text-accent-soft-foreground`다. 칩 면 위에서 라이트는 흰 면 3.84:1·`gray-1` 3.63:1·`gray-2` 3.55:1로 작은 글자 4.5:1에 못 미치고, 다크는 화면 5.54:1·`gray-1` 4.70:1·`gray-2` 3.08:1이다. `text-main`은 같은 면에서 라이트 2.21~2.39:1이라 쓰지 않는다.

## 회색·면·모양

- **`gray-*` 토큰을 쓴다.** DESIGN.md는 날 회색 팔레트를 막지만, Aido의 `gray-1`~`gray-10`은 다크에서 순서가 뒤집히는 의미 토큰이다(라이트 `gray-1`이 가장 밝고 다크 `gray-1`이 가장 어두운 면).
- 화면은 `bg-white`(다크에서 어두운 배경), 카드는 `bg-gray-1`이다. 시트 면이 `bg-white dark:bg-gray-1`이라 시트 안 카드는 `dark:bg-gray-2`를 함께 쓴다. 날씨 화면만 하늘 장면을 배경으로 두고 그 위 글자·면은 `on-sky`다.
- 카드는 그림자 없이 면 색으로 나눈다(`SurfaceCard`의 `rounded-2xl`, 그림자 없음). DESIGN.md의 `shadow-surface`를 쓰지 않는다. 예외는 알림함의 안 읽은 알림 줄(heroui `Card`, [ui-catalog](./architecture/ui-catalog.md))이다. 시트 모서리는 `SHEET_RADIUS`(32)다.
- **비활성은 `opacity-40`이다**(`disabled:opacity-40`). DESIGN.md 기본 0.5보다 흐리다. 비활성 컨트롤은 누를 수 없다.

## 글꼴

- 글꼴은 Wanted Sans 네 굵기(`--font-normal`·`medium`·`semibold`·`bold`)다.
- 크기 토큰은 11단계다: `display` 96(날씨 큰 온도 전용), `h1` 30, `t1` 28, `t2` 22, `t3` 20, `b1` 17, `b2` 16, `b3` 15, `b4` 13, `e1` 12, `e2` 11. 최소는 `e2`(11pt)다.
- **앱 글꼴 5단계만 쓴다**(`xsmall`·`small`·`medium`·`large`·`xlarge`, 기본 `medium`). DESIGN.md와 달리 OS 배율은 끈다(`allowFontScaling: false`). 글자·아이콘·스켈레톤·입력이 앱 설정 하나로 같이 커진다. 사용자 결정이다. 아이콘만 있는 버튼의 누름 칸 규칙은 [ui](./architecture/ui.md#글꼴과-기기)에 있다.
- Android는 자간을 0으로 둔다. 음수 자간이면 줄바꿈 폭이 커져 마지막 글자가 다음 줄로 밀려 사라진다(QA #27).
- 바뀌는 숫자(카운터·가격·시간)는 `tabular-nums`다.

## 간격

값은 px다. 레이아웃 prop(`gap={8}`)과 `<Spacing size>`는 그 숫자이고, 클래스는 한 단계가 4px다(`gap-2` = 8).

규격은 Tailwind의 이름 붙은 간격 단계다(`aido/spacing-scale`). 레이아웃 prop과 `<Spacing size>`의 숫자가 이 안이어야 한다.

| 단계        | 값(px)                                            | 쓰는 곳                                                                                                            |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 컴포넌트 안 | 0·1·2·4·6                                         | 한 덩어리 안. 글줄 사이 2(`gap={2}` 49곳, 대부분 `VStack`의 제목·보조 글), 아이콘·글자·칩 안쪽 4~6(`gap={6}` 38곳) |
| 구역        | 8·10·12·14·16·20·24·28·32·36·40·44·48·56·64·80·96 | 스크린 구역 사이 `<Spacing>`, 카드·행 안쪽 여백, 목록 행 사이                                                      |

- **컴포넌트는 바깥 여백을 모른다.** 자기 바깥에 `m*`를 두지 않고, 사이 간격은 부모의 `gap`·`<Spacing>`이 정한다.
- **className이 있는 태그는 여백도 className이다**(`aido/spacing-props-with-classname`). `gap`·`flex` prop은 이 판정에서 뺀다.
- **형제끼리는 한 표기다.** 같은 부모 아래 자식들은 여백을 레이아웃 prop(`gap={8}`·`px={16}`)과 클래스(`gap-2`·`px-4`) 중 하나로 맞춘다(`aido/one-spacing-notation`). 부모와 자식, 다른 부모 아래는 달라도 된다. heroui 부품과 `*ClassName` 슬롯은 prop이 없어 세지 않는다.
- **임의 픽셀 클래스를 쓰지 않는다**(`aido/no-arbitrary-spacing-class`). `px-[18px]` 대신 같은 값 토큰을 쓴다. Tailwind v4(Uniwind)는 0.25단계(1px)까지 만든다: 18px → `px-4.5`, 9px → `mt-2.25`, 22px → `pt-5.5`. 클래스 쪽 값은 규격 검사 밖이라 같은 값이면 규격 밖 단계(`px-4.5`)도 된다.
- 규격 밖 값이 꼭 필요하면 아래 표에 이유를 남기고 그 줄 위(prop이 여러 줄이면 그 prop 위)에 `// oxlint-disable-next-line aido/spacing-scale -- <이유>`를 둔다.

### 규격 밖 예외

크기에 맞춘 값은 맞춘 상수에서 유도하고, 나머지는 값을 그대로 두고 지시문에 이유를 적는다. 수는 테스트를 뺀 `src`·`app`이다.

| 값(px)                     | 자리 | 이유                                                                                             |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| `gap` 3                    | 3곳  | 댓글 항목·알림 행(불러오는 모양 포함)의 제목·본문 글줄 간격. 2와 4 사이에서 시안에 맞춘 값       |
| `gap` 5                    | 3곳  | 날씨 예보 요일 줄(2곳)·날씨 머리의 위치 줄에서 아이콘과 글자 사이. 4와 6 사이에서 시안에 맞춘 값 |
| `py` 18                    | 2곳  | 댓글 화면에서 할 일 상세 머리의 세로 여백(불러오는 모양 포함). 16과 20 사이에서 시안에 맞춘 값   |
| `Spacing` 60               | 1곳  | 이메일 로그인에서 제목과 입력 사이. 이 화면 전용 구역                                            |
| `gap` 22                   | 1곳  | 초대 발자국 판의 불러오는 줄 간격. 불러온 판의 세로 연결선 높이(`h-[22px]`)와 맞춘다             |
| `Spacing` 50               | 1곳  | 시간별 예보 불러오는 칸이 아이콘 칸 높이(`CELL_ICON_HEIGHT`)와 같은 자리를 잡는다                |
| `-ml-[7.5px]`(임의 클래스) | 1곳  | 날씨 현재 시각 점(`size-[15px]`)의 가운데를 맞추는 절반 값. 1px 단위 토큰으로 나타낼 수 없다     |

## 일러스트와 캐릭터

- **빈·처음·오류 그림은 영수증 톤이다.** 기준은 `assets/icons/ic_docs.svg`이고 부품은 `src/shared/ui/illustration`이다.
  - 몸통은 연회색 `#EFEFEF` 하나이고 다크에서도 그대로 밝다. 코랄 포인트(`main`)는 덮개·배지·안쪽 줄에만 쓴다.
  - 테두리 선이 없고 72 그리드다. 오류도 같은 톤에 코랄 배지(느낌표)로 그린다.
  - 점선 카드(`border-dashed` + `bg-gray-1`)를 살린다.
  - 원 안 선 아이콘으로 바꾸지 않는다. 선 아이콘(1.8px)은 버튼·목록용이고 빈 상태 대표 그림이 아니다.
- **고양이 캐릭터·앱 아이콘은 부드러운 3D 렌더 톤이다**(`assets/images/ido_cat_hi.webp`, `assets/premium-app-icons/`). 손으로 그린 평면 SVG로 다시 그리지 않는다. 새 구도가 필요하면 기존 렌더를 다시 배치하거나 같은 톤의 렌더를 만든다. 화면에서는 `Mascot`으로 쓴다.
- 장식은 한 장면에 눈에 띄는 움직임 하나다. 모션 규칙은 [ui](./architecture/ui.md#모션과-skia)에 있다.

## 문구

- 해요체로 쓴다. 앱 이름은 한국어 "아이두", 영어 "Aido"다. ko·en 카탈로그에 함께 넣는다([dates-and-i18n](./dates-and-i18n.md)).
- 기본 카테고리 이름 "할 일"은 언어와 무관하게 그대로 두는 의도된 값이다.

## 색을 직접 쓰는 예외

그 밖에서는 hex·`white`·`black` 같은 날값을 쓰지 않고 토큰 클래스를 쓴다.

| 곳          | 파일                                                                                               | 이유                                                            |
| ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 날씨 장면   | `src/features/weather/constants/weather-scene-palette.constants.ts`, `weather-colors.constants.ts` | 하늘은 테마와 별개인 장면 색이고 라이트·다크 팔레트를 따로 둔다 |
| 위젯        | `src/features/device/widget/constants/widget.constants.ts`                                         | 네이티브 위젯은 CSS 변수를 읽지 못한다                          |
| 카테고리 색 | `src/features/planning/category/constants/todo-category.constants.ts`(`CATEGORY_COLORS`)           | 사용자가 고른 값이 서버에 저장되는 데이터다                     |
| 소셜 로그인 | `global.css`의 `--color-kakao`·`--color-naver`·`--color-apple-button`                              | 공급자 브랜드 지침                                              |

## 모션 값

Reanimated의 `duration`·`delay`는 `ANIMATION` 상수(`shared/constants/animation.ts`)만 쓴다. 숫자를 파일마다 적지 않는다.

| 상수                                          | 값               | 쓰는 곳                                   |
| --------------------------------------------- | ---------------- | ----------------------------------------- |
| `ANIMATION.durationMs.fast`                   | 150ms            | 빠른 전환                                 |
| `ANIMATION.durationMs.normal`                 | 200ms            | 일반 전환                                 |
| `ANIMATION.durationMs.slow`                   | 300ms            | 느린 전환                                 |
| `ANIMATION.durationMs.emphasis`               | 600ms            | 한 번 눈길을 끄는 강조(새 알림 종 흔들기) |
| `ANIMATION.delayMs.short` / `medium` / `long` | 50 / 100 / 200ms | 지연                                      |

## 한도·프리미엄·AI 안내

- **한도·잠금 안내는 `useEntitlementGate(feature, { surface })` 하나다.** 기능에서는 `promptIfBlocked`·`promptIfBlockedError`만 부른다.
  - 게이트가 `useOpenSheet`로 `PremiumUpsell`(+ `PremiumUpsell.Actions` footer)을 띄운다. 시트는 서버 스냅샷에서 사용량 막대(`Meter`), 다시 생기는 날, "무료 → 프리미엄" 숫자를 읽는다.
  - 버튼은 [프리미엄 보기]와 글자 버튼 [나중에]다. 무료 대안(친구 초대, 지금까지 정리하기)이 있으면 대안이 주 버튼이고 [프리미엄 보기]가 글자 버튼이다.
- 같은 기능을 그날 [나중에]로 닫았으면 그다음부터는 시트 대신 "프리미엄 보기" 행동이 붙은 토스트로 알린다. 판단은 `getUpsellPresentation`(`billing/subscription/utils/upsell.view-model.ts`), 기록은 업셀 저장 값(`upsellDismissalStoredValue`)이다.
- 기능 화면은 시트를 직접 그리지 않는다. 기능별 한도 다이얼로그나 인라인 한도 배너를 새로 만들지 않는다. 앱 실행·홈·할 일 완료 축하에서는 권하지 않는다.
- **AI 기능 표시.**
  - AI를 쓰는 실행 지점에는 `AiFilledIcon`을 두고, 횟수를 쓰면 남은 횟수를 함께 보인다. 문구는 `useQuotaStatus`(글자), `QuotaChip`(알약)에서 가져온다.
  - 쓸 때마다 묻는 다이얼로그는 두지 않는다. 처음 한 번 AI 동의를 받고, 횟수를 다 쓰면 위 게이트만 띄운다. 실패해서 차감되지 않으면 그 자리에서 알린다.
  - 프리미엄·관리자에게는 남은 횟수를 보이지 않는다. 전체 횟수는 내 정보의 요약 카드에서 본다.

## 안내 노출 규칙

닫으면 다시 띄우지 않고, 다시 물을 이유가 있을 때만 기간을 둔다.

| 안내                                                                            | 끝나는 순간                                                                  | 다시 보이는가       | 기억 범위     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------- | ------------- |
| 코치마크(재정렬, 친구 줄, 더블탭, 음성 시작·표시·핵심, 반복 범위, AI 동의 갱신) | 보이면 끝나는 것은 보인 순간(`claim`), 써야 끝나는 것은 쓰거나 X(`complete`) | 다시 안 뜬다        | 계정          |
| 새 기능(whats-new)                                                              | 끝까지 보거나 닫음                                                           | 캠페인마다 한 번    | 계정 × 캠페인 |
| 피드 푸시 꺼짐 안내                                                             | X                                                                            | 14일 뒤             | 계정          |
| 마케팅 푸시 시트                                                                | 닫음                                                                         | 90일 뒤             | 계정          |
| 업셀                                                                            | 닫음                                                                         | 그날은 토스트로만   | 계정 × 기능   |
| 할 일 다 함 배너, 발자국 축하                                                   | 닫음 / 축하함                                                                | 다음 날 / 다음 단계 | 계정          |
| 기기 음성 모델 제안                                                             | 거절                                                                         | 다시 안 뜬다        | 계정 × 언어   |
| 스토어 리뷰                                                                     | 요청함                                                                       | OS 정책 + 앱 간격   | 계정          |

- 스쳐 지나간 코치마크는 본 것으로 세지 않는다.
- 기간 규칙은 각 Policy의 `shouldShow*(record, now)`에 두고 상수 이름에 단위를 넣는다(`PUSH_PROMPT_SNOOZE_DAYS`).
- 기록은 계정 범위 저장 값(`useStoredValue(def, accountId)`)이다. 키 이름과 정의는 [data](./architecture/data.md)를 본다.
- 이벤트는 `{entity}_shown`·`{entity}_dismissed`로 맞춘다.
