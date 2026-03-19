import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import OpenAI from "openai";
import { KnowledgeEmbeddingEntity } from "../entities/knowledge-embedding.entity";

@Injectable()
export class KnowledgeEmbeddingsRepository {
  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  constructor(
    @InjectRepository(KnowledgeEmbeddingEntity)
    private readonly repo: Repository<KnowledgeEmbeddingEntity>,
  ) {}

  create(data: { pageId?: string | null; chunk?: string }) {
    const entity = this.repo.create({
      pageId: data.pageId ?? null,
      chunk: data.chunk ?? "",
    });
    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException("Knowledge embedding not found");
    }
    return entity;
  }

  async update(id: string, data: { pageId?: string | null }) {
    const entity = await this.findOne(id);
    if (data.pageId !== undefined) {
      entity.pageId = data.pageId;
    }
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException("Knowledge embedding not found");
    }
  }

  async createChunks(data: { pageId?: string | null; content: string }) {
    const rawChunks = data.content.split("#####");
    const chunks = rawChunks.map((c) => c.trim()).filter((c) => c.length > 0);

    if (chunks.length === 0) {
      return [];
    }

    const entities = chunks.map((chunk) =>
      this.repo.create({
        pageId: data.pageId ?? null,
        chunk,
      }),
    );

    const saved = await this.repo.save(entities);

    const vectors = await this.embedTexts(chunks);

    for (let i = 0; i < saved.length; i += 1) {
      const vector = vectors[i];
      if (!vector) continue;
      await this.repo.update(saved[i].id, { embedding: vector });
    }

    return this.repo.findByIds(saved.map((s) => s.id));
  }

  async search(data: { query: string; topK?: number; pageId?: string | null }) {
    const [queryEmbedding] = await this.embedTexts([data.query]);
    const topK = data.topK ?? 10;

    const params: any[] = [queryEmbedding, topK];
    let pageFilterSql = "";

    if (data.pageId) {
      pageFilterSql = "AND page_id = $3";
      params.push(data.pageId);
    }

    const rows = await this.repo.query(
      `
      SELECT id, page_id as "pageId", chunk, embedding <=> $1 AS distance
      FROM knowledge_embeddings
      WHERE embedding IS NOT NULL
      ${pageFilterSql}
      ORDER BY embedding <=> $1
      LIMIT $2
      `,
      params,
    );

    return rows;
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    const model =
      process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

    const resp = await this.openai.embeddings.create({
      model,
      input: texts,
    });

    return resp.data.map((item) => item.embedding as number[]);
  }
}
