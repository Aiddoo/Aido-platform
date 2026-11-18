import { NodeAdapter } from "@nestjs/platform-node";

// 출시 앱 호환: 기본(디코딩한 100자)이면 100자를 넘는 푸시 기기 id가 계약 검증의 400 SYS_0002 대신 414가 된다
const ROUTE_PARAMETER_MAX_LENGTH = 256;

/** 운영 서버와 테스트 앱이 같은 라우팅·proxy 신뢰로 돌도록 한 곳에서 만든다. */
export function createHttpAdapter(): NodeAdapter {
  return new NodeAdapter({
    maxParamLength: ROUTE_PARAMETER_MAX_LENGTH,
    // 홉 수는 받지 않아 주소로 신뢰한다. host Nginx는 docker bridge 게이트웨이(사설 대역), 테스트·로컬은 loopback으로 닿는다
    trustProxy: ["loopback", "uniquelocal"],
  });
}
