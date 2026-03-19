import { Injectable, OnModuleDestroy } from "@nestjs/common";
import WebSocket = require("ws");
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { PancakeApiService } from "./pancake-api.service";

type HistoryItem = {
  message: string;
  type: "system" | "human";
  image_urls?: string[];
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
  private readonly openai = new OpenAI();

  constructor(private readonly pancakeApiService: PancakeApiService) {}

  async onModuleDestroy() {
    this.closeWebSocket();
  }

  async connectWebSocket(
    accessTokens: string[],
    pagePrompts?: Record<string, string | null>,
  ): Promise<void> {
    try {
      this.accessTokens = accessTokens;
      this.pagePrompts = pagePrompts ?? {};
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
        await this.connectWebSocket(this.accessTokens);
        clearInterval(this.reconnectInterval);
        this.isReconnecting = false;
        console.log("WebSocket reconnected successfully!");
      } catch (error: any) {
        console.error("Reconnect attempt failed:", error.message);
      }
    }, 5000);
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
      const hasSomeTags = conversation?.tags?.some((tag) => tag >= 0);

      if (hasSomeTags) {
        console.log(
          "Event type is not a new message, has tags:",
          conversation?.tags,
        );
        return;
      }

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

      if (isSentByBot) {
        console.log("Message sent by bot, ignoring...");
        return;
      }

      if (conversation.assignee_ids?.length || conversation.assignee_group_id) {
        console.log("Message assigned to someone else, ignoring...");
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
    }, 60_000);
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
      const conversationId = conversation?.id;
      const customerId = conversation?.customers?.[0]?.id || "";

      if (!pageId || !conversationId || !customerId) {
        console.warn("Missing get messages params:", {
          pageId,
          conversationId,
          customerId,
        });
        return;
      }

      const { messages } = await this.pancakeApiService.getMessages({
        pageId,
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

      const salePrompt = this.pagePrompts[pageId] ?? null;

      const response = await this.getResponseFromOpenAI({
        conversationId,
        messages: historyMessage,
        salePrompt,
      });

      if (!response.length) {
        console.log("No response from OpenAI");
        return;
      }

      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      response.forEach(async (item) => {
        if (item.content === "no_response") {
          console.log("no_response");
          return;
        }

        const sentences = item.content
          .split(".")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const sentence of sentences) {
          await this.pancakeApiService.sendInbox({
            data: {
              message: sentence.replace(/(\\n)+/g, "\r\n"),
            },
            pageId,
            conversationId,
            accessToken,
          });
          await delay(100);
        }
      });
    } catch (error: any) {
      console.error("Error send back message :", error.message);
    }
  }

  private async getResponseFromOpenAI(request: {
    conversationId: string;
    messages: HistoryItem[];
    salePrompt?: string | null;
  }): Promise<{ content: string; attach_files: string[] }[]> {
    const { messages, salePrompt } = request;
    try {
      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [
          {
            role: "system",
            content: `${salePrompt}`,
          },
        ];

      for (const m of messages) {
        chatMessages.push({
          role: m.type === "human" ? "user" : "assistant",
          content: m.message,
        });
      }

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: chatMessages,
      });

      const content =
        completion.choices[0]?.message?.content?.toString().trim() || "";

      if (!content) {
        return [];
      }

      return [
        {
          content,
          attach_files: [],
        },
      ];
    } catch (error: any) {
      console.error("Error when get response from OpenAI:", error.message);
      return [];
    }
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
    while (tokens.length > 0) {
      const randomIndex = Math.floor(Math.random() * tokens.length);
      const accessToken = tokens[randomIndex];
      // console.log("accessToken:", accessToken);
      try {
        const pancakePages = await this.pancakeApiService.listPage({
          accessToken,
        });
        const checkActivedPages =
          await this.pancakeApiService.checkActivedPages({
            accessToken,
            pageIds: pancakePages?.categorized?.activated_page_ids || [],
          });
        // console.log("checkActivedPages:", checkActivedPages);
        let activePages = checkActivedPages.success
          ? pancakePages?.categorized?.activated
          : pancakePages?.categorized?.activated?.filter(({ id }) => {
              const errorPageIds =
                checkActivedPages?.errors?.map(({ page_id }: any) => page_id) ||
                [];
              return !errorPageIds.includes(id);
            });
        // console.log("activePages:", activePages);
        if (!Array.isArray(activePages)) {
          activePages = [];
        }

        if (!activePages.length) {
          process.exit(1);
        }

        return {
          accessToken,
          activePages,
        };
      } catch (error: any) {
        console.error("Error when get random access token:", error.message);
        tokens.splice(randomIndex, 1);
        this.accessTokens = this.accessTokens.filter((t) => t !== accessToken);
        console.warn(`AccessToken died and removed: ${accessToken}`);
      }
    }
    console.error("No alive access token found");
    process.exit(1);
  }
}
