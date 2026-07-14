import { Injectable } from "@nestjs/common";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import type { RetentionConfigPort } from "../../application/ports/retention-config.port";

@Injectable()
export class RetentionConfigAdapter implements RetentionConfigPort {
	constructor(private readonly config: TypedConfigService) {}

	get enabled(): boolean {
		return this.config.retentionOnboardingV2.enabled;
	}

	get treatmentPercent(): number {
		return this.config.retentionOnboardingV2.treatmentPercent;
	}
}
