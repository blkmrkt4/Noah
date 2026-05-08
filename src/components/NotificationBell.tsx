"use client";

import { useEffect, useRef, useState } from "react";

interface Notification {
  id: string;
  type: string;
  channel: string;
  digestPayload: Record<string, unknown> | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function load() {
    const res = await fetch(`/api/notifications?userId=${userId}`);
    if (res.ok) setItems(await res.json());
  }

  async function markAllRead() {
    if (items.length === 0) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: items.map((n) => n.id) }),
    });
    await load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1 text-ey-light-gray hover:text-ey-yellow transition-colors"
        aria-label="Notifications"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-ey-yellow text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-ey-black border border-ey-sonic-silver/40 rounded-lg shadow-xl z-20">
          <div className="px-3 py-2 border-b border-ey-dark-gray flex items-center justify-between">
            <span className="text-xs font-semibold text-ey-yellow uppercase tracking-wider">
              Notifications
            </span>
            {items.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-ey-sonic-silver hover:text-ey-yellow transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ey-sonic-silver">
                No unread notifications.
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    className="px-3 py-2 border-b border-ey-dark-gray/60 last:border-b-0 text-xs"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-semibold text-ey-yellow">{n.type}</span>
                      <span className="text-ey-sonic-silver text-[10px] shrink-0">
                        {n.deliveredAt
                          ? new Date(n.deliveredAt).toLocaleString()
                          : "queued"}
                      </span>
                    </div>
                    {n.digestPayload && (
                      <pre className="text-ey-light-gray whitespace-pre-wrap font-mono text-[11px]">
                        {JSON.stringify(n.digestPayload, null, 2).slice(0, 240)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
