import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class UpdatePageDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessTokens?: string[];

  @IsOptional()
  @IsString()
  salePrompt?: string | null;

  @IsOptional()
  @IsObject()
  orderShipConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  orderCollectionConfig?: Record<string, unknown>;
}
