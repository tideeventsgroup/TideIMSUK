export type MessageChannelKey = 'OPS' | 'SECURITY' | 'STEWARDS' | 'MEDICAL';

export interface Message {
  id: string;
  channel: MessageChannelKey;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: string;
}
