import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PageEntity } from "../entities/page.entity";

@Injectable()
export class PagesRepository {
  constructor(
    @InjectRepository(PageEntity)
    private readonly repo: Repository<PageEntity>,
  ) {}

  createForUser(
    userId: string,
    data: {
      pageId: string;
      accessTokens: string[];
      salePrompt?: string | null;
      orderShipConfig?: Record<string, unknown> | null;
      orderCollectionConfig?: Record<string, unknown> | null;
    },
  ) {
    const page = this.repo.create({
      userId,
      pageId: data.pageId,
      accessTokens: data.accessTokens,
      salePrompt: data.salePrompt ?? null,
      orderShipConfig: data.orderShipConfig ?? null,
      orderCollectionConfig: data.orderCollectionConfig ?? null,
    });
    return this.repo.save(page);
  }

  findAllForUser(userId: string) {
    return this.repo.find({ where: { userId } });
  }

  async findOne(id: string) {
    const page = await this.repo.findOne({ where: { id } });
    if (!page) {
      throw new NotFoundException("Page not found");
    }
    return page;
  }

  async updateForUser(
    userId: string,
    id: string,
    data: {
      accessTokens?: string[];
      salePrompt?: string | null;
      orderShipConfig?: Record<string, unknown> | null;
      orderCollectionConfig?: Record<string, unknown> | null;
    },
  ) {
    const page = await this.repo.findOne({ where: { id, userId } });
    if (!page) {
      throw new NotFoundException("Page not found");
    }
    if (data.accessTokens !== undefined) {
      page.accessTokens = data.accessTokens;
    }
    if (data.salePrompt !== undefined) {
      page.salePrompt = data.salePrompt ?? null;
    }
    if (data.orderShipConfig !== undefined) {
      page.orderShipConfig = data.orderShipConfig ?? null;
    }
    if (data.orderCollectionConfig !== undefined) {
      page.orderCollectionConfig = data.orderCollectionConfig ?? null;
    }
    return this.repo.save(page);
  }

  async removeForUser(userId: string, id: string): Promise<void> {
    const result = await this.repo.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException("Page not found");
    }
  }
}
