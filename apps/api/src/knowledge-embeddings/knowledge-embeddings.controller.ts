import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { KnowledgeEmbeddingsService } from "./knowledge-embeddings.service";
import { CreateKnowledgeEmbeddingDto } from "./dto/create-knowledge-embedding.dto";
import { UpdateKnowledgeDto } from "./dto/update-knowledge-embedding.dto";
import { CreateChunksDto } from "./dto/create-chunks.dto";
import { SearchKnowledgeDto } from "./dto/search-knowledge.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("knowledge-embeddings")
export class KnowledgeEmbeddingsController {
  constructor(
    private readonly knowledgeEmbeddingsService: KnowledgeEmbeddingsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list() {
    return this.knowledgeEmbeddingsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateKnowledgeEmbeddingDto) {
    return this.knowledgeEmbeddingsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("chunks")
  createChunks(@Body() dto: CreateChunksDto) {
    return this.knowledgeEmbeddingsService.createChunks(dto);
  }

  @Post("search")
  search(@Body() dto: SearchKnowledgeDto) {
    return this.knowledgeEmbeddingsService.search(dto);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.knowledgeEmbeddingsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.knowledgeEmbeddingsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.knowledgeEmbeddingsService.remove(id);
  }
}
