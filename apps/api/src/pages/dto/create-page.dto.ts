import { IsArray, IsOptional, IsString } from "class-validator";

export class CreatePageDto {
  @IsString()
  pageId: string;

  @IsArray()
  @IsString({ each: true })
  accessTokens: string[];

  @IsOptional()
  @IsString()
  salePrompt?: string | null;
}
