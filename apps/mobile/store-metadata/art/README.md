# 스토어 아트 생성기

App Store·Google Play 이미지(스크린샷, 제품 페이지 헤더·검색 결과, Play 그래픽 이미지, 인앱 이벤트 미디어)를
한·영으로 같은 규칙에 따라 다시 만들어요. 문구·순서·캡처 연결은 [`storyboard.mjs`](storyboard.mjs) 한 파일에 있어요.

```sh
pnpm --filter @aido/mobile store:art captures                        # 필요한 캡처 목록과 빠진 파일
pnpm --filter @aido/mobile store:art --out <폴더> --preview            # 없는 캡처는 자리표시로 미리보기
pnpm --filter @aido/mobile store:art --out <폴더>                      # 최종본(캡처가 하나라도 없으면 멈춤)
pnpm --filter @aido/mobile store:art --out <폴더> --only scenes        # 캡처가 필요 없는 배너·이벤트만
pnpm --filter @aido/mobile store:art todo --out <업로드 폴더>          # 캡처 전 폴더별 TODO.md
pnpm --filter @aido/mobile store:art asset-names --out <파일.md>      # App Store 에셋 라이브러리 이름표
pnpm --filter @aido/mobile test:store-art
```

옵션: `--captures <캡처 루트>`(기본 `~/Desktop/Aido-Screens-1.13.0`), `--only <scenes|screenshots|세트 id|대상 id>`,
`--locales ko,en`. 결과 폴더에 `index.html`(스토리보드 + 갤러리, 360px 썸네일)과 `manifest.json`을 써요.

필요한 것: Google Chrome(또는 `CHROME_PATH`), Node 24. 브라우저 자동화는 Node 내장 WebSocket으로 DevTools
프로토콜을 직접 써서 Playwright 같은 의존성이 없어요. 같은 Chrome이면 같은 입력에서 같은 PNG가 나와요.

## 캡처 연결

장면마다 `capture: { file, plan, theme }`이 있고, 경로는 `maestro/screenshots-1.13.0/capture.sh` 결과 규칙을 따라요.

```
<캡처 루트>/<기기>/<일반|프리미엄>/<라이트|다크>[/en]/<NN_화면명>.png
```

| 출력 대상          | 크기(px)  | 기기 폴더                                      | 틀                     |
| ------------------ | --------- | ---------------------------------------------- | ---------------------- |
| `iphone-6.3`       | 1206×2622 | `iPhone 17 Pro`                                | iPhone(Dynamic Island) |
| `iphone-6.9`       | 1320×2868 | `iPhone 6.9 원본`(없으면 `iPhone 17 Pro`)      | iPhone                 |
| `iphone-duo`       | 2007×2853 | `iPhone Duo 펼침`(+ `iPhone Duo 접힘` 쌍 배치) | Duo 펼침·접힘          |
| `iphone-duo-outer` | 1398×2034 | `iPhone Duo 접힘`                              | Duo 접힘               |
| `ipad-13`          | 2064×2752 | `iPad Pro 13`                                  | iPad                   |
| `play-phone`       | 1080×1920 | `iPhone 17 Pro`(OS 막대·키보드 잘라 냄)        | 틀 없이 화면 카드      |
| `play-tablet-7`    | 1920×1080 | `iPad Pro 13` 두 장(문구 없음)                 | 화면 카드 두 장        |
| `play-tablet-10`   | 2560×1440 | `iPad Pro 13` 두 장(문구 없음)                 | 화면 카드 두 장        |

Google Play는 Android 캡처 없이 iOS 캡처를 **틀 없는 화면 카드**로 써요. 다른 회사 기기 틀에 넣지 않고,
`CAPTURE_DEVICES`(storyboard)의 높이만큼 상태 막대·홈 인디케이터를, `KEYBOARD_SCREENS` 화면은 키보드 윗선 아래를 잘라 내요.
iOS 홈 화면 위젯은 Play에 쓰지 않고, 태블릿은 장면의 `capture`와 `tabletPair`를 나란히 둬요.
Play 문구는 장면의 `play` 문구를 먼저 쓰고, 보상 일수 같은 혜택 표현을 넣지 않아요(`slotCopy`).
`captures` 명령이 장면별로 빠진 파일을 보여줘요.

`W1_홈_화면_위젯.png` 찍는 법: 프리미엄 데모 계정으로 오늘 할 일(일부 완료)을 채운 뒤 앱을 한 번 열어 위젯을 갱신하고,
다른 앱 아이콘·위젯이 없는 홈 화면 페이지에 둬요. 휴대전화(iPhone 17 Pro·Duo 접힘·Android 폰)는 작은+중간(Android 2×2+4×2),
큰 화면(Duo 펼침·iPad·Android 폴드 펼침)은 중간+큰(Android 4×2+4×4) 위젯이에요. 기기 언어를 ko·en으로 바꿔 각각 찍고,
`라이트/`는 기본 세트, `다크/`는 큰 화면 CPP의 `large-widgets`가 써요. iOS 상태 막대는 `xcrun simctl status_bar … override --time 9:41`로 맞춰요. 캡처 비율이 틀과 3% 넘게 다르면 잘라내지 않고 여백을 둬요.

## 규칙

- **크기·형식**: 결과는 정확한 픽셀 크기의 알파 없는 sRGB PNG예요. 렌더가 크기·알파·용량(스크린샷 8MB, Play 그래픽 1MB)을 확인해요.
- **대비**: 문구 요소에 `data-contrast`를 달고, 렌더 뒤 실제 계산 색으로 WCAG 대비율을 재요. 태그라인·보조 문구 4.5:1,
  헤드라인(큰 글자) 3:1 미만이면 실패해요. 그래서 태그라인은 브랜드 주황(#ff6b43, 회색 바탕 2.6:1) 대신 #c2410c(4.8:1)를 써요.
- **문구**: 태그라인 짧게(ko 14자 안팎), 헤드라인 두 줄, 해요체·sentence case. 앱이 실제로 하는 일만 써요.
  App Store 초대 장면에만 `NEW` 배지를 달고, Play 이미지에는 "New·Free·Best" 같은 표현을 쓰지 않아요(Play 가이드).
- **글자 없는 이미지**: 인앱 이벤트 카드·상세와 Play 맞춤 등록정보 그래픽은 글자·로고 없이 고양이·발자국·생선·뼈다귀로만 보여줘요.
- **글꼴**: 배너 헤드라인 Jua, 손글씨 태그라인 나눔손글씨 펜(`fonts/*-subset.woff2`, OFL), 스크린샷 문구는 앱과 같은 Wanted Sans
  (`apps/mobile/assets/fonts`). 배너 문구를 바꾸면 `node store-metadata/art/fonts/subset.mjs`로 서브셋을 다시 만들어요
  (원본은 google/fonts 고정 커밋에서 받아 sha256 확인, `uvx fonttools` 사용). 렌더는 서브셋에 없는 글자가 있으면 실패해요.
- **에셋**: 고양이 `assets/images/ido_cat_hi.webp`, 친구 고양이 `assets/premium-app-icons/orange-tabby.png`, 아바타 `images/cat-*.webp`
  (랜딩 `public/app-assets`와 같은 파일).

## 업로드 폴더

```
<업로드>/app-store/<ko|en>/<세트>/<대상>/NN_장면.png      세트: main, cpp-invite, cpp-ai, cpp-large, ppo-invite-first(ko). 대상에 iphone-duo-outer 포함
<업로드>/app-store/<ko|en>/graphics/header_3840x1646.png, search-result_3840x2560.png
<업로드>/app-store/shared/graphics/event-card_3840x2160.png, event-detail_2160x3840.png
<업로드>/google-play/<ko-KR|en-US>/<세트>/<phone_1080x1920|tablet-7_1920x1080|tablet-10_2560x1440>/NN_장면.png   세트: main, custom-listing-invite, experiment-invite-first(ko)
<업로드>/google-play/<ko-KR|en-US>/graphics/feature-graphic_1024x500.png
<업로드>/google-play/shared/graphics/feature-graphic-invite_1024x500.png, promotional-content_1920x1080.jpg(보관용)
```

## 출처

- Apple: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications),
  [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)
- Google: [Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- WCAG 2.2 [Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
