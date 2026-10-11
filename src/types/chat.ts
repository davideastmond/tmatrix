import { PlayerId } from "@/types/game";
export type ChatSenderRole = PlayerId;

export interface ChatMessage {
  id: string;
  roomId: string;
  senderRole: ChatSenderRole;
  senderName: string;
  text: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}
