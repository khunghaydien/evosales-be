import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  ConversationEntity,
  ConversationStatus,
} from "@app/database/entities/conversation.entity";
import { PageEntity } from "@app/database/entities/page.entity";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepo: Repository<ConversationEntity>,
    @InjectRepository(PageEntity)
    private readonly pagesRepo: Repository<PageEntity>,
  ) {}

  async createOrUpdate(userId: string, dto: CreateConversationDto) {
    const page = await this.pagesRepo.findOne({
      where: { id: dto.pageId, userId },
    });
    if (!page) {
      throw new BadRequestException("Page not found");
    }

    const existing = await this.conversationsRepo.findOne({
      where: {
        pageId: dto.pageId,
        externalConversationId: dto.externalConversationId,
      },
    });

    if (!existing) {
      const created = this.conversationsRepo.create({
        pageId: dto.pageId,
        externalConversationId: dto.externalConversationId,
        status: dto.status ?? ConversationStatus.NEVER_MESSAGED,
        orderInfo: dto.orderInfo ?? null,
        shippingInfo: dto.shippingInfo ?? null,
      });
      return this.conversationsRepo.save(created);
    }

    if (dto.status !== undefined) existing.status = dto.status;
    if (dto.orderInfo !== undefined) existing.orderInfo = dto.orderInfo;
    if (dto.shippingInfo !== undefined)
      existing.shippingInfo = dto.shippingInfo;
    existing.updatedAt = new Date();
    return this.conversationsRepo.save(existing);
  }

  async listMine(
    userId: string,
    params?: { pageId?: string; status?: ConversationStatus },
  ) {
    const qb = this.conversationsRepo
      .createQueryBuilder("c")
      .innerJoin("c.page", "p")
      .where("p.userId = :userId", { userId });

    if (params?.pageId)
      qb.andWhere("c.pageId = :pageId", { pageId: params.pageId });
    if (params?.status)
      qb.andWhere("c.status = :status", { status: params.status });

    qb.orderBy("c.updatedAt", "DESC");
    return qb.getMany();
  }

  async detailMine(userId: string, id: string) {
    const conversation = await this.conversationsRepo
      .createQueryBuilder("c")
      .innerJoin("c.page", "p")
      .where("c.id = :id", { id })
      .andWhere("p.userId = :userId", { userId })
      .getOne();

    if (!conversation) {
      throw new BadRequestException("Conversation not found");
    }
    return conversation;
  }

  async updateMine(userId: string, id: string, dto: UpdateConversationDto) {
    const conversation = await this.detailMine(userId, id);

    if (dto.status !== undefined) conversation.status = dto.status;
    if (dto.orderInfo !== undefined) conversation.orderInfo = dto.orderInfo;
    if (dto.shippingInfo !== undefined)
      conversation.shippingInfo = dto.shippingInfo;

    conversation.updatedAt = new Date();
    return this.conversationsRepo.save(conversation);
  }

  async removeMine(userId: string, id: string) {
    const conversation = await this.detailMine(userId, id);
    await this.conversationsRepo.delete({ id: conversation.id });
    return { deleted: true };
  }
}
