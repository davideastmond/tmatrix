export type ChatSenderRole = "player1" | "player2";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderRole: ChatSenderRole;
  senderName: string;
  text: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}
