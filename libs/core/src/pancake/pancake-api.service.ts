import { Injectable } from "@nestjs/common";
import axios from "axios";
import {
  CheckActivedPages,
  GetMessagesDto,
  ListPageDto,
  MarkSeenDto,
  SendInboxDto,
} from "./pancake-api.dto";

@Injectable()
export class PancakeApiService {
  async listPage({ accessToken }: ListPageDto): Promise<any> {
    try {
      const response = await axios.get("https://pages.fm/api/v1/pages", {
        params: { access_token: accessToken },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching list of pages:", error.message);
      throw new Error("Failed to fetch list of pages");
    }
  }

  async getMessages({
    pageId,
    conversationId,
    accessToken,
    customerId,
    currentCount,
  }: GetMessagesDto): Promise<any> {
    try {
      const apiUrl = `https://pages.fm/api/v1/pages/${pageId}/conversations/${conversationId}/messages`;
      const response = await axios.get(apiUrl, {
        params: {
          access_token: accessToken,
          customer_id: customerId,
          ...(currentCount && { current_count: currentCount }),
        },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching messages:", error.message);
      throw new Error("Failed to fetch messages");
    }
  }

  async markSeen({
    pageId,
    conversationId,
    accessToken,
  }: MarkSeenDto): Promise<any> {
    const apiUrl = `https://pancake.vn/api/v1/pages/${pageId}/conversations/${conversationId}/read?page_access_token=${accessToken}`;
    try {
      const response = await axios.post(apiUrl);
      return response?.data;
    } catch (error: any) {
      console.error("Error marking conversation as seen:", error.message);
      throw new Error("Failed to mark conversation as seen");
    }
  }

  async sendInbox({
    data,
    pageId,
    conversationId,
    accessToken,
  }: SendInboxDto): Promise<any> {
    try {
      const apiUrl = `https://pancake.vn/api/v1/pages/${pageId}/conversations/${conversationId}/messages?access_token=${accessToken}`;
      const response = await axios.post(apiUrl, {
        action: "reply_inbox",
        send_by_platform: "web",
        ...data,
      });
      return response.data;
    } catch (error: any) {
      console.error("Error sending inbox message:", error.message);
      throw new Error("Failed to send inbox message");
    }
  }

  async checkActivedPages({
    accessToken,
    pageIds,
  }: CheckActivedPages): Promise<any> {
    const apiUrl = `https://pancake.vn/api/v1/sip_subscriptions/extensions?access_token=${accessToken}`;
    const body = new URLSearchParams();
    body.set("page_ids", pageIds.join(","));
    try {
      const response = await axios.post(apiUrl, body, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error checking active pages:", error.message);
      throw new Error("Failed to check active pages");
    }
  }

  async markUnread({
    pageId,
    conversationId,
    accessToken,
  }: MarkSeenDto): Promise<any> {
    const apiUrl = `https://pancake.vn/api/v1/pages/${pageId}/conversations/${conversationId}/unread?access_token=${accessToken}`;
    try {
      const response = await axios.post(apiUrl);
      return response?.data;
    } catch (error: any) {
      console.error("Error marking conversation as unread:", error.message);
      throw new Error("Failed to mark conversation as unread");
    }
  }

  async generatePageAccessToken({
    accessToken,
    pageId,
  }: {
    accessToken: string;
    pageId: string;
  }): Promise<any> {
    try {
      const apiUrl = `https://pages.fm/api/v1/pages/${pageId}/generate_page_access_token?access_token=${accessToken}`;
      const response = await axios.post(apiUrl);
      return response?.data;
    } catch (error: any) {
      console.error("Error generating page access token:", error.message);
      throw new Error("Failed to generate page access token");
    }
  }
}
