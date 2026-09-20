import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const ACTION_PLAN_META_PREFIX =
  "__SHUTTLETRACK_ACTION_PLAN__:";

function decodeActionPlans(value) {
  const raw = String(value || "");

  const empty = {
    performance: "",
    performanceDeadline: "",
    performanceCompletion: 0,
    fitness: "",
    fitnessDeadline: "",
    fitnessCompletion: 0,
  };

  if (!raw.startsWith(ACTION_PLAN_META_PREFIX)) {
    return empty;
  }

  try {
    const parsed = JSON.parse(
      raw.slice(ACTION_PLAN_META_PREFIX.length)
    );

    const readPlan = key => {
      const value = parsed?.[key];

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        return {
          text: String(value.text || "").trim(),
          deadline: String(value.deadline || "")
            .slice(0, 10)
            .trim(),
          completion: Math.max(
            0,
            Math.min(
              100,
              Number(value.completionRate) || 0
            )
          ),
        };
      }

      return {
        text: String(value || "").trim(),
        deadline: "",
        completion: 0,
      };
    };

    const performance = readPlan("performance");
    const fitness = readPlan("fitness");

    return {
      performance: performance.text,
      performanceDeadline: performance.deadline,
      performanceCompletion: performance.completion,
      fitness: fitness.text,
      fitnessDeadline: fitness.deadline,
      fitnessCompletion: fitness.completion,
    };
  } catch {
    return empty;
  }
}

function toLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addLocalDays(date, days) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return toLocalISODate(next);
}

function formatActionPlanDeadline(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
      background:
        "color-mix(in srgb, #10B981 12%, var(--card, #FFFFFF))",
      border:
        "color-mix(in srgb, #10B981 38%, var(--line, #EEF1F8))",
      iconBackground:
        "color-mix(in srgb, #10B981 18%, var(--card, #FFFFFF))",
      iconColor: "#059669",
    };
  }

  if (
    type === "warning" ||
    title.includes("declined") ||
    title.includes("cancelled") ||
    title.includes("missed") ||
    title.includes("overdue") ||
    title.includes("due today") ||
    title.includes("due tomorrow")
  ) {
    return {
      icon: "⚠️",
      background:
        "color-mix(in srgb, #F59E0B 12%, var(--card, #FFFFFF))",
      border:
        "color-mix(in srgb, #F59E0B 38%, var(--line, #EEF1F8))",
      iconBackground:
        "color-mix(in srgb, #F59E0B 18%, var(--card, #FFFFFF))",
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
      background:
        "color-mix(in srgb, #EF4444 11%, var(--card, #FFFFFF))",
      border:
        "color-mix(in srgb, #EF4444 35%, var(--line, #EEF1F8))",
      iconBackground:
        "color-mix(in srgb, #EF4444 17%, var(--card, #FFFFFF))",
      iconColor: "#DC2626",
    };
  }

  return {
    icon: "🔔",
    background:
      "color-mix(in srgb, #1A5FFF 10%, var(--card, #FFFFFF))",
    border:
      "color-mix(in srgb, #1A5FFF 32%, var(--line, #EEF1F8))",
    iconBackground:
      "color-mix(in srgb, #1A5FFF 16%, var(--card, #FFFFFF))",
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
  const popupRef = useRef(null);
  const notificationSoundRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const [resolvedUserId, setResolvedUserId] = useState(userId);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [popupPosition, setPopupPosition] = useState({
    top: 0,
    left: 14,
    width: 430,
    maxHeight: 560,
  });

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
      if (!soundEnabledRef.current) return;

      const sound = notificationSoundRef.current;
      if (!sound) return;

      const originalVolume = sound.volume;
      const originalMuted = sound.muted;

      sound.muted = true;
      sound.volume = 0;
      sound.currentTime = 0;

      sound
        .play()
        .then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.volume = originalVolume || 0.4;
          sound.muted = originalMuted;
        })
        .catch(() => {
          sound.volume = originalVolume || 0.4;
          sound.muted = originalMuted;
        });

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
        data?.notification_sound_enabled === true;
    };

    const handleSoundSettingUpdated = event => {
      const enabled =
        event?.detail?.enabled === true;

      soundEnabledRef.current = enabled;

      if (!enabled) {
        const sound = notificationSoundRef.current;

        if (sound) {
          sound.pause();
          sound.currentTime = 0;
        }
      }
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

  const ensureActionPlanReminders =
    useCallback(
      async uid => {
        if (!uid) return;

        const now = new Date();
        const today = toLocalISODate(now);
        const tomorrow = addLocalDays(now, 1);

        const {
          data: progressRows,
          error: progressError,
        } = await supabase
          .from("coach_player_progress")
          .select("id, coach_comment")
          .eq("player_user_id", uid);

        if (progressError) {
          console.error(
            "Action plan reminder load error:",
            progressError
          );
          return;
        }

        const reminders = [];

        for (const row of progressRows || []) {
          const plans = decodeActionPlans(
            row.coach_comment
          );

          const planItems = [
            {
              kind: "performance",
              label: "Performance",
              text: plans.performance,
              deadline:
                plans.performanceDeadline,
              completion:
                plans.performanceCompletion,
              route: "/performance",
            },
            {
              kind: "fitness",
              label: "Fitness",
              text: plans.fitness,
              deadline:
                plans.fitnessDeadline,
              completion:
                plans.fitnessCompletion,
              route: "/fitness",
            },
          ];

          for (const plan of planItems) {
            if (
              !plan.text ||
              !plan.deadline ||
              Number(plan.completion) >= 100
            ) {
              continue;
            }

            let stage = "";
            let title = "";
            let message = "";

            if (plan.deadline === tomorrow) {
              stage = "due_tomorrow";
              title =
                `${plan.label} action plan due tomorrow`;
              message =
                `Your coach action plan is due tomorrow (${formatActionPlanDeadline(
                  plan.deadline
                )}). Completion is ${plan.completion}%.`;
            } else if (
              plan.deadline === today
            ) {
              stage = "due_today";
              title =
                `${plan.label} action plan due today`;
              message =
                `Your coach action plan is due today. Completion is ${plan.completion}%.`;
            } else if (
              plan.deadline < today
            ) {
              stage = "overdue";
              title =
                `${plan.label} action plan overdue`;
              message =
                `Your coach action plan deadline was ${formatActionPlanDeadline(
                  plan.deadline
                )}. It is still ${plan.completion}% complete.`;
            } else {
              continue;
            }

            reminders.push({
              user_id: uid,
              title,
              message,
              type: "warning",
              source_type:
                `coach_${plan.kind}_action_plan_${stage}`,
              action_url:
                `${plan.route}?actionPlan=${row.id}`,
              is_read: false,
            });
          }
        }

        for (const reminder of reminders) {
          const {
            data: existing,
            error: existingError,
          } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", uid)
            .eq(
              "source_type",
              reminder.source_type
            )
            .eq(
              "action_url",
              reminder.action_url
            )
            .eq(
              "message",
              reminder.message
            )
            .limit(1);

          if (existingError) {
            console.error(
              "Action plan reminder duplicate check error:",
              existingError
            );
            continue;
          }

          if ((existing || []).length > 0) {
            continue;
          }

          const { error: insertError } =
            await supabase
              .from("notifications")
              .insert(reminder);

          if (insertError) {
            console.error(
              "Create action plan reminder error:",
              insertError
            );
          }
        }
      },
      [supabase]
    );

  const loadNotifications = useCallback(async () => {
    if (localOnly) {
      setLoading(false);
      return;
    }

    const uid = await resolveUserId();
    if (!uid) return;

    setLoading(true);

    try {
      await ensureActionPlanReminders(uid);
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
    ensureActionPlanReminders,
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

  const updatePopupPosition = useCallback(() => {
    if (!wrapRef.current || typeof window === "undefined") return;

    const rect = wrapRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const sideGap = 14;
    const popupGap = 6;

    const isMobile = viewportWidth <= 640;

    const width = isMobile
      ? Math.max(280, viewportWidth - 24)
      : Math.min(
          430,
          Math.max(280, viewportWidth - sideGap * 2)
        );

    let left = isMobile
      ? 12
      : rect.right - width;

    left = isMobile
      ? 12
      : Math.max(
          sideGap,
          Math.min(
            left,
            viewportWidth - width - sideGap
          )
        );

    let top = rect.bottom + popupGap;
    let availableHeight =
      viewportHeight - top - (isMobile ? 12 : sideGap);

    if (!isMobile && availableHeight < 220) {
      const preferredHeight = Math.min(
        560,
        viewportHeight - sideGap * 2
      );

      top = Math.max(
        sideGap,
        rect.top - preferredHeight - popupGap
      );

      availableHeight =
        viewportHeight - top - sideGap;
    }

    setPopupPosition({
      top,
      left,
      width,
      maxHeight: Math.max(
        180,
        Math.min(
          isMobile ? 500 : 560,
          availableHeight
        )
      ),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    updatePopupPosition();

    window.addEventListener(
      "resize",
      updatePopupPosition
    );

    window.addEventListener(
      "scroll",
      updatePopupPosition,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        updatePopupPosition
      );

      window.removeEventListener(
        "scroll",
        updatePopupPosition,
        true
      );
    };
  }, [open, updatePopupPosition]);

  useEffect(() => {
    const closeOutside = event => {
      const clickedBell =
        wrapRef.current?.contains(event.target);

      const clickedPopup =
        popupRef.current?.contains(event.target);

      if (!clickedBell && !clickedPopup) {
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
    <div
      ref={wrapRef}
      className="sharedNotificationBellWrap"
      style={{ position: "relative" }}
    >
      <style>{`
        @media (max-width: 640px) {
          .sharedNotificationBellWrap {
            position: fixed !important;
            top: 164px !important;
            right: 14px !important;
            left: auto !important;
            z-index: 9998 !important;
            width: 44px !important;
            height: 44px !important;
          }

          .sharedNotificationBellWrap > button {
            width: 44px !important;
            height: 44px !important;
            border-radius: 13px !important;
            margin: 0 !important;
            box-shadow: 0 8px 22px rgba(13,27,62,0.14) !important;
          }
        }
      `}</style>

      <button
        type="button"
        onClick={event => {
          event.stopPropagation();

          setOpen(current => {
            const nextOpen = !current;

            if (nextOpen) {
              window.requestAnimationFrame(
                updatePopupPosition
              );
            }

            return nextOpen;
          });

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
              border: `2px solid ${C.card}`,
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

      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          ref={popupRef}
          onClick={event => event.stopPropagation()}
          style={{
            position: "fixed",
            top: popupPosition.top,
            left: popupPosition.left,
            width: popupPosition.width,
            maxWidth: "calc(100vw - 28px)",
            maxHeight: popupPosition.maxHeight,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 16,
            borderRadius: 22,
            border: `1px solid ${C.line}`,
            background: C.card,
            color: C.text,
            boxShadow: "0 22px 55px rgba(0,0,0,0.28)",
            zIndex: 10000,
            fontFamily: "inherit",
            boxSizing: "border-box",
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
                    background:
                      "color-mix(in srgb, #1A5FFF 10%, var(--card, #FFFFFF))",
                    border:
                      "1px solid color-mix(in srgb, #1A5FFF 32%, var(--line, #EEF1F8))",
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
                      color: C.muted,
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
                        background: C.card,
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
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 16,
                          lineHeight: 1,
                          flexShrink: 0,
                          background: tone.iconBackground,
                          color: tone.iconColor,
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
                        color: C.muted,
                        lineHeight: 1.6,
                      }}
                    >
                      {item.message || ""}
                    </div>

                    <div
                      style={{
                        marginTop: 9,
                        fontSize: 13,
                        color: C.muted,
                        opacity: 0.78,
                      }}
                    >
                      {formatTime(item.created_at)}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}