# 1.17.0 스토어 문구 메모

**상태: 출시 노트는 저장소에 있고, 스토어 콘솔에는 올리지 않았다.** 원본은 [release.json](../../../apps/mobile/store-metadata/1.17.0/release.json)이고 `listing/**/release_notes.txt`와 `- ` 목록이 같은 순서다. 둘 다 `pnpm --filter @aido/mobile store:check`가 확인한다(통과, 글자 수는 App Store ko 626자·en-US 1,201자·en-GB 1,200자로 4,000자 안, Play ko 206자·en 372자로 500자 안).

## 규칙

- 절은 `새로운 기능`·`개선`·`버그 수정`(en `New`·`Improvements`·`Bug fixes`) 순서다. App Store는 세 절을 모두 쓴다. Google Play는 Mac에서만 일어나는 날씨 위치 수정을 빼고 `새로운 기능`만 쓴다.
- App Store는 기능 이름과 이유를 풀어 쓰고 VoiceOver를, Play는 500자 안에서 TalkBack을 적는다. 해요체, `(프리미엄)` 표기 대신 범위 차이를 문장으로 쓴다(무료 30일·프리미엄 365일). 이모지·홍보 문구는 없다.
- 영어(영국)는 `colour` 표기와 쉼표 규칙이 달라 `listing/app-store/en-GB/release_notes.txt`와 `patchNotes.appStore["en-GB"]`를 따로 둔다.
- 노트에는 읽기 전용, 한 번 가져오기, 7일 되돌리기(끝내지 않은 것만), 중복 방지를 밝힌다.

## 확인할 것

- 설명(`description`)·스크린샷에 캘린더 가져오기를 넣을지는 정하지 않았다(미확인). 이번 변경은 출시 노트만이다.
- 노트의 VoiceOver·TalkBack 문장은 접근성 라벨 계획에 맞춘 것이고 기기에서 읽어 보지 않았다. [qa-matrix](qa-matrix.md) H1 뒤에 확정한다.
- 이전 버전 폴더(`store-metadata/1.16.1` 등)는 기록으로 남긴다.
