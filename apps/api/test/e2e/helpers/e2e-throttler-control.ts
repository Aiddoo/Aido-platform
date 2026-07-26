import { ThrottlerGuard } from "@nestjs/throttler";

const realCanActivate = ThrottlerGuard.prototype.canActivate;

export function bypassE2eThrottler(): void {
	ThrottlerGuard.prototype.canActivate = async () => true;
}

export function restoreRealE2eThrottler(): void {
	ThrottlerGuard.prototype.canActivate = realCanActivate;
}
