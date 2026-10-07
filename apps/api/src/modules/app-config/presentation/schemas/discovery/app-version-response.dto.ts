import { appStoreVersionPattern } from "@aido/api";
import { ApiProperty } from "@nestjs/swagger";

class PlatformVersionDto {
  @ApiProperty({ example: "1.9.1", pattern: appStoreVersionPattern })
  declare latestVersion: string;
}

export class AppVersionDisabledResponseDto {
  @ApiProperty({ enum: [false] })
  declare enabled: false;
}

export class AppVersionEnabledResponseDto {
  @ApiProperty({ enum: [true] })
  declare enabled: true;

  @ApiProperty({ type: PlatformVersionDto })
  declare ios: PlatformVersionDto;

  @ApiProperty({ type: PlatformVersionDto })
  declare android: PlatformVersionDto;
}

const disabled = {
  title: "AppVersionDisabledResponse",
  type: "object",
  additionalProperties: false,
  required: ["enabled"],
  properties: { enabled: { type: "boolean", enum: [false] } },
};
const platform = {
  type: "object",
  additionalProperties: false,
  required: ["latestVersion"],
  properties: { latestVersion: { type: "string", pattern: appStoreVersionPattern } },
};
const enabled = {
  title: "AppVersionEnabledResponse",
  type: "object",
  additionalProperties: false,
  required: ["enabled", "ios", "android"],
  properties: { enabled: { type: "boolean", enum: [true] }, ios: platform, android: platform },
};

export const appVersionResponseOpenApiSchema = {
  oneOf: [disabled, enabled],
  discriminator: { propertyName: "enabled" },
};
