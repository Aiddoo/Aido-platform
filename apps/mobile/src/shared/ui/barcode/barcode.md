# Barcode

영수증 톤 카드(`ScallopedContainer`) 아래쪽에 두는 바코드 장식이다. 막대마다 뷰를 두지 않고 모듈에서 만든 SVG 경로 하나로 그린다. 구독 화면 영수증과 초대 카드 혜택
영수증이 같은 모양을 쓴다. 실제 코드를 담지 않으며 스크린 리더에서 읽지 않는다.

## 사용법

```tsx
import { Barcode, DashedDivider, ScallopedContainer } from '@src/shared/ui';

<ScallopedContainer>
  …
  <DashedDivider className="my-5 mx-5" />
  <Barcode className="pb-5" />
</ScallopedContainer>;
```

## Props

| Prop      | 타입     | 기본값 | 설명                           |
| --------- | -------- | ------ | ------------------------------ |
| height    | `number` | `32`   | 막대 높이(pt). 레이아웃 고정용 |
| className | `string` | -      | 여백 등 배치만 조정한다        |
