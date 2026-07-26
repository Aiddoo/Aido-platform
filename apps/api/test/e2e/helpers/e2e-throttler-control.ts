import { ThrottlerGuard } from "@nestjs/throttler";

const realCanActivate = ThrottlerGuard.prototype.canActivate;
const bypassCanActivate = async (): Promise<boolean> => true;

export function bypassE2eThrottler(): void {
	ThrottlerGuard.prototype.canActivate = bypassCanActivate;
}

export function restoreRealE2eThrottler(): void {
	ThrottlerGuard.prototype.canActivate = realCanActivate;
}

export function isE2eThrottlerBypassed(): boolean {
	return ThrottlerGuard.prototype.canActivate === bypassCanActivate;
}
