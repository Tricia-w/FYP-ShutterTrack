import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  text: "var(--text, #0D1B3E)",
  muted: "var(--text-muted, #8892A4)",
  card: "var(--card, #FFFFFF)",
  soft: "var(--soft, #F6F8FF)",
  line: "var(--line, #EEF1F8)",
};

const PLAYER_DIRECTORY_TYPES = [
  "coach_request_received",
  "coach_removed_player",
  "coach_relationship_removed",
  "coach_request_accepted",
  "coach_request_declined",
  "coach_request_rejected",
  "partner_request_received",
  "partner_request_accepted",
  "partner_request_rejected",
  "partner_request_declined",
];

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isPlayerDirectoryNotification(item) {
  const type = normalise(item?.source_type || item?.type);
  const title = normalise(item?.title);
  const message = normalise(item?.message);

  if (PLAYER_DIRECTORY_TYPES.map(normalise).includes(type)) {
    return true;
  }

  const combined = `${title} ${message}`;

  return [
    "coach request",
    "coaching request",
    "coach relationship ended",
    "removed you from my players",
    "partner request",
  ].some(phrase => combined.includes(phrase));
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRoute(item) {
  const rawUrl = String(item?.action_url || "").trim();

  if (rawUrl) {
    const withoutOrigin = rawUrl.replace(/^https?:\/\/[^/]+/i, "");
    const normalised = withoutOrigin.replace(/^\/player(?=\/|$)/i, "");

    if (normalised) {
      return normalised.startsWith("/") ? normalised : `/${normalised}`;
    }
  }

  const type = normalise(item?.source_type || item?.type);

  if (type.includes("coach")) return "/players?tab=coach";
  if (type.includes("partner")) return "/players?tab=partner";
  if (type.includes("performance") || type.includes("progress")) return "/performance";
  if (type.includes("fitness") || type.includes("training")) return "/fitness";
  if (type.includes("club")) return "/clubs";

  return "";
}

function getTone(item) {
  const title = normalise(item?.title);
  const type = normalise(item?.type);

  if (
    type === "success" ||
    title.includes("accepted") ||
    title.includes("completed")
  ) {
    return {
      icon: "✅",
      background: "#ECFDF5",
      border: "#A7F3D0",
      iconBackground: "#DDF8EF",
      iconColor: "#059669",
    };
  }

  if (
    type === "warning" ||
    title.includes("declined") ||
    title.includes("cancelled") ||
    title.includes("missed")
  ) {
    return {
      icon: "⚠️",
      background: "#FFFBEB",
      border: "#FDE68A",
      iconBackground: "#FEF3C7",
      iconColor: "#D97706",
    };
  }

  if (
    type === "danger" ||
    title.includes("removed") ||
    title.includes("ended")
  ) {
    return {
      icon: "🔥",
      background: "#FEF2F2",
      border: "#FECACA",
      iconBackground: "#FEE2E2",
      iconColor: "#DC2626",
    };
  }

  return {
    icon: "🔔",
    background: "#EFF6FF",
    border: "#BFDBFE",
    iconBackground: "#E8EFFE",
    iconColor: "#1A5FFF",
  };
}

export default function NotificationBell({
  supabase,
  userId = null,
  title = "Notifications",
  sourceTypes = null,
  mode = "default",
  includePartnerRequests = false,
  onPartnerChanged,
  limit = 20,
  localItems = null,
  localOnly = false,
  onLocalMarkAllRead,
  onLocalClear,
  onLocalItemClick,
}) {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const notificationSoundRef = useRef(null);
  const soundEnabledRef = useRef(true);
  const [resolvedUserId, setResolvedUserId] = useState(userId);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sound = new Audio(
      "/shuttletrack-notification-tink.mp3"
    );

    sound.volume = 0.4;
    sound.preload = "auto";

    notificationSoundRef.current = sound;

    return () => {
      sound.pause();
      notificationSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      const sound = notificationSoundRef.current;
      if (!sound) return;

      const originalVolume = sound.volume;

      sound.volume = 0;
      sound.currentTime = 0;

      sound
        .play()
        .then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.volume = originalVolume || 0.4;
        })
        .catch(() => {});

      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };

    document.addEventListener("click", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);
    document.addEventListener("keydown", unlockAudio);

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabledRef.current) return;

    const sound = notificationSoundRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    sound.volume = 0.4;

    sound.play().catch(error => {
      console.log(
        "Notification sound was blocked by the browser:",
        error
      );
    });
  }, []);

  useEffect(() => {
    setResolvedUserId(userId || null);
  }, [userId]);

  const resolveUserId = useCallback(async () => {
    if (resolvedUserId) return resolvedUserId;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) return null;

    setResolvedUserId(user.id);
    return user.id;
  }, [resolvedUserId, supabase]);

  useEffect(() => {
    if (localOnly) return undefined;

    let active = true;

    const loadSoundSetting = async () => {
      const uid = await resolveUserId();
      if (!active || !uid) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("notification_sound_enabled")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        console.error(
          "Notification sound setting load error:",
          error
        );
        return;
      }

      soundEnabledRef.current =
        data?.notification_sound_enabled !== false;
    };

    const handleSoundSettingUpdated = event => {
      soundEnabledRef.current =
        event?.detail?.enabled !== false;
    };

    loadSoundSetting();

    window.addEventListener(
      "notification-sound-updated",
      handleSoundSettingUpdated
    );

    return () => {
      active = false;

      window.removeEventListener(
        "notification-sound-updated",
        handleSoundSettingUpdated
      );
    };
  }, [localOnly, resolveUserId, supabase]);

  const loadNotifications = useCallback(async () => {
    if (localOnly) {
      setLoading(false);
      return;
    }

    const uid = await resolveUserId();
    if (!uid) return;

    setLoading(true);

    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limit);


      const requestsQuery = includePartnerRequests
        ? supabase
            .from("player_partner_requests")
            .select("*")
            .eq("recipient_user_id", uid)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const [notificationResult, requestResult] = await Promise.all([
        query,
        requestsQuery,
      ]);

      if (notificationResult.error) {
        console.error("Notification load error:", notificationResult.error);
      } else {
        const rows = notificationResult.data || [];

        const filteredRows =
          mode === "players"
            ? rows.filter(isPlayerDirectoryNotification)
            : Array.isArray(sourceTypes) &&
                sourceTypes.length > 0
              ? rows.filter(item => {
                  const allowedTypes = sourceTypes.map(normalise);
                  const sourceType = normalise(item?.source_type);
                  const type = normalise(item?.type);

                  return (
                    allowedTypes.includes(sourceType) ||
                    allowedTypes.includes(type)
                  );
                })
              : rows;

        setItems(filteredRows);
      }

      if (requestResult.error) {
        console.error("Partner request load error:", requestResult.error);
      } else {
        setPartnerRequests(requestResult.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [
    includePartnerRequests,
    limit,
    localOnly,
    mode,
    resolveUserId,
    sourceTypes,
    supabase,
  ]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (localOnly) return undefined;

    let cancelled = false;
    let channel = null;

    const subscribe = async () => {
      const uid = await resolveUserId();
      if (!uid || cancelled) return;

      const nextChannel = supabase
        .channel(
          `shared-notifications-${uid}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          payload => {
            const newItem = payload?.new;
            const isInsert = payload?.eventType === "INSERT";

            const matchesCurrentView =
              mode === "players"
                ? isPlayerDirectoryNotification(newItem)
                : Array.isArray(sourceTypes) &&
                    sourceTypes.length > 0
                  ? sourceTypes
                      .map(normalise)
                      .some(type => {
                        const sourceType = normalise(
                          newItem?.source_type
                        );
                        const itemType = normalise(newItem?.type);

                        return (
                          type === sourceType ||
                          type === itemType
                        );
                      })
                  : true;

            if (isInsert && newItem && matchesCurrentView) {
              playNotificationSound();
            }

            loadNotifications();
          },
        );

      if (includePartnerRequests) {
        nextChannel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_partner_requests",
            filter: `recipient_user_id=eq.${uid}`,
          },
          payload => {
            if (payload?.eventType === "INSERT") {
              playNotificationSound();
            }

            loadNotifications();
            onPartnerChanged?.();
          },
        );
      }

      channel = nextChannel;
      nextChannel.subscribe();
    };

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [
    includePartnerRequests,
    loadNotifications,
    localOnly,
    mode,
    onPartnerChanged,
    playNotificationSound,
    resolveUserId,
    sourceTypes,
    supabase,
  ]);

  useEffect(() => {
    const closeOutside = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const displayedItems = Array.isArray(localItems)
    ? localItems
    : items;

  const unread =
    displayedItems.filter(item => !item.is_read).length +
    partnerRequests.length;

  const markAllRead = async event => {
    event.stopPropagation();

    if (localOnly) {
      onLocalMarkAllRead?.();
      return;
    }

    const uid = await resolveUserId();
    if (!uid || items.length === 0) return;

    const ids = items
      .filter(item => !item.is_read)
      .map(item => item.id);

    setItems(current =>
      current.map(item => ({ ...item, is_read: true })),
    );

    if (ids.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", uid)
      .in("id", ids);

    if (error) {
      console.error("Mark notifications read error:", error);
      loadNotifications();
    }
  };

  const clearAll = async event => {
    event.stopPropagation();

    if (localOnly) {
      onLocalClear?.();
      return;
    }

    const uid = await resolveUserId();
    if (!uid || items.length === 0) return;

    const ids = items.map(item => item.id);
    setItems([]);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", uid)
      .in("id", ids);

    if (error) {
      console.error("Clear notifications error:", error);
      loadNotifications();
    }
  };

  const deleteOne = async (event, id) => {
    event.stopPropagation();

    if (localOnly) {
      onLocalClear?.(id);
      return;
    }

    setItems(current => current.filter(item => item.id !== id));

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete notification error:", error);
      loadNotifications();
    }
  };

  const openNotification = async item => {
    if (localOnly) {
      onLocalItemClick?.(item);
      setOpen(false);
      return;
    }

    const uid = await resolveUserId();
    if (!uid) return;

    if (!item.is_read) {
      setItems(current =>
        current.map(row =>
          row.id === item.id ? { ...row, is_read: true } : row,
        ),
      );

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id)
        .eq("user_id", uid);
    }

    setOpen(false);

    const route = getRoute(item);
    if (route) navigate(route);
  };

  const respondToPartnerRequest = async (request, status) => {
    const { error } = await supabase
      .from("player_partner_requests")
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      console.error("Partner request update error:", error);
      return;
    }

    await loadNotifications();
    await onPartnerChanged?.();
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          setOpen(current => !current);
          loadNotifications();
        }}
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          border: `1px solid ${C.line}`,
          background: C.card,
          cursor: "pointer",
          fontSize: 19,
          display: "grid",
          placeItems: "center",
          position: "relative",
          boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
        }}
      >
        🔔

        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 19,
              height: 19,
              padding: "0 5px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#FFFFFF",
              border: "2px solid #FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={event => event.stopPropagation()}
          style={{
            position: "absolute",
            top: 52,
            right: 0,
            width: 430,
            maxWidth: "calc(100vw - 28px)",
            maxHeight: 560,
            overflowY: "auto",
            padding: 16,
            borderRadius: 22,
            border: `1px solid ${C.line}`,
            background: C.card,
            boxShadow: "0 22px 55px rgba(13,27,62,0.16)",
            zIndex: 3000,
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: C.text,
              }}
            >
              {title}
            </div>

            {displayedItems.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={markAllRead}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#1A5FFF",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: 0,
                  }}
                >
                  Mark read
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#EF4444",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading notifications...
            </div>
          ) : displayedItems.length === 0 && partnerRequests.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: C.muted,
                fontSize: 13,
              }}
            >
              No notifications yet.
            </div>
          ) : (
            <>
              {partnerRequests.map(request => (
                <div
                  key={`partner-${request.id}`}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 12,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: C.text,
                    }}
                  >
                    New partner request
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "#64748B",
                    }}
                  >
                    A player sent you a partner request.
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        respondToPartnerRequest(request, "rejected")
                      }
                      style={{
                        flex: 1,
                        border: "1px solid #FECACA",
                        borderRadius: 10,
                        background: "#FEF2F2",
                        color: "#DC2626",
                        padding: "8px 10px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        respondToPartnerRequest(request, "accepted")
                      }
                      style={{
                        flex: 1,
                        border: "none",
                        borderRadius: 10,
                        background: "#1A5FFF",
                        color: "#FFFFFF",
                        padding: "8px 10px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}

              {displayedItems.map(item => {
                const tone = getTone(item);

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNotification(item)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openNotification(item);
                      }
                    }}
                    style={{
                      position: "relative",
                      padding: "15px 44px 15px 15px",
                      borderRadius: 16,
                      cursor: getRoute(item) ? "pointer" : "default",
                      marginBottom: 12,
                      background: tone.background,
                      border: `1px solid ${tone.border}`,
                      opacity: item.is_read ? 0.68 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={event => deleteOne(event, item.id)}
                      title="Delete notification"
                      style={{
                        position: "absolute",
                        top: 9,
                        right: 9,
                        width: 26,
                        height: 26,
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.18)",
                        background: "rgba(255,255,255,0.8)",
                        color: "#EF4444",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 900,
                        lineHeight: 1,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      ×
                    </button>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        {tone.icon}
                      </span>

                      <div
                        style={{
                          minWidth: 0,
                          fontSize: 15,
                          fontWeight: 800,
                          color: C.text,
                        }}
                      >
                        {item.title || "Notification"}
                      </div>

                      {!item.is_read && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: "#1A5FFF",
                            marginLeft: "auto",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        lineHeight: 1.6,
                      }}
                    >
                      {item.message || ""}
                    </div>

                    <div
                      style={{
                        marginTop: 9,
                        fontSize: 13,
                        color: "#94A3B8",
                      }}
                    >
                      {formatTime(item.created_at)}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}