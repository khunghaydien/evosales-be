import { IsOptional, IsString } from "class-validator";

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  pageId?: string | null;
}
