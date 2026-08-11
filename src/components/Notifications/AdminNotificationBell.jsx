import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";

const ADMIN_NOTIFICATION_TYPES = [
  "admin_coach_verification",
  "admin_user_report",
  "admin_deletion_request",
  "admin_club_issue",
  "admin_account_security",
];

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAdminPage(item) {
  const type = normalise(item?.source_type || item?.type);

  if (type === "admin_coach_verification") {
    return "coaches";
  }

  if (
    type === "admin_user_report" ||
    type === "admin_deletion_request"
  ) {
    return "reports";
  }

  if (type === "admin_club_issue") {
    return "clubs";
  }

  if (type === "admin_account_security") {
    return "users";
  }

  return "";
}

export default function AdminNotificationBell({
  setActivePage,
  limit = 30,
}) {
  const wrapperRef = useRef(null);

  const adminUserIdRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const resolveAdminUser = useCallback(async () => {
    if (adminUserIdRef.current) {
      return adminUserIdRef.current;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Unable to get admin user:", error);
      return null;
    }

    if (!user?.id) {
      return null;
    }

    adminUserIdRef.current = user.id;
    return user.id;
  }, []);

  const loadNotifications = useCallback(async () => {
    const uid = await resolveAdminUser();

    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .in("source_type", ADMIN_NOTIFICATION_TYPES)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error(
          "Unable to load admin notifications:",
          error
        );
        return;
      }

      setItems(data || []);
    } finally {
      setLoading(false);
    }
  }, [limit, resolveAdminUser]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    const subscribe = async () => {
      const uid = await resolveAdminUser();

      if (!uid || cancelled) {
        return;
      }

      channel = supabase
        .channel(
          `admin-notifications-${uid}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      cancelled = true;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications, resolveAdminUser]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items]
  );

  const markAllRead = async (event) => {
    event.stopPropagation();

    const uid = await resolveAdminUser();

    if (!uid) {
      return;
    }

    const unreadIds = items
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (unreadIds.length === 0) {
      return;
    }

    setItems((current) =>
      current.map((item) => ({
        ...item,
        is_read: true,
      }))
    );

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("user_id", uid)
      .in("id", unreadIds);

    if (error) {
      console.error(
        "Unable to mark admin notifications read:",
        error
      );

      loadNotifications();
    }
  };

  const clearAll = async (event) => {
    event.stopPropagation();

    const uid = await resolveAdminUser();

    if (!uid || items.length === 0) {
      return;
    }

    const ids = items.map((item) => item.id);

    setItems([]);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", uid)
      .in("id", ids);

    if (error) {
      console.error(
        "Unable to clear admin notifications:",
        error
      );

      loadNotifications();
    }
  };

  const deleteOne = async (event, notificationId) => {
    event.stopPropagation();

    setItems((current) =>
      current.filter(
        (item) => item.id !== notificationId
      )
    );

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      console.error(
        "Unable to delete admin notification:",
        error
      );

      loadNotifications();
    }
  };

  const openNotification = async (item) => {
    const uid = await resolveAdminUser();

    if (!uid) {
      return;
    }

    if (!item.is_read) {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_read: true,
              }
            : row
        )
      );

      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
        })
        .eq("id", item.id)
        .eq("user_id", uid);

      if (error) {
        console.error(
          "Unable to mark admin notification read:",
          error
        );
      }
    }

    setOpen(false);

    const page = getAdminPage(item);

    if (page) {
      setActivePage?.(page);
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title="Admin notifications"
        aria-label="Admin notifications"
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          border:
            "1px solid var(--line, #DDE3EF)",
          background:
            "var(--card, #FFFFFF)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          position: "relative",
          boxShadow:
            "0 4px 14px rgba(13,27,62,0.05)",
          fontSize: 21,
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -7,
              right: -7,
              minWidth: 22,
              height: 22,
              padding: "0 5px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#FFFFFF",
              border:
                "2px solid var(--card, #FFFFFF)",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              lineHeight: 1,
              fontWeight: 900,
            }}
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={(event) =>
            event.stopPropagation()
          }
          style={{
            position: "absolute",
            top: 58,
            right: 0,
            zIndex: 5000,
            width: 440,
            maxWidth:
              "calc(100vw - 32px)",
            maxHeight: 610,
            overflowY: "auto",
            padding: 18,
            borderRadius: 22,
            border:
              "1px solid var(--line, #E5EAF3)",
            background:
              "var(--card, #FFFFFF)",
            boxShadow:
              "0 22px 55px rgba(13,27,62,0.17)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color:
                  "var(--text, #0D1B3E)",
              }}
            >
              Notifications
            </div>

            {items.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <button
                  type="button"
                  onClick={markAllRead}
                  style={{
                    padding: 0,
                    border: "none",
                    background:
                      "transparent",
                    color: "#1A5FFF",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Mark read
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    padding: 0,
                    border: "none",
                    background:
                      "transparent",
                    color: "#EF4444",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
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
                padding: "30px 12px",
                textAlign: "center",
                color:
                  "var(--text-muted, #8892A4)",
                fontSize: 13,
              }}
            >
              Loading notifications...
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: "34px 12px",
                textAlign: "center",
                color:
                  "var(--text-muted, #8892A4)",
                fontSize: 13,
              }}
            >
              No admin notifications yet.
            </div>
          ) : (
            items.map((item) => {
              const destination =
                getAdminPage(item);

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    openNotification(item)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      openNotification(item);
                    }
                  }}
                  style={{
                    position: "relative",
                    padding:
                      "17px 48px 17px 18px",
                    marginBottom: 12,
                    borderRadius: 17,
                    border:
                      "1px solid #93C5FD",
                    background: "#EFF6FF",
                    cursor: destination
                      ? "pointer"
                      : "default",
                    opacity: item.is_read
                      ? 0.68
                      : 1,
                    transition:
                      "opacity 0.15s ease, transform 0.15s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) =>
                      deleteOne(
                        event,
                        item.id
                      )
                    }
                    title="Delete notification"
                    aria-label="Delete notification"
                    style={{
                      position: "absolute",
                      top: 13,
                      right: 13,
                      width: 29,
                      height: 29,
                      borderRadius: "50%",
                      border:
                        "1px solid #FCA5A5",
                      background: "#FFFFFF",
                      color: "#EF4444",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      fontSize: 17,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      paddingRight: 16,
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        fontSize: 15,
                        fontWeight: 900,
                        color:
                          "var(--text, #0D1B3E)",
                      }}
                    >
                      {item.title ||
                        "Admin notification"}
                    </div>

                    {!item.is_read && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background:
                            "#1A5FFF",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "#8290A5",
                    }}
                  >
                    {item.message || ""}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: "#9AA7BA",
                    }}
                  >
                    {formatTime(
                      item.created_at
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}