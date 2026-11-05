---
'@aido/server': patch
---

AI가 말하지 않은 반복 끝을 만들지 않게 한다. 시작일보다 뒤가 아닌 `until`·`forDuration`은 버리고, "30분 운동"의 걸리는 시간은 제목에 남기며 반복 기간으로 쓰지 않는다. "이번"·"다음" 없는 "주말에"는 끝 없는 주말 반복이다. 녹음 정리의 제목·요약·핵심 포인트는 말한 언어와 상관없이 앱 언어로 쓴다. 프롬프트 버전은 `parse-todo@6`, `parse-memo@6`, `quick-plan@5`, `voice-note-digest@5`다.
