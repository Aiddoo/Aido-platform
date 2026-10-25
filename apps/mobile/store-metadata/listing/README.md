# 스토어 등록 정보

App Store·Google Play 등록 정보의 단일 원본이에요. 한국어와 영어를 같이 고쳐요.
파일을 바꿔도 스토어에 자동으로 올라가지 않아요. 콘솔에 붙여 넣는 건 사람이 해요.

```sh
pnpm --filter @aido/mobile store:check                  # 글자 수·키워드·용어·ko/en 짝 검사
pnpm --filter @aido/mobile store:export --out <폴더>    # <폴더>/text/…txt + 검토용 *.ko-en.md
pnpm --filter @aido/mobile test:store-listing
```

## 구조

`listing/<store>/<locale>/<field>.txt` — 필드 이름은 fastlane deliver·supply를 따라요.

| 스토어      | 로캘             | 필드                                                                                                                |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| App Store   | `ko`, `en-US`    | `name`(30) `subtitle`(30) `promotional_text`(170) `description`(4000) `keywords`(100) `release_notes`(4000) `*_url` |
| App Store   | `en-GB`          | `keywords`만. 나머지는 `en-US`를 물려받아요                                                                         |
| Google Play | `ko-KR`, `en-US` | `title`(30) `short_description`(80) `full_description`(4000) `release_notes`(500)                                   |

- `release_notes`는 요약 한 줄 + `../<버전>/release.json`의 항목 그대로예요. 두 스토어 문안이 같아야 해요.
- App Store 설명과 Play 설명은 구독 안내(결제 계정·관리 경로)와 큰 화면 한 줄만 달라요.

## 문구 규칙

- 브랜드: 한국어 문구는 **아이두**, 영어는 **Aido**. 유료 기능은 앱 화면과 같은 **프리미엄 / Premium**(“Pro” 금지).
- 용어: 친구 초대·초대 링크·초대 코드·발자국(‘발자국 모으기’)·친구 자리·콕 찌르기 / invite link·invite code·paw prints
  (“Collect paw prints”)·friend slot·nudge·to-do.
- 한국어 설명은 해요체, 항목은 명사형으로 끝내요. 영어 제목은 sentence case.
- 초대 보상 조건은 앱과 같게 써요: 가입한 지 7일 안의 친구가 수락하면 프리미엄 7일, 친구가 가입하고 14일 안에
  할 일을 끝낸 날이 이틀이 되면 초대한 사람도 프리미엄 7일 + 친구 자리 1개, 구독 중 받은 보상은 구독이 끝난 뒤 시작.
- Play 앱 이름·간단한 설명에는 순위·가격·기간 한정 표현(최고, 1위, 무료, 신규, best, free, new…)을 쓰지 않아요.

## 키워드

App Store는 이름·부제·키워드를 함께 검색해요. 이름·부제에 있는 단어는 키워드에 다시 넣지 않고, 각 키워드는
세 글자 이상으로 써요(Apple 규칙이자 맞춤형 제품 페이지에 배정할 수 있는 조건).

- `ko`: 기존 조합(할일관리·투두리스트·체크리스트·캘린더·리마인더·작심삼일·콕찌르기)을 유지하고, 두 글자 단어는
  검색어 형태를 살려 늘렸어요(습관→습관만들기, 루틴→루틴관리, 일정→일정관리, 위젯→홈위젯, 갓생→갓생살기).
  1.13.0 초대(친구초대·초대코드·초대링크)와 맞춤형 제품 페이지용 단어(AI할일·음성입력·자동일정·폴더블·친구피드)를 더했어요.
  Apple 문서는 100바이트라고 하지만 App Store Connect는 한글 100자를 받아 왔어요(1.12.1). `store:check`는 글자 수(100자)로 막아요.
- `en-US`: 이름(Aido, AI, To-do, Planner)·부제(friends, done)에 없는 검색어 — `todo` 표기, `list`, `task`, `checklist`,
  `habit`, `routine`, `reminder`, `widget`, `social`과 맞춤형 제품 페이지용 `invite`, `voice`, `schedule`, `ipad`, `feed`.
- `en-GB`: 한국 스토어(KOR)의 추가 언어이자 영국·호주 스토어 언어예요. `en-US`와 겹치지 않는 두 번째 조합을 둬요.
- [`app-store/custom-product-pages.json`](app-store/custom-product-pages.json): 맞춤형 제품 페이지별 키워드. Apple은 최근 승인
  버전의 키워드 필드에 있는 단어만 배정하게 해서, `store:check`가 키워드 필드에 있는지·페이지끼리 겹치지 않는지 확인해요.
