import { Injectable } from "@nestjs/common";
import { RetentionFacade } from "@/retention";
import type { RetentionEnrollerPort } from "../../application/ports/retention-enroller.port";

@Injectable()
export class RetentionEnrollerAdapter implements RetentionEnrollerPort {
	constructor(private readonly retention: RetentionFacade) {}

	enrollNewUser(userId: string, activated: boolean): Promise<void> {
		return this.retention.enrollNewUser(userId, activated);
	}

	activateNewUser(userId: string): Promise<void> {
		return this.retention.activateNewUser(userId);
	}
}
