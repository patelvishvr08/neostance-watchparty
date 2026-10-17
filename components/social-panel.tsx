"use client";
import { useState, useRef, useEffect } from "react";
import {
  Users,
  MessageCircle,
  ListVideo,
  BarChart3,
  Plus,
  Play,
  ChevronUp,
  ChevronDown,
  X,
  Send,
  CheckCircle2,
  Crown,
  Link2,
  LockKeyhole,
  LogOut,
} from "lucide-react";
import { Avatar } from "./ui";
import { emojis, time } from "../core/format";
import type { Room, RoomAction, ModalKind } from "../core/types";
export function SocialPanel({
  room,
  localNow,
  tab,
  onTab,
  act,
  openModal,
  onBrowse,
  onLeave,
}: {
  room: Room;
  localNow: number;
  tab: string;
  onTab: (tab: string) => void;
  act: RoomAction;
  openModal: (kind: ModalKind) => void;
  onBrowse: () => void;
  onLeave: () => void;
}) {
  const [message, setMessage] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const isHost = room.hostId === room.memberId;
  const canControl = isHost || !room.settings.hostOnly;
  const online = room.members.filter(
    (m) => m.online && localNow - m.lastSeen < 30000,
  );
  const media = room.playback.media;
  useEffect(() => {
    if (tab === "chat")
      chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [room.messages.length, tab]);
  return (
    <aside className="social-panel">
      <div className="social-heading">
        <span>
          Your people<span className="amber">.</span>
        </span>
        <span className="live-label">
          <span className="status-dot" />
          {online.length} online
        </span>
      </div>
      <nav className="social-tabs" aria-label="Room panels">
        {[
          { id: "chat", label: "Chat", icon: MessageCircle },
          { id: "queue", label: "Queue", icon: ListVideo },
          { id: "poll", label: "Poll", icon: BarChart3 },
          { id: "people", label: "People", icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => onTab(id)}
          >
            <Icon size={16} />
            {label}
            {id === "poll" && room.poll && !room.poll.closed && (
              <span className="tab-dot" />
            )}
          </button>
        ))}
      </nav>
      {tab === "chat" && (
        <>
          <div
            className="chat-messages"
            role="log"
            aria-label="Room chat"
            aria-live="polite"
          >
            {room.messages.filter((m) => !m.system).length === 0 && (
              <div className="chat-welcome">
                <span className="popcorn">🍿</span>
                <h3>The best seat is together.</h3>
                <p>
                  Hot takes, plot twists, terrible jokes.
                  <br />
                  This is your corner of the cinema.
                </p>
                <span>YOUR CHAT STAYS IN THIS ROOM</span>
              </div>
            )}
            {room.messages.map((m) =>
              m.system ? (
                <p className="system-message" key={m.id}>
                  {m.text}
                </p>
              ) : (
                <div
                  className={`chat-message ${m.memberId === room.memberId ? "own" : ""}`}
                  key={m.id}
                >
                  <div className="message-meta">
                    <strong>
                      {m.memberId === room.memberId ? "You" : m.name}
                    </strong>
                    <span>{time(m.position || 0)} into the film</span>
                  </div>
                  <p>{m.text}</p>
                </div>
              ),
            )}
            <div ref={chatEnd} />
          </div>
          <div className="chat-composer-wrap">
            <div className="chat-mini-reactions">
              {emojis.slice(0, 4).map((e) => (
                <button
                  key={e}
                  onClick={() => act({ type: "reaction", emoji: e })}
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
              <span>Make some noise.</span>
            </div>
            <form
              className="chat-composer"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!message.trim()) return;
                const sent = message;
                setMessage("");
                const result = await act({
                  type: "message",
                  text: sent,
                });
                if (!result) setMessage(sent);
              }}
            >
              <input
                maxLength={500}
                aria-label="Message the room"
                placeholder="Say the thing…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button disabled={!message.trim()} aria-label="Send message">
                <Send size={17} />
              </button>
            </form>
            <p className="composer-note">Enter to send. Kindness always.</p>
          </div>
        </>
      )}
      {tab === "queue" && (
        <div className="panel-scroll">
          <div className="panel-intro">
            <h3>The night’s lineup</h3>
            <p>
              Everyone can add.{" "}
              {room.settings.hostOnly
                ? "The host picks what plays."
                : "Everyone can run the screen."}
            </p>
          </div>
          {room.queue.map((film, i) => (
            <div className="queue-item" key={film.id}>
              <img src={film.poster || "/media/orbit.jpg"} alt="" />
              <div>
                <strong>{film.title}</strong>
                <small>
                  {film.id === media?.id
                    ? "Now showing"
                    : film.addedBy
                      ? `Added by ${film.addedBy}`
                      : film.category}
                </small>
                <div className="queue-actions">
                  <button
                    disabled={!canControl}
                    onClick={() => act({ type: "select", id: film.id })}
                  >
                    <Play size={12} /> Play
                  </button>
                  <button
                    aria-label={`Move ${film.title} up`}
                    disabled={!canControl || i === 0}
                    onClick={() =>
                      act({
                        type: "queue-move",
                        id: film.id,
                        direction: "up",
                      })
                    }
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    aria-label={`Move ${film.title} down`}
                    disabled={!canControl || i === room.queue.length - 1}
                    onClick={() =>
                      act({
                        type: "queue-move",
                        id: film.id,
                        direction: "down",
                      })
                    }
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    aria-label={`Remove ${film.title}`}
                    disabled={!canControl}
                    onClick={() => act({ type: "queue-remove", id: film.id })}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            className="button button-outline full-width"
            onClick={() => {
              onBrowse();
            }}
          >
            <Plus size={16} /> Add to the lineup
          </button>
        </div>
      )}
      {tab === "poll" && (
        <div className="panel-scroll">
          {room.poll ? (
            <>
              <div className="poll-label">
                <BarChart3 size={17} />
                {room.poll.closed
                  ? "THE ROOM HAS SPOKEN"
                  : "A LITTLE DEMOCRACY"}
              </div>
              <h3 className="poll-question">{room.poll.question}</h3>
              <p className="panel-description">
                {room.poll.closed
                  ? "Voting is closed."
                  : "One friend, one vote. Change your mind anytime."}
              </p>
              <div className="poll-options">
                {room.poll.options.map((option, i) => {
                  const votes = Object.values(room.poll!.votes),
                    count = votes.filter((v) => v === i).length,
                    percent = votes.length
                      ? Math.round((count / votes.length) * 100)
                      : 0,
                    mine = room.poll!.votes[room.memberId] === i;
                  return (
                    <button
                      key={i}
                      className={mine ? "voted" : ""}
                      disabled={room.poll!.closed}
                      onClick={() => act({ type: "vote", option: i })}
                    >
                      <span
                        className="vote-fill"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="vote-name">
                        {mine ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <span className="vote-circle" />
                        )}
                        {option}
                      </span>
                      <span className="vote-result">
                        {percent}%{" "}
                        <small>
                          {count} vote{count !== 1 ? "s" : ""}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="poll-total">
                {Object.keys(room.poll.votes).length} friend
                {Object.keys(room.poll.votes).length !== 1 ? "s" : ""} voted
              </p>
              {isHost && (
                <div className="poll-host-actions">
                  {!room.poll.closed && (
                    <button
                      className="button button-outline"
                      onClick={() => act({ type: "poll-close" })}
                    >
                      Close voting
                    </button>
                  )}
                  <button
                    className="text-button amber"
                    onClick={() => openModal("poll")}
                  >
                    New poll <Plus size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="panel-empty">
              <BarChart3 size={32} />
              <h3>Let the room decide.</h3>
              <p>
                What’s next? Snack break? The most questionable character? Put
                it to a vote.
              </p>
              {isHost ? (
                <button
                  className="button button-amber"
                  onClick={() => openModal("poll")}
                >
                  Start a poll <Plus size={15} />
                </button>
              ) : (
                <span className="muted">Ask your host to start a poll.</span>
              )}
            </div>
          )}
        </div>
      )}
      {tab === "people" && (
        <div className="panel-scroll">
          <div className="panel-intro">
            <h3>Good company</h3>
            <p>{online.length} here. Up to 50 seats per room.</p>
          </div>
          {room.members.map((member) => (
            <div className="member-row" key={member.id}>
              <Avatar member={member} host={room.hostId === member.id} />
              <div>
                <strong>
                  {member.name}
                  {member.id === room.memberId && (
                    <span className="muted"> (you)</span>
                  )}
                </strong>
                <small>
                  {room.hostId === member.id
                    ? "Host"
                    : member.online && localNow - member.lastSeen < 30000
                      ? "Here for the story"
                      : "Away · reconnecting"}
                </small>
              </div>
              {isHost && member.id !== room.memberId && (
                <div className="member-actions">
                  <button
                    className="icon-button"
                    title="Make host"
                    aria-label={`Make ${member.name} the host`}
                    onClick={() => {
                      if (
                        confirm(
                          `Pass the remote to ${member.name}? They will become the host.`,
                        )
                      )
                        act({ type: "transfer", id: member.id });
                    }}
                  >
                    <Crown size={15} />
                  </button>
                  <button
                    className="icon-button"
                    title="Remove from room"
                    aria-label={`Remove ${member.name} from room`}
                    onClick={() => {
                      if (confirm(`Remove ${member.name} from this room?`))
                        act({ type: "kick", id: member.id });
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            className="button button-outline full-width"
            onClick={() => openModal("invite")}
          >
            <Link2 size={16} /> Bring another friend
          </button>
          <div className="host-note">
            <Crown size={18} />
            <p>
              {isHost
                ? "You have the remote."
                : `${room.members.find((m) => m.id === room.hostId)?.name || "Your host"} has the remote.`}
              <small>
                If the host disconnects for 30 seconds, the longest-connected
                active friend takes over.
              </small>
            </p>
          </div>
        </div>
      )}
      <div className="social-bottom">
        <span>
          <LockKeyhole size={12} /> ROOM <strong>{room.code}</strong>
        </span>
        <button
          className="text-button"
          onClick={() => {
            if (
              confirm(
                "Leave this movie night? You can return using your room code.",
              )
            ) {
              act({ type: "leave" }, true);
              onLeave();
            }
          }}
        >
          <LogOut size={13} /> Leave
        </button>
      </div>
    </aside>
  );
}
