import { Injectable, OnModuleDestroy } from "@nestjs/common";
import WebSocket = require("ws");
import jwt = require("jsonwebtoken");
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { DataSource } from "typeorm";
import { PancakeApiService } from "./pancake-api.service";
import {
  ConversationEntity,
  ConversationStatus,
} from "@app/database/entities/conversation.entity";

type HistoryItem = {
  message: string;
  type: "system" | "human";
  image_urls?: string[];
};

type SessionStep =
  | "idle"
  | "collect_order"
  | "collect_shipping"
  | "confirm"
  | "done";

type ConversationSession = {
  conversationId: string;
  pageExternalId: string;
  pageDbId: string;
  intent: string | null;
  order_info: {
    product_name?: string;
    variant?: string;
    size?: string;
    quantity?: number;
    notes?: string;
    combo?: number;
    color?: string;
  };
  shipping_info: {
    name?: string;
    phone?: string;
    address?: string;
  };
  step: SessionStep;
};

type ExtractorResult = {
  intent: { type: string; confidence: number };
  order_info: Record<string, unknown>;
  shipping_info: Record<string, unknown>;
  thanks: boolean;
};

@Injectable()
export class PancakeSocketService implements OnModuleDestroy {
  private ws: WebSocket;
  private readonly websocketUrl = "wss://pages.fm/socket/websocket?vsn=2.0.0";
  private heartbeatInterval: NodeJS.Timeout;
  private isReconnecting = false;
  private reconnectInterval: NodeJS.Timeout;
  private accessTokens: string[] = [];
  private accessTokenHealthInterval: NodeJS.Timeout;
  private currentAccessToken: string;
  private currentActivePages: any[];
  private pagePrompts: Record<string, string | null> = {};
  private pageOrderConfigs: Record<
    string,
    {
      orderShipConfig: Record<string, unknown> | null;
      orderCollectionConfig: Record<string, unknown> | null;
    }
  > = {};
  private pageDbIds: Record<string, string> = {};
  private readonly openai = new OpenAI();
  private readonly recentlyHandledConversations = new Map<string, number>();
  private readonly fieldAliases: Record<string, string[]> = {
    product_name: ["type", "product", "name", "variant"],
    type: ["product_name", "product", "name", "variant"],
    variant: ["type", "product_name"],
    quantity: ["qty", "so_luong", "soLuong"],
    color: ["mau", "màu"],
    size: ["kich_co", "kích_cỡ", "kichco"],
    combo: ["set"],
    phone: ["phone_number", "sdt", "so_dien_thoai", "soDienThoai"],
    address: ["dia_chi", "diaChi"],
    name: ["customer_name", "ten", "ho_ten", "hoTen"],
  };
  private readonly fieldLabelMap: Record<string, string> = {
    product_name: "sản phẩm",
    type: "sản phẩm",
    variant: "phân loại",
    quantity: "số lượng",
    combo: "combo",
    color: "màu sắc",
    size: "size",
    phone: "số điện thoại",
    address: "địa chỉ nhận hàng",
    name: "tên người nhận",
  };

  constructor(
    private readonly pancakeApiService: PancakeApiService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleDestroy() {
    this.closeWebSocket();
  }

  async connectWebSocket(
    accessTokens: string[],
    pagePrompts?: Record<string, string | null>,
    pageOrderConfigs?: Record<
      string,
      {
        orderShipConfig: Record<string, unknown> | null;
        orderCollectionConfig: Record<string, unknown> | null;
      }
    >,
    pageDbIds?: Record<string, string>,
  ): Promise<void> {
    try {
      this.accessTokens = accessTokens;
      this.pagePrompts = pagePrompts ?? {};
      this.pageOrderConfigs = pageOrderConfigs ?? {};
      this.pageDbIds = pageDbIds ?? {};
      const { accessToken, activePages } = await this.getRandomAccessToken();
      this.currentAccessToken = accessToken;
      this.currentActivePages = activePages;

      this.ws = new WebSocket(this.websocketUrl);

      this.ws.on("open", async () => {
        console.log("WebSocket connection opened");
        await this.handleWebSocketOpen(
          this.currentAccessToken,
          this.currentActivePages,
        );
      });

      this.ws.on("message", (message) => {
        this.handleWebSocketMessage(message, this.currentActivePages);
      });

      this.ws.on("close", (code, reason: string) => {
        this.handleWebSocketClose(code, reason);
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.stopHeartbeat();
        this.stopAccessTokenHealthCheck();
      });
    } catch (error: any) {
      console.error("Error connecting WebSocket:", error.message);
    }
  }

  private reconnectWebSocket(): void {
    if (this.isReconnecting) {
      console.log("Reconnect already in progress...");
      return;
    }
    this.isReconnecting = true;
    this.reconnectInterval = setInterval(async () => {
      console.log("Attempting to reconnect WebSocket...");
      try {
        await this.connectWebSocket(
          this.accessTokens,
          this.pagePrompts,
          this.pageOrderConfigs,
          this.pageDbIds,
        );
        clearInterval(this.reconnectInterval);
        this.isReconnecting = false;
        console.log("WebSocket reconnected successfully!");
      } catch (error: any) {
        console.error("Reconnect attempt failed:", error.message);
      }
    }, 30_000);
  }

  private async handleWebSocketOpen(
    accessToken: string,
    activePages: any[],
  ): Promise<void> {
    try {
      const userId = await this.generateUserId(accessToken);
      const joinMessage = JSON.stringify([
        "4",
        "4",
        `users:${userId}`,
        "phx_join",
        {
          accessToken,
          userId,
          platform: "web",
        },
      ]);
      this.ws.send(joinMessage);

      const activedPageIds = activePages.map(({ id }) => id);
      console.log("actived pages:", activedPageIds);
      const message = JSON.stringify([
        "7",
        "7",
        activePages.length === 1
          ? `pages:${activePages[0].id}`
          : `multiple_pages:${userId}`,
        "phx_join",
        {
          accessToken,
          userId,
          clientSession: uuidv4(),
          pageIds: activedPageIds,
          platform: "web",
        },
      ]);
      this.ws.send(message);
      this.startHeartbeat();
      this.startAccessTokenHealthCheck();
    } catch (error: any) {
      console.error("Error during WebSocket open handling:", error.message);
    }
  }

  private async handleWebSocketMessage(
    message: WebSocket.Data,
    activePages: any[],
  ): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const eventType = parsedMessage[3];
      const payload = parsedMessage[4];
      const { page_id: pageId, conversation } = payload;
      const completedTagId = Number(process.env.PANCAKE_COMPLETED_TAG_ID);
      const hasCompletedTag =
        Number.isFinite(completedTagId) &&
        Array.isArray(conversation?.tags) &&
        conversation.tags.map((t: any) => Number(t)).includes(completedTagId);

      if (eventType !== "pages:update_conversation") {
        console.log("Event type is not a new message:", eventType);
        return;
      }

      const isSentByBot = activePages.some(
        ({ name }) => name === conversation?.last_sent_by?.name,
      );

      if (!Array.isArray(parsedMessage) || parsedMessage.length <= 4) {
        console.warn("Unexpected message format:", parsedMessage);
        return;
      }

      if (!pageId || !conversation?.id) {
        console.warn("Missing pageId or conversation in message payload");
        return;
      }

      if (hasCompletedTag) {
        console.log(
          "Skip because conversation has completed tag:",
          completedTagId,
        );
        return;
      }

      if (isSentByBot) {
        console.log("Message sent by bot, ignoring...");
        return;
      }

      if (conversation.assignee_ids?.length || conversation.assignee_group_id) {
        console.log("Message assigned to someone else, ignoring...");
        return;
      }

      const conversationId = String(conversation.id);
      const externalPageId = String(pageId);
      const dbPageId = this.pageDbIds[externalPageId];
      if (!dbPageId) {
        console.warn(
          `Missing page mapping for external pageId=${externalPageId}`,
        );
        return;
      }
      const now = Date.now();
      const lastHandledAt =
        this.recentlyHandledConversations.get(conversationId);
      if (lastHandledAt && now - lastHandledAt < 10_000) {
        console.log("Skip duplicate conversation update");
        return;
      }
      this.recentlyHandledConversations.set(conversationId, now);

      const conversationRepo =
        this.dataSource.getRepository(ConversationEntity);
      const existing = await conversationRepo.findOne({
        where: {
          pageId: dbPageId,
          externalConversationId: conversationId,
        },
      });
      if (existing?.status === ConversationStatus.SOLD) {
        console.log("Skip because conversation status is SOLD");
        return;
      }

      await this.sendBackMessage(pageId, conversation, activePages);
    } catch (error: any) {
      console.error("Error parsing WebSocket message:", error.message);
    }
  }

  private handleWebSocketClose(code: number, reason: string): void {
    console.log(
      `WebSocket connection closed. Code: ${code}, Reason: ${reason}`,
    );
    this.stopHeartbeat();
    this.stopAccessTokenHealthCheck();
    this.reconnectWebSocket();
  }

  private closeWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      console.log("WebSocket connection closed manually");
    }
    this.stopHeartbeat();
    this.stopAccessTokenHealthCheck();
  }

  private startAccessTokenHealthCheck() {
    this.accessTokenHealthInterval = setInterval(async () => {
      try {
        await this.pancakeApiService.listPage({
          accessToken: this.currentAccessToken,
        });
        console.log("Checked access token...");
      } catch (error: any) {
        console.warn("Changing access token...");
        const { accessToken, activePages } = await this.getRandomAccessToken();
        this.currentAccessToken = accessToken;
        this.currentActivePages = activePages;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          await this.handleWebSocketOpen(
            this.currentAccessToken,
            this.currentActivePages,
          );
        }
      }
    }, 300_000);
  }

  private stopAccessTokenHealthCheck() {
    if (this.accessTokenHealthInterval) {
      clearInterval(this.accessTokenHealthInterval);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        console.log("Sending heartbeat...");
        this.ws.ping();
      }
    }, 50_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      console.log("Heartbeat stopped");
    }
    this.reconnectWebSocket();
  }

  private async sendBackMessage(
    pageId: string,
    conversation: any,
    activePages: any[],
  ): Promise<void> {
    try {
      const { accessToken } = await this.getRandomAccessToken();
      const externalPageId = String(pageId);
      const dbPageId = this.pageDbIds[externalPageId];
      if (!dbPageId) {
        console.warn(
          `Missing page mapping for external pageId=${externalPageId} (sendBackMessage)`,
        );
        return;
      }
      const conversationId = conversation?.id;
      const customerId = conversation?.customers?.[0]?.id || "";

      if (!externalPageId || !conversationId || !customerId) {
        console.warn("Missing get messages params:", {
          pageId: externalPageId,
          conversationId,
          customerId,
        });
        return;
      }

      const { messages } = await this.pancakeApiService.getMessages({
        pageId: externalPageId,
        conversationId,
        accessToken,
        customerId,
      });

      const historyMessage: HistoryItem[] = messages.map((m: any) => {
        if (
          m.attachments.length === 1 &&
          m.attachments[0].type === "replied_message"
        ) {
          return {
            message: `${
              activePages.some(
                ({ name }) => name === m.attachments[0].from.name,
              )
                ? "shop nói: "
                : "mình nói: "
            } ${m.attachments[0].message} ${m.original_message}`,
            type: activePages.some(({ name }) => name === m.from.name)
              ? "system"
              : "human",
            image_urls:
              m.attachments?.[0]?.attachments
                ?.filter((item: any) => item?.url)
                .map((item: any) => item.url.toString()) || [],
          };
        }

        if (m.attachments.length === 1 && m.attachments[0].type === "sticker") {
          return {
            message: messages.length === 1 ? "." : "ok",
            type: activePages.some(({ name }) => name === m.from.name)
              ? "system"
              : "human",
            image_urls: [],
          };
        }

        return {
          message: m.original_message,
          type: activePages.some(({ name }) => name === m.from.name)
            ? "system"
            : "human",
          image_urls: (m.attachments || [])
            .filter((a: any) => a?.url)
            .map((a: any) => a.url.toString()),
        };
      });

      const extracted = await this.extractIntentAndOrderInfoByAI({
        history: historyMessage,
        pageId: externalPageId,
      });

      const existing = await this.dataSource
        .getRepository(ConversationEntity)
        .findOne({
          where: {
            pageId: dbPageId,
            externalConversationId: String(conversationId),
          },
        });

      let session = this.buildSession({
        conversationId: String(conversationId),
        pageExternalId: externalPageId,
        pageDbId: dbPageId,
        existing,
      });

      session = this.mergeSession(session, extracted);
      session = this.canonicalizeSessionByRequiredFields(session);
      session = this.nextStep(session);
      session = this.applyIntentTransitions(session, extracted.intent.type);
      const { orderMissing, shipMissing } = this.getMissingFields(session);
      console.log("[conversation] session synced", {
        conversationId: String(conversationId),
        pageId: externalPageId,
        intent: session.intent,
        step: session.step,
        orderKeys: Object.keys(session.order_info ?? {}),
        shippingKeys: Object.keys(session.shipping_info ?? {}),
        orderMissing,
        shipMissing,
      });

      // Persist memory + state machine result into conversations table.
      await this.saveSession(session, existing);

      if (session.step === "done") {
        await this.pancakeApiService.sendInbox({
          data: {
            message: "Đơn của bạn đã được ghi nhận, bên mình sẽ xử lý sớm ạ ❤️",
          },
          pageId,
          conversationId,
          accessToken,
        });
        return;
      }

      const reply = this.generateResponse(session);
      if (!reply) return;
      await this.pancakeApiService.sendInbox({
        data: { message: reply.replace(/(\\n)+/g, "\r\n") },
        pageId,
        conversationId,
        accessToken,
      });
    } catch (error: any) {
      console.error("Error send back message :", error.message);
    }
  }

  private async extractIntentAndOrderInfoByAI(params: {
    history: HistoryItem[];
    pageId: string;
  }): Promise<{
    intent: { type: string; confidence: number };
    order_info: Record<string, unknown>;
    shipping_info: Record<string, unknown>;
    thanks: boolean;
  }> {
    const { history, pageId } = params;
    const { orderRequired, shipRequired } = this.getPageRequiredFields(pageId);
    console.log("[extractor] start", {
      pageId,
      historyCount: history.length,
      latestMessagePreview: String(
        history[history.length - 1]?.message ?? "",
      ).slice(0, 120),
      orderRequired,
      shipRequired,
    });

    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Bạn là bộ trích xuất dữ liệu hội thoại bán hàng. Trả về JSON hợp lệ duy nhất, không thêm markdown.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "extract_conversation_intent_and_fields",
            allowedIntent: [
              "question",
              "order",
              "info",
              "update",
              "confirm_order",
              "cancel_order",
            ],
            requiredOrderFields: orderRequired,
            requiredShippingFields: shipRequired,
            schema: {
              intent: "{ type: string, confidence: number }",
              thanks: "boolean",
              order_info: "object",
              shipping_info: "object",
            },
            rules: [
              "chỉ trích xuất field xuất hiện rõ trong hội thoại, không bịa",
              "nếu chưa rõ thì bỏ trống object tương ứng",
              "intent=question khi khách chủ yếu đang hỏi",
              "intent=order khi khách cung cấp/chốt thông tin đơn",
              "intent=info khi là thông tin chung khác",
              "intent=update khi khách sửa thông tin đã cung cấp",
              "intent=confirm_order khi khách xác nhận chốt đơn",
              "intent=cancel_order khi khách hủy đơn hoặc nói không mua",
            ],
            history,
          },
          null,
          2,
        ),
      },
    ];

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: chatMessages,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content?.toString().trim();
      if (!raw) {
        console.warn("[extractor] empty response");
        return {
          intent: { type: "info", confidence: 0 },
          order_info: {},
          shipping_info: {},
          thanks: false,
        };
      }

      const parsed = JSON.parse(raw);
      console.log("[extractor] raw parsed keys", {
        intentType: parsed?.intent?.type ?? parsed?.intent,
        hasOrderInfo: Boolean(parsed?.order_info),
        hasShippingInfo: Boolean(parsed?.shipping_info),
        thanks: Boolean(parsed?.thanks),
      });
      const intentType =
        typeof parsed?.intent?.type === "string"
          ? parsed.intent.type
          : typeof parsed?.intent === "string"
            ? parsed.intent
            : "info";
      const confidence =
        typeof parsed?.intent?.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.intent.confidence))
          : 0.5;
      const normalized = {
        intent: { type: intentType, confidence },
        order_info:
          parsed?.order_info && typeof parsed.order_info === "object"
            ? parsed.order_info
            : {},
        shipping_info:
          parsed?.shipping_info && typeof parsed.shipping_info === "object"
            ? parsed.shipping_info
            : {},
        thanks: Boolean(parsed?.thanks),
      };
      console.log("[extractor] normalized result", {
        intent: normalized.intent,
        orderFields: Object.keys(normalized.order_info),
        shippingFields: Object.keys(normalized.shipping_info),
        thanks: normalized.thanks,
      });

      return normalized;
    } catch (error: any) {
      console.error("AI extractor failed:", error?.message);
      return {
        intent: { type: "info", confidence: 0 },
        order_info: {},
        shipping_info: {},
        thanks: false,
      };
    }
  }

  private removeNull(obj: Record<string, unknown> | null | undefined) {
    return Object.fromEntries(
      Object.entries(obj || {}).filter(
        ([, v]) => v !== null && v !== undefined,
      ),
    );
  }

  private buildSession(params: {
    conversationId: string;
    pageExternalId: string;
    pageDbId: string;
    existing: ConversationEntity | null;
  }): ConversationSession {
    const { conversationId, pageExternalId, pageDbId, existing } = params;
    const status = existing?.status ?? ConversationStatus.NEVER_MESSAGED;

    let step: SessionStep = "idle";
    if (status === ConversationStatus.ORDER_INFO_COLLECTED) {
      step = "collect_shipping";
    } else if (status === ConversationStatus.SHIPPING_INFO_COLLECTED) {
      step = "confirm";
    } else if (status === ConversationStatus.SOLD) {
      step = "done";
    }

    return {
      conversationId,
      pageExternalId,
      pageDbId,
      intent: null,
      order_info: ((existing?.orderInfo as Record<string, unknown>) ??
        {}) as any,
      shipping_info: ((existing?.shippingInfo as Record<string, unknown>) ??
        {}) as any,
      step,
    };
  }

  private mergeSession(
    session: ConversationSession,
    extracted: ExtractorResult,
  ): ConversationSession {
    return {
      ...session,
      intent: extracted.intent?.type || session.intent,
      order_info: {
        ...session.order_info,
        ...this.removeNull(extracted.order_info),
      },
      shipping_info: {
        ...session.shipping_info,
        ...this.removeNull(extracted.shipping_info),
      },
    };
  }

  private nextStep(session: ConversationSession): ConversationSession {
    const { orderMissing, shipMissing } = this.getMissingFields(session);
    if (orderMissing.length > 0) return { ...session, step: "collect_order" };
    if (shipMissing.length > 0) return { ...session, step: "collect_shipping" };
    return { ...session, step: "confirm" };
  }

  private applyIntentTransitions(
    session: ConversationSession,
    intentType: string,
  ): ConversationSession {
    const i = (intentType || "").toLowerCase();
    if (i === "cancel_order") {
      return {
        ...session,
        intent: i,
        order_info: {},
        shipping_info: {},
        step: "idle",
      };
    }
    if (session.step === "confirm" && i === "confirm_order") {
      return { ...session, intent: i, step: "done" };
    }
    return { ...session, intent: i || session.intent };
  }

  private async saveSession(
    session: ConversationSession,
    existing: ConversationEntity | null,
  ): Promise<void> {
    const repo = this.dataSource.getRepository(ConversationEntity);

    let status: ConversationStatus = ConversationStatus.NEVER_MESSAGED;
    if (session.step === "collect_shipping") {
      status = ConversationStatus.ORDER_INFO_COLLECTED;
    } else if (session.step === "confirm") {
      status = ConversationStatus.SHIPPING_INFO_COLLECTED;
    } else if (session.step === "done") {
      status = ConversationStatus.SOLD;
    }

    if (existing) {
      existing.orderInfo = session.order_info as any;
      existing.shippingInfo = session.shipping_info as any;
      existing.status = status;
      existing.updatedAt = new Date();
      await repo.save(existing);
      return;
    }

    const created = repo.create({
      pageId: session.pageDbId,
      externalConversationId: session.conversationId,
      status,
      orderInfo: session.order_info as any,
      shippingInfo: session.shipping_info as any,
    });
    await repo.save(created);
  }

  private generateResponse(session: ConversationSession): string {
    const { orderMissing, shipMissing } = this.getMissingFields(session);
    const allMissing = [...orderMissing, ...shipMissing];
    switch (session.step) {
      case "idle":
        if (allMissing.length > 0) {
          return `a/c cho e xin ${this.toFieldList(allMissing)} để e lên đơn cho mk ạ`;
        }
        return "Mình có thể giúp gì cho bạn ạ?";
      case "collect_order":
        if (allMissing.length > 0) {
          return `a/c cho e xin ${this.toFieldList(allMissing)} để e lên đơn cho mk ạ`;
        }
        return "a/c cho e xác nhận giúp đơn để e lên đơn cho mk ạ";
      case "collect_shipping":
        if (allMissing.length > 0) {
          return `a/c cho e xin ${this.toFieldList(allMissing)} để e lên đơn cho mk ạ`;
        }
        return "a/c cho e xác nhận giúp thông tin nhận hàng để e lên đơn cho mk ạ";
      case "confirm":
        return [
          "Xác nhận đơn giúp mình:",
          "",
          `- Sản phẩm: ${session.order_info.product_name || "chưa có"}`,
          `- Số lượng: ${session.order_info.quantity || "chưa có"}`,
          `- Màu sắc: ${session.order_info.color || "không có"}`,
          `- SĐT: ${session.shipping_info.phone || "chưa có"}`,
          `- Địa chỉ: ${session.shipping_info.address || "chưa có"}`,
          "",
          "Bạn xác nhận giúp mình nhé?",
        ].join("\n");
      case "done":
        return "Đơn của bạn đã được ghi nhận, bên mình sẽ xử lý sớm ạ ❤️";
      default:
        return "Mình có thể giúp gì cho bạn?";
    }
  }

  private getMissingFields(session: ConversationSession): {
    orderMissing: string[];
    shipMissing: string[];
  } {
    const { orderRequired, shipRequired } = this.getPageRequiredFields(
      session.pageExternalId,
    );
    const orderMissing = orderRequired.filter(
      (field) => !this.hasFieldValue(session.order_info, field),
    );
    const shipMissing = shipRequired.filter(
      (field) => !this.hasFieldValue(session.shipping_info, field),
    );
    return { orderMissing, shipMissing };
  }

  private canonicalizeSessionByRequiredFields(
    session: ConversationSession,
  ): ConversationSession {
    const { orderRequired, shipRequired } = this.getPageRequiredFields(
      session.pageExternalId,
    );
    const nextOrderInfo = { ...session.order_info } as Record<string, unknown>;
    const nextShippingInfo = {
      ...session.shipping_info,
    } as Record<string, unknown>;

    for (const field of orderRequired) {
      if (this.isFilledValue(nextOrderInfo[field])) {
        continue;
      }
      const value = this.resolveFieldValue(nextOrderInfo, field);
      if (this.isFilledValue(value)) {
        nextOrderInfo[field] = value;
      }
    }

    for (const field of shipRequired) {
      if (this.isFilledValue(nextShippingInfo[field])) {
        continue;
      }
      const value = this.resolveFieldValue(nextShippingInfo, field);
      if (this.isFilledValue(value)) {
        nextShippingInfo[field] = value;
      }
    }

    return {
      ...session,
      order_info: nextOrderInfo as ConversationSession["order_info"],
      shipping_info: nextShippingInfo as ConversationSession["shipping_info"],
    };
  }

  private resolveFieldValue(
    source: Record<string, unknown>,
    field: string,
  ): unknown {
    const directValue = source?.[field];
    if (this.isFilledValue(directValue)) {
      return directValue;
    }
    const aliases = this.fieldAliases[field] ?? [];
    for (const alias of aliases) {
      const aliasValue = source?.[alias];
      if (this.isFilledValue(aliasValue)) {
        return aliasValue;
      }
    }
    return undefined;
  }

  private hasFieldValue(
    source: Record<string, unknown>,
    field: string,
  ): boolean {
    const directValue = source?.[field];
    if (this.isFilledValue(directValue)) {
      return true;
    }
    const aliases = this.fieldAliases[field] ?? [];
    return aliases.some((alias) => this.isFilledValue(source?.[alias]));
  }

  private isFilledValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return true;
  }

  private toFieldLabel(field: string): string {
    return this.fieldLabelMap[field] ?? field.replace(/_/g, " ");
  }

  private toFieldList(fields: string[]): string {
    const labels = Array.from(
      new Set(fields.map((field) => this.toFieldLabel(field))),
    );
    return labels.join(", ");
  }

  private getPageRequiredFields(pageId: string): {
    orderRequired: string[];
    shipRequired: string[];
  } {
    const cfg = this.pageOrderConfigs[pageId];

    const orderRequired = (cfg?.orderCollectionConfig as any)?.required ??
      (cfg?.orderCollectionConfig as any)?.requiredFields ?? [
        "quantity",
        "product_name",
        "color",
      ];

    const shipRequired = (cfg?.orderShipConfig as any)?.required ??
      (cfg?.orderShipConfig as any)?.requiredFields ?? ["phone", "address"];

    return {
      orderRequired: Array.isArray(orderRequired)
        ? orderRequired
        : ["quantity", "product_name", "color"],
      shipRequired: Array.isArray(shipRequired)
        ? shipRequired
        : ["phone", "address"],
    };
  }

  private async generateUserId(token: string): Promise<string> {
    try {
      const decoded: any = jwt.decode(token);
      return decoded?.uid || "";
    } catch (error: any) {
      console.error("Error decoding token:", error.message);
      return "";
    }
  }

  private async getRandomAccessToken(): Promise<{
    accessToken: string;
    activePages: any[];
  }> {
    let tokens = [...this.accessTokens];
    const configuredPageIds = new Set(Object.keys(this.pagePrompts ?? {}));

    let attempts = 0;
    const maxAttempts = Math.max(10, tokens.length * 6);

    while (tokens.length > 0 && attempts < maxAttempts) {
      attempts++;

      const randomIndex = Math.floor(Math.random() * tokens.length);
      const accessToken = tokens[randomIndex];

      try {
        const pancakePages = await this.pancakeApiService.listPage({
          accessToken,
        });

        const activatedPageIds: string[] = Array.isArray(
          pancakePages?.categorized?.activated_page_ids,
        )
          ? pancakePages.categorized.activated_page_ids.map((x: any) =>
              String(x),
            )
          : [];

        const checkActivedPages =
          await this.pancakeApiService.checkActivedPages({
            accessToken,
            pageIds: activatedPageIds,
          });

        const activatedObjects = Array.isArray(
          pancakePages?.categorized?.activated,
        )
          ? pancakePages.categorized.activated
          : [];

        const errorPageIds = new Set(
          (checkActivedPages?.errors ?? []).map((e: any) =>
            String(e?.page_id ?? ""),
          ),
        );

        let activePages: any[] = [];
        if (checkActivedPages?.success === true && activatedObjects.length) {
          activePages = activatedObjects;
        } else if (activatedObjects.length) {
          activePages = activatedObjects.filter(({ id }: any) => {
            const pid = String(id ?? "");
            return pid && !errorPageIds.has(pid);
          });
        }

        if (!activePages.length && activatedPageIds.length) {
          activePages = activatedPageIds.map((id) => ({ id }));
        }

        if (configuredPageIds.size > 0) {
          activePages = activePages.filter(
            (p: any) => p?.id != null && configuredPageIds.has(String(p.id)),
          );
        }

        if (!activePages.length) {
          console.warn(
            "No active pages resolved for this token (filtered by pagePrompts). Trying another token…",
          );
          tokens.splice(randomIndex, 1);
          continue;
        }

        return { accessToken, activePages };
      } catch (error: any) {
        const statusCode = error?.statusCode ?? error?.response?.status;

        if (statusCode === 429) {
          const retryAfterRaw = error?.retryAfter;
          const retryAfterSec =
            typeof retryAfterRaw === "string"
              ? Number.parseInt(retryAfterRaw, 10)
              : typeof retryAfterRaw === "number"
                ? retryAfterRaw
                : NaN;

          const waitMs =
            Number.isFinite(retryAfterSec) && retryAfterSec > 0
              ? retryAfterSec * 1000
              : 2_000 * Math.min(8, attempts);

          console.warn(
            `Rate limited (429). Waiting ${waitMs}ms then retrying…`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        console.error("Error when get random access token:", error.message);
        tokens.splice(randomIndex, 1);
        console.warn(`Token failed in this attempt, trying another token`);
      }
    }

    console.error("No alive access token found");
    throw new Error("No alive Pancake access token or no resolvable pages");
  }
}
