import { Global, Module } from "@nestjs/common";

import { OutboundPolicyRegistry } from "./outbound-policy.registry.js";

/** 외부 호출 정책(회로·bulkhead·시도별 timeout)을 이름별로 공유한다. */
@Global()
@Module({
  providers: [OutboundPolicyRegistry],
  exports: [OutboundPolicyRegistry],
})
export class ResilienceModule {}
