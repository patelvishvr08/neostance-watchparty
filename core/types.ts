import type { catalog } from "./catalog.mjs";

export type FilmData = (typeof catalog)[number] & { addedBy?: string };
export type Member = {
  id: string;
  name: string;
  online: boolean;
  joinedAt: number;
  lastSeen: number;
  ready?: boolean;
};
export type Room = {
  code: string;
  title: string;
  hostId: string;
  memberId: string;
  createdAt: number;
  revision: number;
  closed: boolean;
  serverNow: number;
  settings: { hostOnly: boolean; locked: boolean };
  playback: {
    media: FilmData;
    position: number;
    playing: boolean;
    updatedAt: number;
    changedBy: string;
  };
  queue: FilmData[];
  members: Member[];
  messages: {
    id: string;
    text: string;
    system?: boolean;
    memberId?: string;
    name?: string;
    at: number;
    position?: number;
  }[];
  reactions: { id: string; emoji: string; name: string; at: number }[];
  poll: null | {
    id: string;
    question: string;
    options: string[];
    votes: Record<string, number>;
    closed: boolean;
  };
};
export type Session = { code: string; token: string };
export type ApiResult = { room: Room; token: string; error?: string };
export type ModalKind =
  | null
  | "create"
  | "join"
  | "invite"
  | "settings"
  | "library"
  | "poll"
  | "about";
export type Connection = "connecting" | "live" | "reconnecting" | "offline";

export type RoomAction = (
  action: Record<string, unknown>,
  quiet?: boolean,
) => Promise<Room | null>;
