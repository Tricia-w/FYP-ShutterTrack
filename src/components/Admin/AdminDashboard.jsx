import React, { useMemo } from "react";
import {
  Badge,
  SectionHeader,
  SummaryCard,
  buttonBase,
} from "./AdminShared";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function normalizeAccountStatus(user) {
  return String(
    user?.accountStatus ||
      user?.account_status ||
      "active"
  )
    .trim()
    .toLowerCase();
}

function parseJoinedMonth(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^([A-Za-z]{3,9})\s+(\d{4})$/);

  if (!match) {
    return null;
  }

  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  const monthText = match[1].slice(0, 3).toLowerCase();
  const monthIndex = monthNames.indexOf(monthText);
  const year = Number(match[2]);

  if (monthIndex === -1 || Number.isNaN(year)) {
    return null;
  }

  return new Date(year, monthIndex, 1);
}

function getUserCreatedDate(user) {
  const rawDate =
    user?.created_at ||
    user?.createdAt ||
    user?.registered_at ||
    user?.registration_date ||
    user?.joined_at;

  if (rawDate) {
    const parsedDate = new Date(rawDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return parseJoinedMonth(user?.joined);
}

function formatMonth(date) {
  return date.toLocaleDateString("en-MY", {
    month: "short",
    year: "2-digit",
  });
}

export default function AdminDashboard({
  users = [],
  coaches = [],
  reports = [],
  logs = [],
  setActivePage,
}) {
  const statistics = useMemo(() => {
    const now = new Date();

    const currentMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const nextMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );

    const playerCount = users.filter(
      (item) => normalizeRole(item.role) === "player"
    ).length;

    const coachCount = users.filter(
      (item) => normalizeRole(item.role) === "coach"
    ).length;

    const adminCount = users.filter(
      (item) => normalizeRole(item.role) === "admin"
    ).length;

    const newUsersThisMonth = users.filter((item) => {
      const createdDate = getUserCreatedDate(item);

      return (
        createdDate &&
        createdDate >= currentMonthStart &&
        createdDate < nextMonthStart
      );
    }).length;

    const pendingCoachCount = coaches.filter(
      (item) => normalizeStatus(item.status) === "pending"
    ).length;

    const pendingReportCount = reports.filter((item) => {
      const status = normalizeStatus(item.status);

      return status === "pending" || status === "reviewing";
    }).length;

    return {
      playerCount,
      coachCount,
      adminCount,
      newUsersThisMonth,
      pendingCoachCount,
      pendingReportCount,
    };
  }, [users, coaches, reports]);

  const roleChartData = useMemo(() => {
    const buildRoleRow = (role, label, activeColor) => {
      const roleUsers = users.filter(
        (item) => normalizeRole(item.role) === role
      );

      const active = roleUsers.filter(
        (item) => normalizeAccountStatus(item) === "active"
      ).length;

      const suspended = roleUsers.filter(
        (item) => normalizeAccountStatus(item) === "suspended"
      ).length;

      const disabled = roleUsers.filter(
        (item) => normalizeAccountStatus(item) === "disabled"
      ).length;

      return {
        label,
        value: roleUsers.length,
        active,
        suspended,
        disabled,
        activeColor,
      };
    };

    return [
      buildRoleRow("player", "Players", "#1A5FFF"),
      buildRoleRow("coach", "Coaches", "#0891B2"),
      buildRoleRow("admin", "Admins", "#7C3AED"),
    ];
  }, [users]);

  const registrationTrend = useMemo(() => {
    const now = new Date();

    return Array.from({ length: 6 }, (_, index) => {
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth() - (5 - index),
        1
      );

      const nextMonthStart = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        1
      );

      const monthUsers = users.filter((user) => {
        const createdDate = getUserCreatedDate(user);

        return (
          createdDate &&
          createdDate >= monthStart &&
          createdDate < nextMonthStart
        );
      });

      const players = monthUsers.filter(
        (user) => normalizeRole(user.role) === "player"
      ).length;

      const coaches = monthUsers.filter(
        (user) => normalizeRole(user.role) === "coach"
      ).length;

      const admins = monthUsers.filter(
        (user) => normalizeRole(user.role) === "admin"
      ).length;

      return {
        label: formatMonth(monthStart),
        count: monthUsers.length,
        players,
        coaches,
        admins,
      };
    });
  }, [users]);

  const maxRoleCount = Math.max(
    ...roleChartData.map((item) => item.value),
    1
  );

  const maxRegistrationCount = Math.max(
    ...registrationTrend.map((item) => item.count),
    1
  );

  const recentLogs = logs.slice(0, 5);

  return (
    <>
      <SectionHeader
        title="Admin Overview"
        subtitle="Monitor ShuttleTrack users, coaches, reports, and recent activity"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <SummaryCard
          label="Total users"
          value={users.length}
          helper="All registered accounts"
          dark
        />

        <SummaryCard
          label="New this month"
          value={statistics.newUsersThisMonth}
          helper="Registered during the current month"
          color="#16A34A"
        />

        <SummaryCard
          label="Players"
          value={statistics.playerCount}
          helper="Registered player accounts"
          color="#1A5FFF"
        />

        <SummaryCard
          label="Coaches"
          value={statistics.coachCount}
          helper={`${statistics.pendingCoachCount} awaiting verification`}
          color="#0891B2"
        />

        <SummaryCard
          label="Administrators"
          value={statistics.adminCount}
          helper="Accounts with admin access"
          color="#7C3AED"
        />

        <SummaryCard
          label="Open reports"
          value={statistics.pendingReportCount}
          helper="Pending or under review"
          color="#D97706"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "var(--card, #FFFFFF)",
            border: "1px solid var(--line, transparent)",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "var(--text, #0D1B3E)",
            }}
          >
            User role distribution
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted, #8892A4)",
              marginTop: 3,
              marginBottom: 22,
            }}
          >
            Number of registered users by role and account status
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 18,
              fontSize: 10,
              color: "var(--text-muted, #8892A4)",
            }}
          >
            {[
              { label: "Active", color: "#1A5FFF" },
              { label: "Suspended", color: "#DC2626" },
              { label: "Disabled", color: "#9CA3AF" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: item.color,
                    display: "inline-block",
                  }}
                />
                {item.label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {roleChartData.map((item) => {
              const activeWidth =
                (item.active / maxRoleCount) * 100;

              const suspendedWidth =
                (item.suspended / maxRoleCount) * 100;

              const disabledWidth =
                (item.disabled / maxRoleCount) * 100;

              return (
                <div key={item.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text-soft, #334155)",
                        }}
                      >
                        {item.label}
                      </span>

                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted, #8892A4)",
                        }}
                      >
                        {item.active} active
                        {item.suspended > 0
                          ? ` · ${item.suspended} suspended`
                          : ""}
                        {item.disabled > 0
                          ? ` · ${item.disabled} disabled`
                          : ""}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--text, #0D1B3E)",
                      }}
                    >
                      {item.value}
                    </span>
                  </div>

                  <div
                    title={`${item.label}: ${item.active} active, ${item.suspended} suspended, ${item.disabled} disabled`}
                    style={{
                      width: "100%",
                      height: 10,
                      borderRadius: 999,
                      background: "var(--line, #EEF1F7)",
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    {item.active > 0 && (
                      <div
                        style={{
                          width: `${activeWidth}%`,
                          height: "100%",
                          background: item.activeColor,
                          transition: "width 0.3s ease",
                        }}
                      />
                    )}

                    {item.suspended > 0 && (
                      <div
                        style={{
                          width: `${suspendedWidth}%`,
                          height: "100%",
                          background: "#DC2626",
                          transition: "width 0.3s ease",
                        }}
                      />
                    )}

                    {item.disabled > 0 && (
                      <div
                        style={{
                          width: `${disabledWidth}%`,
                          height: "100%",
                          background: "#9CA3AF",
                          transition: "width 0.3s ease",
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "var(--card, #FFFFFF)",
            border: "1px solid var(--line, transparent)",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "var(--text, #0D1B3E)",
            }}
          >
            New registrations
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted, #8892A4)",
              marginTop: 3,
            }}
          >
            User registrations during the last 6 months
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 14,
              fontSize: 10,
              color: "var(--text-muted, #8892A4)",
            }}
          >
            {[
              { label: "Players", color: "#1A5FFF" },
              { label: "Coaches", color: "#0891B2" },
              { label: "Admins", color: "#7C3AED" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: item.color,
                    display: "inline-block",
                  }}
                />
                {item.label}
              </div>
            ))}
          </div>

          <div
            style={{
              height: 220,
              marginTop: 12,
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              paddingTop: 20,
            }}
          >
            {registrationTrend.map((item) => {
              const barHeight =
                item.count === 0
                  ? 5
                  : Math.max(
                      (item.count / maxRegistrationCount) * 145,
                      14
                    );

              const playerHeight =
                item.count > 0
                  ? (item.players / item.count) * 100
                  : 0;

              const coachHeight =
                item.count > 0
                  ? (item.coaches / item.count) * 100
                  : 0;

              const adminHeight =
                item.count > 0
                  ? (item.admins / item.count) * 100
                  : 0;

              return (
                <div
                  key={item.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "var(--text, #0D1B3E)",
                      marginBottom: 7,
                    }}
                  >
                    {item.count}
                  </div>

                  <div
                    title={`${item.label}: ${item.players} player${
                      item.players === 1 ? "" : "s"
                    }, ${item.coaches} coach${
                      item.coaches === 1 ? "" : "es"
                    }, ${item.admins} admin${
                      item.admins === 1 ? "" : "s"
                    }`}
                    style={{
                      width: "65%",
                      maxWidth: 46,
                      minWidth: 16,
                      height: barHeight,
                      borderRadius: "9px 9px 3px 3px",
                      background: "var(--line, #E5EAF4)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column-reverse",
                      transition: "height 0.3s ease",
                    }}
                  >
                    {item.players > 0 && (
                      <div
                        style={{
                          height: `${playerHeight}%`,
                          background: "#1A5FFF",
                        }}
                      />
                    )}

                    {item.coaches > 0 && (
                      <div
                        style={{
                          height: `${coachHeight}%`,
                          background: "#0891B2",
                        }}
                      />
                    )}

                    {item.admins > 0 && (
                      <div
                        style={{
                          height: `${adminHeight}%`,
                          background: "#7C3AED",
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted, #8892A4)",
                      marginTop: 9,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
        }}
      >
        <div
          style={{
            background: "var(--card, #FFFFFF)",
            border: "1px solid var(--line, transparent)",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "var(--text, #0D1B3E)",
                }}
              >
                Recent activity
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted, #8892A4)",
                  marginTop: 3,
                }}
              >
                Latest administrative changes
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePage?.("logs")}
              style={{
                ...buttonBase,
                padding: "8px 12px",
                background: "var(--soft, #EEF3FF)",
                color: "#6EA0FF",
                border: "1px solid var(--line, transparent)",
              }}
            >
              View all
            </button>
          </div>

          {recentLogs.length > 0 ? (
            recentLogs.map((log, index) => (
              <div
                key={log.id || `${log.action}-${index}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "13px 0",
                  borderBottom:
                    index < recentLogs.length - 1
                      ? "1px solid var(--line, #EEF1F8)"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    minWidth: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--soft, #EEF3FF)",
                    color: "#6EA0FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                >
                  ✓
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "var(--text, #0D1B3E)",
                    }}
                  >
                    {log.action || "Administrative update"}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #6B7280)",
                      marginTop: 2,
                    }}
                  >
                    {log.detail || "No additional details"}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted, #A0A8B8)",
                      marginTop: 4,
                    }}
                  >
                    {log.admin || "Admin"}
                    {log.time ? ` · ${log.time}` : ""}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                minHeight: 165,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "var(--text-muted, #8892A4)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "var(--soft, #F1F5FF)",
                  color: "#6EA0FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                ✓
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "var(--text-soft, #334155)",
                }}
              >
                No recent activity
              </div>

              <div
                style={{
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                Administrative changes will appear here.
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            background: "var(--card, #FFFFFF)",
            border: "1px solid var(--line, transparent)",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "var(--text, #0D1B3E)",
            }}
          >
            Attention required
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted, #8892A4)",
              marginTop: 3,
            }}
          >
            Items waiting for admin action
          </div>

          <button
            type="button"
            onClick={() => setActivePage?.("coaches")}
            style={{
              width: "100%",
              marginTop: 18,
              padding: 16,
              borderRadius: 13,
              border: "1px solid var(--line, #E6EBF5)",
              background: "var(--soft, #FAFBFF)",
              color: "var(--text, #0D1B3E)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text, #0D1B3E)",
                  }}
                >
                  Coach verification
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted, #8892A4)",
                    marginTop: 4,
                  }}
                >
                  Review uploaded certifications
                </div>
              </div>

              <Badge
                value={`${statistics.pendingCoachCount} pending`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActivePage?.("reports")}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 16,
              borderRadius: 13,
              border: "1px solid var(--line, #E6EBF5)",
              background: "var(--soft, #FAFBFF)",
              color: "var(--text, #0D1B3E)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text, #0D1B3E)",
                  }}
                >
                  User reports
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted, #8892A4)",
                    marginTop: 4,
                  }}
                >
                  Review reported accounts
                </div>
              </div>

              <Badge
                value={`${statistics.pendingReportCount} open`}
              />
            </div>
          </button>

          <div
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 13,
              background: "var(--soft, #F7F9FC)",
              border: "1px solid var(--line, #EEF1F7)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted, #64748B)",
              }}
            >
              New users this month
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 24,
                fontWeight: 900,
                color: "var(--text, #0D1B3E)",
              }}
            >
              {statistics.newUsersThisMonth}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}