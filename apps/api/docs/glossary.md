# 도메인 용어집

기능을 설계·리뷰하거나 다른 부서와 같은 말로 이야기할 때 읽는다. Bounded Context마다 `glossary/<context>.md` 한 파일에 업무 용어와 코드 이름, 상태 전이를 표로 둔다. 코드 이름은 이 표의 말을 따르고([도메인 모델](domain-modeling.md#상태와-행동-이름)), 표에 없는 새 용어는 그 기능을 더하는 PR이 함께 적는다.

## 쓰는 법

- 용어는 사용자·운영자가 실제로 쓰는 한국어다. 코드 이름은 그 용어의 영어 한 단어(또는 두 단어)이고, Context 안에서 한 용어에 한 이름만 쓴다.
- 같은 낱말이 Context마다 다른 뜻이면 각 Context 절에 따로 적는다(예: planning의 "완료"와 insights의 "완료한 날").
- 상태가 있는 Aggregate는 전이 표를 둔다. 행동은 Aggregate 메서드 이름, 결과는 `true`(바뀜)·`false`(이미 그 상태)·오류다.

## Context별 용어집

[notes](glossary/notes.md) · [voice](glossary/voice.md) · [support](glossary/support.md) · [app-config](glossary/app-config.md) · [operations](glossary/operations.md) · [insights](glossary/insights.md) · [weather](glossary/weather.md) · [access](glossary/access.md)

아직 기준 모양으로 맞추지 않은 Context(ai-assistance · billing · engagement · identity · notification · planning · social)는 그 층에서 `glossary/<context>.md`를 만들고 여기에 링크를 더한다.
