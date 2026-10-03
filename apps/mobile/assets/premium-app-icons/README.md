# 고양이 아이콘

기존 6개 선택 키와 순서를 유지하고 러시안 블루, 크림 고양이, 턱시도 고양이를 추가했다. 세 신규 이미지는 서비스의 기존 졸린 표정과 부드러운 3D 톤을 참고해 새로 생성한 디자인이며, 외부 이미지나 캐릭터 에셋을 가져오지 않았다.

| 파일 | 선택 키 | 배경 |
| --- | --- | --- |
| russian-blue.png | russian_blue | 연보라 |
| cream-cat.png | cream_cat | 연노랑 |
| tuxedo-cat.png | tuxedo_cat | 민트 |

앱 아이콘 원본은 모두 1024×1024 RGB PNG이며 투명도와 모서리 마스크를 포함하지 않는다. iOS·Android 런처가 플랫폼 규칙에 따라 모양을 적용한다. 프로필과 네이티브 앱 아이콘은 동일한 파일을 참조한다.

레지스트리는 `src/features/app-icon/presentations/constants/app-icons.constant.ts`, 네이티브 등록은 `app.config.ts`의 `expo-quick-actions` 플러그인이 담당한다. 네이티브 등록이 추가되므로 앱을 다시 빌드해야 한다. OTA 업데이트만으로 새 런처 아이콘을 추가하지 않는다.
