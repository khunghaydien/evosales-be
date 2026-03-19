import { IsOptional, IsString } from "class-validator";

export class CreateChunksDto {
  @IsOptional()
  @IsString()
  pageId?: string | null;

  /** Toàn bộ text, phân tách bằng '#####' giữa các chunk */
  @IsString()
  content: string;
}
