import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const MODE_TITLES = {
  all: "Notifications",
  players: "Player notifications",
  sessions: "Session notifications",
  progress: "Progress notifications",
  clubs: "Club notifications",
};

const MODE_KEYWORDS = {
  players: [
    "coach_request",
    "player_request",
    "coach_relationship",
    "coaching_request",
    "player_removed",
    "request_accepted",
    "request_declined",
    "request_rejected",
    "request_cancelled",
  ],
  sessions: [
    "session",
    "training",
    "schedule",
    "attendance",
    "completed",
    "absent",
    "reminder",
  ],
  progress: [
    "progress",
    "assessment",
    "performance",
    "fitness",
    "injury",
    "recovery",
    "recommendation",
    "feedback",
  ],
  clubs: [
    "club_",
    "club ",
    "membership",
    "join request",
    "member removed",
    "member left",
  ],
};

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

const COACH_ONLY_KEYWORDS = [
  "coach_session_reminder",
  "player_request",
  "coach_request_received",
  "coach_relationship",
  "club_join_request",
  "club_request_cancelled",
  "club_member_left",
  "verification",
  "coach_verification",
  "admin",
];

const PLAYER_ONLY_KEYWORDS = [
  "training_reminder",
  "coach_scheduled_training",
  "coach_cancelled_training",
  "coach_session_created",
  "coach_session_cancelled",
  "coach_session_updated",
  "coach_progress_updated",
  "coach_fitness_updated",
  "coach_performance_updated",
  "removed_from_coach",
];

function isCoachNotification(notification) {
  const actionUrl = normalise(notification?.action_url);
  const searchable = [
    notification?.source_type,
    notification?.type,
    notification?.title,
    notification?.message,
  ]
    .map(normalise)
    .join(" ");

  if (actionUrl.startsWith("/coach")) return true;

  if (
    actionUrl.startsWith("/player") ||
    actionUrl.startsWith("/players") ||
    actionUrl.startsWith("/fitness") ||
    actionUrl.startsWith("/performance") ||
    actionUrl.startsWith("/expenses") ||
    actionUrl === "/clubs"
  ) {
    return false;
  }

  if (
    PLAYER_ONLY_KEYWORDS.some(keyword =>
      searchable.includes(keyword)
    )
  ) {
    return false;
  }

  return COACH_ONLY_KEYWORDS.some(keyword =>
    searchable.includes(keyword)
  );
}

function matchesMode(notification, mode) {
  if (!isCoachNotification(notification)) return false;
  if (!mode || mode === "all") return true;

  const searchable = [
    notification?.source_type,
    notification?.type,
    notification?.title,
    notification?.message,
    notification?.action_url,
  ]
    .map(normalise)
    .join(" ");

  return (MODE_KEYWORDS[mode] || []).some(keyword =>
    searchable.includes(keyword)
  );
}

function notificationTone(notification) {
  const text = [
    notification?.type,
    notification?.source_type,
    notification?.title,
  ]
    .map(normalise)
    .join(" ");

  if (
    text.includes("cancel") ||
    text.includes("declin") ||
    text.includes("reject") ||
    text.includes("removed") ||
    text.includes("absent")
  ) {
    return {
      icon: "⚠️",
      background: "#FFFDF3",
      border: "#F6D77A",
    };
  }

  if (
    text.includes("accepted") ||
    text.includes("approved") ||
    text.includes("complete") ||
    text.includes("verified")
  ) {
    return {
      icon: "✅",
      background: "#F2FFF9",
      border: "#A7E8CF",
    };
  }

  if (
    text.includes("injury") ||
    text.includes("danger") ||
    text.includes("urgent")
  ) {
    return {
      icon: "🔥",
      background: "#FFF5F5",
      border: "#FFCACA",
    };
  }

  return {
    icon: "🔔",
    background: "#F2F7FF",
    border: "#AFCFFF",
  };
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSessionDateTime(session) {
  if (!session?.session_date || !session?.start_time) {
    return null;
  }

  const time = String(session.start_time).slice(0, 5);
  const value = new Date(`${session.session_date}T${time}:00`);

  return Number.isNaN(value.getTime()) ? null : value;
}

export default function CoachNotificationBell({
  supabase,
  mode = "all",
  title,
  limit = 50,
  onNotificationOpened,
}) {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const notificationSoundRef = useRef(null);
  const soundEnabledRef = useRef(true);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const filteredNotifications = useMemo(
    () => notifications.filter(item => matchesMode(item, mode)),
    [notifications, mode]
  );

  const unreadCount = filteredNotifications.filter(
    item => !item.is_read
  ).length;


  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;

    const loadSoundSetting = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user?.id) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("notification_sound_enabled")
        .eq("user_id", user.id)
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
  }, [supabase]);

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

  const ensureCoachSessionReminders = useCallback(
    async userId => {
      if (!supabase || !userId) return;

      const { data: savedSettings, error: settingsError } =
        await supabase
          .from("user_settings")
          .select("coach_session_reminder")
          .eq("user_id", userId)
          .maybeSingle();

      if (settingsError) {
        console.error(
          "Coach reminder settings load error:",
          settingsError
        );
      }

      if (savedSettings?.coach_session_reminder === false) {
        return;
      }

      const now = new Date();
      const reminderLimit = new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      );

      const today = toLocalISODate(now);
      const tomorrow = toLocalISODate(reminderLimit);

      const { data: sessions, error: sessionError } =
        await supabase
          .from("coach_training_sessions")
          .select(
            "id, session_date, start_time, session_type, venue"
          )
          .eq("coach_user_id", userId)
          .gte("session_date", today)
          .lte("session_date", tomorrow);

      if (sessionError) {
        console.error(
          "Coach reminder session load error:",
          sessionError
        );
        return;
      }

      const upcomingSessions = (sessions || [])
        .map(session => ({
          session,
          dateTime: getSessionDateTime(session),
        }))
        .filter(
          item =>
            item.dateTime &&
            item.dateTime > now &&
            item.dateTime <= reminderLimit
        );

      for (const { session, dateTime } of upcomingSessions) {
        const actionUrl =
          `/coach/sessions?session=${session.id}`;

        const { data: existingReminders, error: existingError } =
          await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", userId)
            .eq("source_type", "coach_session_reminder")
            .eq("action_url", actionUrl)
            .limit(1);

        if (existingError) {
          console.error(
            "Coach reminder duplicate check error:",
            existingError
          );
          continue;
        }

        if ((existingReminders || []).length > 0) {
          continue;
        }

        const formattedDate = dateTime.toLocaleDateString(
          "en-MY",
          {
            day: "numeric",
            month: "short",
          }
        );

        const formattedTime = dateTime.toLocaleTimeString(
          "en-MY",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "Training reminder",
            message: `${
              session.session_type || "Training"
            } starts on ${formattedDate} at ${formattedTime}${
              session.venue ? ` · ${session.venue}` : ""
            }.`,
            type: "info",
            source_type: "coach_session_reminder",
            action_url: actionUrl,
            is_read: false,
          });

        if (notificationError) {
          console.error(
            "Create coach reminder error:",
            notificationError
          );
        }
      }
    },
    [supabase]
  );

  const loadNotifications = useCallback(async () => {
    if (!supabase) return;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    await ensureCoachSessionReminders(user.id);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Coach notification load error:", error);
      setNotifications([]);
    } else {
      setNotifications(data || []);
    }

    setLoading(false);
  }, [ensureCoachSessionReminders, limit, supabase]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!supabase) return undefined;

    let channel;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) return;

      channel = supabase
        .channel(
          `coach-notifications-${mode}-${user.id}-${Date.now()}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          payload => {
            const isNewNotification =
              payload?.eventType === "INSERT" &&
              payload?.new &&
              matchesMode(payload.new, mode);

            if (isNewNotification) {
              playNotificationSound();
            }

            loadNotifications();
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [
    loadNotifications,
    mode,
    playNotificationSound,
    supabase,
  ]);

  useEffect(() => {
    const closeOutside = event => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
    };
  }, []);

  const openNotification = async notification => {
    if (!notification.is_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      if (!error) {
        setNotifications(current =>
          current.map(item =>
            item.id === notification.id
              ? { ...item, is_read: true }
              : item
          )
        );
      }
    }

    setOpen(false);
    onNotificationOpened?.(notification);

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const markAllRead = async event => {
    event.stopPropagation();

    const unreadIds = filteredNotifications
      .filter(item => !item.is_read)
      .map(item => item.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (!error) {
      const idSet = new Set(unreadIds);

      setNotifications(current =>
        current.map(item =>
          idSet.has(item.id)
            ? { ...item, is_read: true }
            : item
        )
      );
    }
  };

  const clearNotifications = async event => {
    event.stopPropagation();

    const ids = filteredNotifications.map(item => item.id);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids);

    if (!error) {
      const idSet = new Set(ids);
      setNotifications(current =>
        current.filter(item => !idSet.has(item.id))
      );
    }
  };

  const deleteNotification = async (event, id) => {
    event.stopPropagation();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      setNotifications(current =>
        current.filter(item => item.id !== id)
      );
    }
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "inline-flex",
        zIndex: open ? 3000 : "auto",
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(current => !current);
          loadNotifications();
        }}
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          border: "1px solid var(--line, #DDE3EF)",
          background: "var(--card, #FFFFFF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          cursor: "pointer",
          position: "relative",
          boxShadow: "0 4px 14px rgba(13,27,62,0.06)",
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -7,
              right: -7,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #FFFFFF",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 54,
            right: 0,
            width: "min(430px, calc(100vw - 28px))",
            maxHeight: 560,
            overflow: "hidden",
            background: "var(--card, #FFFFFF)",
            border: "1px solid var(--line, #DDE3EF)",
            borderRadius: 18,
            boxShadow: "0 22px 55px rgba(13,27,62,0.20)",
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: "1px solid var(--line, #EEF1F8)",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "var(--text, #0D1B3E)",
              }}
            >
              {title || MODE_TITLES[mode] || "Notifications"}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1A5FFF",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: unreadCount ? "pointer" : "default",
                  opacity: unreadCount ? 1 : 0.45,
                }}
              >
                Mark read
              </button>

              <button
                type="button"
                onClick={clearNotifications}
                disabled={filteredNotifications.length === 0}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#EF4444",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor:
                    filteredNotifications.length > 0
                      ? "pointer"
                      : "default",
                  opacity:
                    filteredNotifications.length > 0 ? 1 : 0.45,
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: 490,
              overflowY: "auto",
              padding: 12,
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: "var(--text-muted, #8892A4)",
                  fontSize: 13,
                }}
              >
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: "var(--text-muted, #8892A4)",
                  fontSize: 13,
                }}
              >
                No notifications yet.
              </div>
            ) : (
              filteredNotifications.map(notification => {
                const tone = notificationTone(notification);

                return (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      openNotification(notification)
                    }
                    onKeyDown={event => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        openNotification(notification);
                      }
                    }}
                    style={{
                      position: "relative",
                      padding: "14px 44px 14px 14px",
                      borderRadius: 16,
                      marginBottom: 12,
                      background: tone.background,
                      border: `1px solid ${tone.border}`,
                      cursor: "pointer",
                      opacity: notification.is_read ? 0.68 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={event =>
                        deleteNotification(
                          event,
                          notification.id
                        )
                      }
                      title="Delete notification"
                      aria-label="Delete notification"
                      style={{
                        position: "absolute",
                        top: 9,
                        right: 9,
                        width: 26,
                        height: 26,
                        borderRadius: 9,
                        border: "1px solid #FFD4D4",
                        background: "#FFFFFF",
                        color: "#EF4444",
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
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
                          fontSize: 15,
                          fontWeight: 900,
                          color: "var(--text, #0D1B3E)",
                        }}
                      >
                        {notification.title || "Notification"}
                      </div>

                      {!notification.is_read && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "#1A5FFF",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 7,
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--text-muted, #6F7D96)",
                      }}
                    >
                      {notification.message || ""}
                    </div>

                    <div
                      style={{
                        marginTop: 9,
                        fontSize: 11,
                        color: "var(--text-muted, #8892A4)",
                      }}
                    >
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}