import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, BellOff, Building2, Heart, BookOpen, ChevronRight } from "lucide-react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useNotificationInbox,
  useMarkNotificationRead,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushSubscription,
  getPushPermission,
} from "@/lib/push-api";

export default function NotificationSettingsPage() {
  const [, navigate] = useLocation();
  const { data: prefs, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const { data: inbox } = useNotificationInbox();
  const markRead = useMarkNotificationRead();

  const [permissionState, setPermissionState] = useState<NotificationPermission | "unknown">("unknown");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [tab, setTab] = useState<"settings" | "inbox">("settings");

  useEffect(() => {
    void (async () => {
      if ("Notification" in window) setPermissionState(Notification.permission);
      const sub = await getCurrentPushSubscription();
      setIsSubscribed(!!sub);
    })();
  }, []);

  async function handleEnablePush() {
    setSubscribeLoading(true);
    try {
      const sub = await subscribeToPush();
      setIsSubscribed(!!sub);
      if (sub) setPermissionState("granted");
      else {
        const p = await getPushPermission();
        setPermissionState(p);
      }
    } finally { setSubscribeLoading(false); }
  }

  async function handleDisablePush() {
    setSubscribeLoading(true);
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
    } finally { setSubscribeLoading(false); }
  }

  function toggle(key: keyof typeof prefs, val: boolean) {
    if (!prefs) return;
    update.mutate({ [key]: val });
  }

  const unreadCount = inbox?.filter(n => !n.read).length ?? 0;

  return (
    <div className="px-4 pt-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/profile")}
          className="p-2 rounded-xl transition active:scale-90"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <ArrowLeft style={{ width: 18, height: 18, color: "var(--text-main)" }} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Notifications</h1>
          <p className="text-xs" style={{ color: "var(--text-sub)" }}>Control what pings you and when</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {(["settings", "inbox"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "#fff" : "var(--text-sub)",
            }}>
            {t === "settings" ? "Settings" : `Inbox${unreadCount ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <>
          {/* Push permission banner */}
          <div className="rounded-2xl p-4 mb-5"
            style={{ background: isSubscribed ? "rgba(74,222,128,0.08)" : "var(--glass-bg)", border: `1px solid ${isSubscribed ? "rgba(74,222,128,0.3)" : "var(--glass-border)"}` }}>
            <div className="flex items-center gap-3">
              {isSubscribed
                ? <Bell style={{ width: 20, height: 20, color: "#4ade80" }} />
                : <BellOff style={{ width: 20, height: 20, color: "var(--text-dim)" }} />}
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                  {isSubscribed ? "Notifications active" : "Enable push notifications"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>
                  {isSubscribed
                    ? "ERA can send reminders to this device"
                    : permissionState === "denied"
                    ? "Blocked in browser — enable in your browser settings"
                    : "Get reminders even when ERA tab is closed"}
                </p>
              </div>
              {permissionState !== "denied" && (
                <button
                  onClick={isSubscribed ? () => { void handleDisablePush(); } : () => { void handleEnablePush(); }}
                  disabled={subscribeLoading}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95"
                  style={{
                    background: isSubscribed ? "rgba(239,68,68,0.15)" : "var(--accent)",
                    color: isSubscribed ? "#f87171" : "#fff",
                    border: isSubscribed ? "1px solid rgba(239,68,68,0.3)" : "none",
                  }}>
                  {subscribeLoading ? "…" : isSubscribed ? "Turn off" : "Turn on"}
                </button>
              )}
            </div>
            {isSubscribed && (
              <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--text-dim)" }}>
                iPhone users: add ERA to Home Screen for full push support
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-10" style={{ color: "var(--text-dim)" }}>Loading…</div>
          ) : (
            <div className="space-y-4">
              {/* Hospital notifications */}
              <NotifSection
                icon={<Building2 style={{ width: 16, height: 16, color: "var(--accent)" }} />}
                title="Hospital Messages"
                description="Reminders and updates sent by your hospital team"
                enabled={prefs?.hospitalEnabled ?? true}
                onToggle={(v) => toggle("hospitalEnabled", v)}
              />

              {/* Personal health reminders */}
              <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Heart style={{ width: 16, height: 16, color: "var(--accent)" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Personal Health Reminders</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>Fires before checklist actions are due</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={prefs?.personalEnabled ?? true}
                    onToggle={(v) => toggle("personalEnabled", v)} />
                </div>

                {(prefs?.personalEnabled ?? true) && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
                    <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Remind me this many minutes before</p>
                    <div className="flex gap-2">
                      {([5, 10] as const).map((mins) => (
                        <button key={mins} onClick={() => update.mutate({ leadMins: mins })}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
                          style={{
                            background: (prefs?.leadMins ?? 10) === mins ? "var(--accent)" : "transparent",
                            color: (prefs?.leadMins ?? 10) === mins ? "#fff" : "var(--text-sub)",
                            border: (prefs?.leadMins ?? 10) === mins ? "none" : "1.5px solid var(--glass-border)",
                          }}>
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Companion */}
              <NotifSection
                icon={<BookOpen style={{ width: 16, height: 16, color: "var(--accent)" }} />}
                title="Diary & Companion"
                description="Evening nudge if you haven't checked in that day"
                enabled={prefs?.companionEnabled ?? true}
                onToggle={(v) => toggle("companionEnabled", v)}
              />
            </div>
          )}
        </>
      ) : (
        /* Inbox tab */
        <div className="space-y-2">
          {!inbox?.length ? (
            <div className="text-center py-16" style={{ color: "var(--text-dim)" }}>
              <Bell style={{ width: 32, height: 32, margin: "0 auto 8px", opacity: 0.3 }} />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : inbox.map((notif) => (
            <button key={notif.id} onClick={() => {
              if (!notif.read) markRead.mutate(notif.id);
              if (notif.url) navigate(notif.url);
            }}
              className="w-full text-left rounded-2xl p-4 transition active:scale-[0.99]"
              style={{
                background: notif.read ? "var(--glass-bg)" : "var(--accent-tint-bg)",
                border: `1px solid ${notif.read ? "var(--glass-border)" : "var(--accent-tint-border)"}`,
              }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {!notif.read && (
                    <div className="w-1.5 h-1.5 rounded-full mb-1.5" style={{ background: "var(--accent)" }} />
                  )}
                  <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{notif.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>{notif.body}</p>
                  <p className="text-[10px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                    {new Date(notif.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {notif.url && <ChevronRight style={{ width: 14, height: 14, color: "var(--text-dim)", flexShrink: 0 }} />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotifSection({ icon, title, description, enabled, onToggle }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      {icon}
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>{description}</p>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} />
    </div>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button onClick={() => onToggle(!enabled)}
      className="relative shrink-0 transition active:scale-90"
      style={{ width: 44, height: 26, borderRadius: 999, background: enabled ? "var(--accent)" : "var(--glass-border)" }}>
      <span className="absolute top-[3px] transition-all duration-200"
        style={{ left: enabled ? "calc(100% - 23px)" : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", display: "block" }} />
    </button>
  );
}
