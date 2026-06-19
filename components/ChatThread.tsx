"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatRole } from "@/lib/db";
import { Button, cx } from "./ui";

type UiMessage = ChatMessage & { pending?: boolean };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? t : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${t}`;
}

/**
 * Shared chat thread (retailer + admin). Polls for new messages every 5s, sends optimistically
 * ("Sending…" → "Sent" → "Read"), and marks the conversation read when the latest message is
 * from the other party. For the retailer the conversation is created lazily on first send.
 */
export function ChatThread({
  role,
  conversationId: initialConvId,
  initialMessages,
  initialPeerReadAt = null,
  header,
  onActivity,
}: {
  role: ChatRole;
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialPeerReadAt?: string | null;
  header?: React.ReactNode;
  onActivity?: () => void;
}) {
  const [convId, setConvId] = useState(initialConvId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, setPending] = useState<UiMessage[]>([]);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(initialPeerReadAt);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastReadId = useRef<string | null>(null);
  const bottomPinned = useRef(true);
  const tmpSeq = useRef(0);

  const getUrl = role === "admin" && convId ? `/api/messages?conversationId=${convId}` : "/api/messages";

  const all: UiMessage[] = [...messages, ...pending];
  const lastMineId = [...all].reverse().find((m) => m.senderRole === role)?.id ?? null;

  const markRead = useCallback(async () => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.senderRole === role || latest.id === lastReadId.current) return;
    lastReadId.current = latest.id;
    await fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(convId ? { conversationId: convId } : {}),
    }).catch(() => {});
    onActivity?.();
  }, [messages, role, convId, onActivity]);

  // Poll while mounted; also refresh on tab focus.
  useEffect(() => {
    if (role === "admin" && !convId) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(getUrl, { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (!alive) return;
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if ("peerLastReadAt" in data) setPeerReadAt(data.peerLastReadAt ?? null);
        if (data.conversationId && !convId) setConvId(data.conversationId);
      } catch {
        /* transient — next tick retries */
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [getUrl, role, convId]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  // Keep pinned to newest unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && bottomPinned.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    bottomPinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    const tmpId = `tmp-${tmpSeq.current++}`;
    setBusy(true);
    setErr(null);
    setText("");
    bottomPinned.current = true;
    // Optimistic bubble.
    setPending((p) => [
      ...p,
      { id: tmpId, conversationId: convId ?? "", senderId: "", senderRole: role, body, createdAt: new Date().toISOString(), pending: true },
    ]);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role === "admin" ? { conversationId: convId, body } : { body }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Failed to send");
      if (data.conversationId && !convId) setConvId(data.conversationId);
      if (data.message) setMessages((m) => [...m, data.message as ChatMessage]);
      setPending((p) => p.filter((x) => x.id !== tmpId));
      onActivity?.();
    } catch (e) {
      setPending((p) => p.filter((x) => x.id !== tmpId));
      setText(body); // restore so the user can retry
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (role === "admin" && !convId) {
    return (
      <div className="flex h-[70dvh] items-center justify-center rounded-2xl border border-line bg-surface text-sm text-muted md:h-[68vh]">
        Select a conversation to view the thread.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface md:h-[68vh]">
      {header && <div className="shrink-0 border-b border-line px-4 py-3">{header}</div>}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {all.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-brass-soft text-xl">💬</div>
            <p className="text-sm font-medium text-ink">
              {role === "retailer" ? "Start a conversation" : "No messages yet"}
            </p>
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">
              {role === "retailer"
                ? "Ask us anything about products, pricing, lead times, or your orders — we'll reply right here."
                : "Replies you send will appear here."}
            </p>
          </div>
        ) : (
          all.map((m) => {
            const mine = m.senderRole === role;
            const status = m.pending
              ? "Sending…"
              : mine && m.id === lastMineId
                ? peerReadAt && new Date(peerReadAt) >= new Date(m.createdAt)
                  ? "Read"
                  : "Sent"
                : null;
            return (
              <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                <div className="max-w-[82%] sm:max-w-[70%]">
                  <div
                    className={cx(
                      "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      mine
                        ? cx("rounded-br-md bg-ink text-white", m.pending && "opacity-70")
                        : "rounded-bl-md border border-line bg-[#faf9f5] text-ink"
                    )}
                  >
                    {m.body}
                  </div>
                  <div className={cx("mt-1 px-1 text-[10.5px] text-muted", mine ? "text-right" : "text-left")}>
                    {fmtTime(m.createdAt)}
                    {status && (
                      <span className={cx(status === "Read" && "text-brass")}> · {status}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 py-3">
        {err && <p className="mb-2 text-[12px] text-red-500">{err}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Type a message…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink"
          />
          <Button variant="primary" busy={busy} disabled={!text.trim()} className="h-[44px] px-5" onClick={send}>
            Send
          </Button>
        </div>
        <p className="mt-1.5 hidden px-1 text-[11px] text-muted sm:block">
          Press <span className="font-medium">Enter</span> to send · <span className="font-medium">Shift+Enter</span> for a new line
        </p>
      </div>
    </div>
  );
}
