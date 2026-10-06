"use client";

import type { ChatMessage, ChatSenderRole } from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatDrawerProps {
  roomId: string;
  yourRole: ChatSenderRole;
  displayName: string;
  /** Render/poll only once the parent has loaded the room. */
  enabled: boolean;
}

const POLL_INTERVAL_MS = 2500;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function ChatDrawer({
  roomId,
  yourRole,
  displayName,
  enabled,
}: ChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);

  // Cursor for incremental polling (ISO timestamp of newest message seen).
  const lastSeenRef = useRef<string | null>(null);
  // Newest message the user has actually looked at (for unread counting).
  const lastReadRef = useRef<string>(new Date(0).toISOString());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const openRef = useRef(open);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Mirror `open` for use inside polling callbacks without re-subscribing.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    const fresh = incoming.filter((m) => !seenIdsRef.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => seenIdsRef.current.add(m.id));

    setMessages((prev) => [...prev, ...fresh].slice(-100));

    const latest = fresh[fresh.length - 1].createdAt;
    lastSeenRef.current = latest;

    if (!openRef.current) {
      const newOnes = fresh.filter(
        (m) => m.senderRole !== yourRole && m.createdAt > lastReadRef.current,
      ).length;
      if (newOnes > 0) setUnread((u) => u + newOnes);
    } else {
      lastReadRef.current = latest;
    }
  }, [yourRole]);

  const fetchMessages = useCallback(async () => {
    try {
      const since = lastSeenRef.current
        ? `?since=${encodeURIComponent(lastSeenRef.current)}`
        : "";
      const res = await fetch(`/api/rooms/${roomId}/chat${since}`);
      if (!res.ok) return;
      const data = await res.json();
      const incoming: ChatMessage[] = Array.isArray(data.messages)
        ? data.messages
        : [];
      mergeMessages(incoming);
    } catch {
      // Transient network failure: the next poll will retry.
    }
  }, [roomId, mergeMessages]);

  // Poll for new messages while the room is active.
  useEffect(() => {
    if (!enabled) return;
    fetchMessages();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchMessages();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, fetchMessages]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setUnread(0);
      if (lastSeenRef.current) lastReadRef.current = lastSeenRef.current;
    }
  };

  // Keep the message list pinned to the bottom while the drawer is open.
  useEffect(() => {
    const el = listRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500) }),
      });
      if (!res.ok) throw new Error("send failed");
      const data = await res.json();
      if (data.message) mergeMessages([data.message as ChatMessage]);
      // Refresh immediately so the other player's messages arrive faster too.
      fetchMessages();
    } catch {
      // Restore the draft so nothing the user typed is lost.
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => handleOpenChange(!open)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        <ChatIcon />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => handleOpenChange(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer: bottom sheet on mobile, right panel on desktop */}
      <aside
        aria-hidden={!open}
        className={`fixed z-50 flex flex-col bg-slate-800 shadow-2xl transition-transform duration-300 ease-out
          inset-x-0 bottom-0 h-[75vh] rounded-t-2xl border-t border-slate-700
          md:inset-y-0 md:right-0 md:left-auto md:top-0 md:h-auto md:w-[360px] md:rounded-none md:border-t-0 md:border-l md:border-slate-700
          ${
            open
              ? "translate-y-0 md:translate-x-0"
              : "translate-y-full md:translate-y-0 md:translate-x-full pointer-events-none"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
              Match Chat
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Hide chat"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              No messages yet — say good luck!
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === yourRole;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      mine
                        ? "bg-emerald-600 text-white rounded-br-md"
                        : "bg-slate-700 text-slate-100 rounded-bl-md"
                    }`}
                  >
                    {!mine && (
                      <div className="mb-0.5 text-xs font-semibold text-slate-300">
                        {m.senderName}
                      </div>
                    )}
                    <div className="break-words whitespace-pre-wrap">
                      {m.text}
                    </div>
                    <div
                      className={`mt-1 text-right text-[10px] ${
                        mine ? "text-emerald-100/70" : "text-slate-400"
                      }`}
                    >
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t border-slate-700 px-3 py-3"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message as ${displayName}...`}
            maxLength={500}
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </aside>
    </>
  );
}
