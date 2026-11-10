export {
  normalizeDeviceName,
  normalizeDevicePlatform,
  parseRequestClient,
  type RequestClient,
} from "./request-client.js";
export { AppVersion, CurrentRequestClient } from "./request-client.decorator.js";
export { RequestClientModule } from "./request-client.module.js";
export {
  readRequestClient,
  REQUEST_CLIENT_CLS_MIDDLEWARE,
  RequestClientReader,
} from "./request-client.store.js";
export { requestTimezoneIfSent, requestTimezoneOrUtc } from "./request-timezone.js";
