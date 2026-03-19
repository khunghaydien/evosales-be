export interface ListPageDto {
  accessToken: string;
}

export interface GetMessagesDto {
  pageId: string;
  conversationId: string;
  accessToken: string;
  customerId: string;
  currentCount?: number;
}

export interface MarkSeenDto {
  pageId: string;
  conversationId: string;
  accessToken: string;
}

export interface SendInboxDto {
  pageId: string;
  conversationId: string;
  accessToken: string;
  data: Record<string, any>;
}

export interface CheckActivedPages {
  accessToken: string;
  pageIds: string[];
}
