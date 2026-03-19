import { Injectable } from "@nestjs/common";
import { KnowledgeEmbeddingsRepository } from "@app/database";
import { CreateKnowledgeEmbeddingDto } from "./dto/create-knowledge-embedding.dto";
import { UpdateKnowledgeDto } from "./dto/update-knowledge-embedding.dto";
import { CreateChunksDto } from "./dto/create-chunks.dto";
import { SearchKnowledgeDto } from "./dto/search-knowledge.dto";

@Injectable()
export class KnowledgeEmbeddingsService {
  constructor(private readonly repo: KnowledgeEmbeddingsRepository) {}

  create(dto: CreateKnowledgeEmbeddingDto) {
    return this.repo.create({
      pageId: dto.pageId,
      chunk: "",
    });
  }

  findAll() {
    return this.repo.findAll();
  }

  findOne(id: string) {
    return this.repo.findOne(id);
  }

  update(id: string, dto: UpdateKnowledgeDto) {
    return this.repo.update(id, { pageId: dto.pageId });
  }

  remove(id: string) {
    return this.repo.remove(id);
  }

  createChunks(dto: CreateChunksDto) {
    return this.repo.createChunks({ pageId: dto.pageId, content: dto.content });
  }

  async search(dto: SearchKnowledgeDto) {
    return this.repo.search({
      query: dto.query,
      topK: dto.topK,
      pageId: dto.pageId,
    });
  }
}
