import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KnowledgeEmbeddingEntity } from "@app/database/entities/knowledge-embedding.entity";
import { KnowledgeEmbeddingsRepository } from "@app/database";
import { KnowledgeEmbeddingsService } from "./knowledge-embeddings.service";
import { KnowledgeEmbeddingsController } from "./knowledge-embeddings.controller";

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeEmbeddingEntity])],
  providers: [KnowledgeEmbeddingsService, KnowledgeEmbeddingsRepository],
  controllers: [KnowledgeEmbeddingsController],
})
export class KnowledgeEmbeddingsModule {}
