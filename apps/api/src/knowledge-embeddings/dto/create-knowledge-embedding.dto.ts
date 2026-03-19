import { IsOptional, IsString } from "class-validator";

export class CreateKnowledgeEmbeddingDto {
  @IsOptional()
  @IsString()
  pageId?: string | null;
}
