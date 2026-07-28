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

  const roleChartData = useMemo(
    () => [
      {
        label: "Players",
        value: statistics.playerCount,
        color: "#1A5FFF",
      },
      {
        label: "Coaches",
        value: statistics.coachCount,
        color: "#0891B2",
      },
      {
        label: "Admins",
        value: statistics.adminCount,
        color: "#7C3AED",
      },
    ],
    [
      statistics.playerCount,
      statistics.coachCount,
      statistics.adminCount,
    ]
  );

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

      const count = users.filter((user) => {
        const createdDate = getUserCreatedDate(user);

        return (
          createdDate &&
          createdDate >= monthStart &&
          createdDate < nextMonthStart
        );
      }).length;

      return {
        label: formatMonth(monthStart),
        count,
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
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#0D1B3E",
            }}
          >
            User role distribution
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#8892A4",
              marginTop: 3,
              marginBottom: 22,
            }}
          >
            Number of registered users by account role
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {roleChartData.map((item) => {
              const percentage =
                item.value === 0
                  ? 0
                  : Math.max(
                      (item.value / maxRoleCount) * 100,
                      5
                    );

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
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#334155",
                      }}
                    >
                      {item.label}
                    </span>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0D1B3E",
                      }}
                    >
                      {item.value}
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: 10,
                      borderRadius: 999,
                      background: "#EEF1F7",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: item.color,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#0D1B3E",
            }}
          >
            New registrations
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#8892A4",
              marginTop: 3,
            }}
          >
            User registrations during the last 6 months
          </div>

          <div
            style={{
              height: 220,
              marginTop: 24,
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
                      color: "#0D1B3E",
                      marginBottom: 7,
                    }}
                  >
                    {item.count}
                  </div>

                  <div
                    title={`${item.count} registration${
                      item.count === 1 ? "" : "s"
                    } in ${item.label}`}
                    style={{
                      width: "65%",
                      maxWidth: 46,
                      minWidth: 16,
                      height: barHeight,
                      borderRadius: "9px 9px 3px 3px",
                      background:
                        item.count === 0
                          ? "#E5EAF4"
                          : "#1A5FFF",
                      transition: "height 0.3s ease",
                    }}
                  />

                  <div
                    style={{
                      fontSize: 10,
                      color: "#8892A4",
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
            "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
          gap: 18,
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
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
                  color: "#0D1B3E",
                }}
              >
                Recent activity
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#8892A4",
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
                background: "#EEF3FF",
                color: "#1A5FFF",
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
                      ? "1px solid #EEF1F8"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    minWidth: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#EEF3FF",
                    color: "#1A5FFF",
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
                      color: "#0D1B3E",
                    }}
                  >
                    {log.action || "Administrative update"}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginTop: 2,
                    }}
                  >
                    {log.detail || "No additional details"}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "#A0A8B8",
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
                color: "#8892A4",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "#F1F5FF",
                  color: "#1A5FFF",
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
                  color: "#334155",
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
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#0D1B3E",
            }}
          >
            Attention required
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#8892A4",
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
              border: "1px solid #E6EBF5",
              background: "#FAFBFF",
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
                    color: "#0D1B3E",
                  }}
                >
                  Coach verification
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#8892A4",
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
              border: "1px solid #E6EBF5",
              background: "#FAFBFF",
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
                    color: "#0D1B3E",
                  }}
                >
                  User reports
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#8892A4",
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
              background: "#F7F9FC",
              border: "1px solid #EEF1F7",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#64748B",
              }}
            >
              New users this month
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 24,
                fontWeight: 900,
                color: "#0D1B3E",
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