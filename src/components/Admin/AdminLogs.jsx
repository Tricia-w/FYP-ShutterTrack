import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import {
  EmptyState,
  SectionHeader,
  buttonBase,
  inputStyle,
} from "./AdminShared";

const TYPE_OPTIONS = [
  "All",
  "Coach",
  "Deletion",
  "Report",
  "User",
  "Settings",
  "Security",
  "General",
];

const typeMeta = {
  coach: {
    symbol: "✓",
    background: "#ECFDF5",
    color: "#00976C",
  },
  deletion: {
    symbol: "!",
    background: "#FFF1F2",
    color: "#E11D48",
  },
  report: {
    symbol: "!",
    background: "#FFF7ED",
    color: "#EA580C",
  },
  user: {
    symbol: "U",
    background: "#EEF3FF",
    color: "#1A5FFF",
  },
  settings: {
    symbol: "⚙",
    background: "#F3E8FF",
    color: "#7E22CE",
  },
  security: {
    symbol: "S",
    background: "#FEF2F2",
    color: "#B91C1C",
  },
  general: {
    symbol: "✓",
    background: "#EEF3FF",
    color: "#1A5FFF",
  },
};

const normaliseType = (value) =>
  String(value || "general").trim().toLowerCase();

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("admin_activity_logs")
        .select(`
          id,
          admin_user_id,
          admin_name,
          admin_email,
          action,
          detail,
          action_type,
          target_user_id,
          target_name,
          metadata,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error("Unable to load activity logs:", error);
      setErrorMessage(
        error.message ||
          "Unable to load activity logs. Run the supplied SQL setup first."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-activity-logs-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_activity_logs",
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  const visibleLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const logType = normaliseType(log.action_type);

      const matchesType =
        filter === "All" ||
        logType === filter.toLowerCase();

      const values = [
        log.action,
        log.detail,
        log.admin_name,
        log.admin_email,
        log.target_name,
        log.action_type,
      ];

      const matchesSearch =
        !query ||
        values.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      return matchesType && matchesSearch;
    });
  }, [filter, logs, search]);

  return (
    <>
      <SectionHeader
        title="Activity Logs"
        subtitle="Track important administrative actions in ShuttleTrack"
        action={
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            style={{
              ...buttonBase,
              padding: "9px 15px",
              background: "#1A5FFF",
              color: "#FFFFFF",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? "Refreshing..." : "Refresh logs"}
          </button>
        }
      />

      {errorMessage && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 11,
            border: "1px solid #FECACA",
            background: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          {TYPE_OPTIONS.map((option) => {
            const count =
              option === "All"
                ? logs.length
                : logs.filter(
                    (log) =>
                      normaliseType(log.action_type) ===
                      option.toLowerCase()
                  ).length;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                style={{
                  ...buttonBase,
                  padding: "8px 13px",
                  border:
                    filter === option
                      ? "1.5px solid #0D1B3E"
                      : "1.5px solid #DDE3EF",
                  background:
                    filter === option
                      ? "#0D1B3E"
                      : "#FFFFFF",
                  color:
                    filter === option
                      ? "#FFFFFF"
                      : "#6B7280",
                }}
              >
                {option} · {count}
              </button>
            );
          })}
        </div>

        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search action, account or admin"
          style={{
            ...inputStyle,
            width: 310,
            maxWidth: "100%",
          }}
        />
      </div>

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
          padding: "4px 20px",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "#8892A4",
              fontSize: 12,
            }}
          >
            Loading activity logs...
          </div>
        ) : visibleLogs.length === 0 ? (
          <EmptyState
            text={
              logs.length === 0
                ? "No activity recorded yet. Make a new admin status change after running the SQL setup."
                : "No activity matches the current filter."
            }
          />
        ) : (
          visibleLogs.map((log, index) => {
            const logType = normaliseType(
              log.action_type
            );
            const meta =
              typeMeta[logType] || typeMeta.general;

            return (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  padding: "17px 0",
                  borderBottom:
                    index < visibleLogs.length - 1
                      ? "1px solid #EEF1F8"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: meta.background,
                    color: meta.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  {meta.symbol}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#0D1B3E",
                    }}
                  >
                    {log.action}
                  </div>

                  {log.detail && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6B7280",
                        marginTop: 4,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {log.detail}
                    </div>
                  )}

                  {log.target_name && (
                    <div
                      style={{
                        marginTop: 7,
                        display: "inline-flex",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "#F5F7FB",
                        color: "#60708A",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      Account: {log.target_name}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontSize: 11,
                    color: "#8892A4",
                    flexShrink: 0,
                    maxWidth: 220,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: "#465268",
                    }}
                  >
                    {log.admin_name ||
                      log.admin_email ||
                      "Administrator"}
                  </div>

                  {log.admin_email &&
                    log.admin_name && (
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 10,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {log.admin_email}
                      </div>
                    )}

                  <div style={{ marginTop: 5 }}>
                    {formatDate(log.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
