import { IsArray, IsOptional, IsString } from "class-validator";

export class UpdatePageDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessTokens?: string[];

  @IsOptional()
  @IsString()
  salePrompt?: string | null;
}
