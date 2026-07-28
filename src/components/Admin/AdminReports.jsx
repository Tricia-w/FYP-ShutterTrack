import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import {
  EmptyState,
  Modal,
  SectionHeader,
  TableCard,
  buttonBase,
  inputStyle,
} from "./AdminShared";

const REPORT_FILTERS = [
  "All",
  "Pending",
  "Reviewing",
  "Resolved",
  "Dismissed",
];

const DELETION_FILTERS = [
  "All",
  "Pending",
  "Reviewing",
  "Approved",
  "Rejected",
  "Cancelled",
];

const capitalise = (value = "") =>
  value
    ? value.charAt(0).toUpperCase() +
      value.slice(1).toLowerCase()
    : "";

const normaliseReportStatus = (value) => {
  const status = String(value || "pending")
    .trim()
    .toLowerCase();

  if (status === "submitted" || status === "pending") {
    return "Pending";
  }

  if (status === "reviewing") {
    return "Reviewing";
  }

  if (status === "resolved") {
    return "Resolved";
  }

  if (status === "dismissed" || status === "rejected") {
    return "Dismissed";
  }

  return capitalise(status);
};

const normaliseDeletionStatus = (value) => {
  const status = String(value || "pending")
    .trim()
    .toLowerCase();

  const allowed = [
    "pending",
    "reviewing",
    "approved",
    "rejected",
    "cancelled",
  ];

  return allowed.includes(status)
    ? capitalise(status)
    : "Pending";
};

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

function StatusBadge({ value }) {
  const options = {
    Pending: {
      background: "#FFF7ED",
      color: "#C2410C",
    },
    Reviewing: {
      background: "#DBEAFE",
      color: "#1D4ED8",
    },
    Resolved: {
      background: "#DDF8F0",
      color: "#00976C",
    },
    Approved: {
      background: "#DDF8F0",
      color: "#00976C",
    },
    Dismissed: {
      background: "#F3F4F6",
      color: "#6B7280",
    },
    Rejected: {
      background: "#FEE2E2",
      color: "#B91C1C",
    },
    Cancelled: {
      background: "#F3F4F6",
      color: "#6B7280",
    },
  };

  const current = options[value] || options.Pending;

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 10px",
        borderRadius: 999,
        background: current.background,
        color: current.color,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {value}
    </span>
  );
}

function RoleBadge({ role }) {
  const isCoach =
    String(role || "").toLowerCase() === "coach";

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 9px",
        borderRadius: 999,
        background: isCoach ? "#EDE9FE" : "#E8EFFE",
        color: isCoach ? "#6D28D9" : "#1A5FFF",
        fontSize: 10,
        fontWeight: 800,
      }}
    >
      {isCoach ? "Coach" : "Player"}
    </span>
  );
}

export default function AdminReports() {
  const [tab, setTab] = useState("deletions");

  const [reports, setReports] = useState([]);
  const [deletionRequests, setDeletionRequests] =
    useState([]);

  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const [pendingStatus, setPendingStatus] =
    useState("");
  const [adminNote, setAdminNote] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        reportResult,
        deletionResult,
        appUserResult,
      ] = await Promise.all([
        supabase
          .from("user_reports")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),
        supabase
          .from("account_deletion_requests")
          .select("*")
          .order("requested_at", {
            ascending: false,
          }),
        supabase
          .from("app_users")
          .select(
            "user_id, full_name, email, role, account_status",
          ),
      ]);

      if (reportResult.error) {
        throw reportResult.error;
      }

      if (deletionResult.error) {
        throw deletionResult.error;
      }

      if (appUserResult.error) {
        throw appUserResult.error;
      }

      const users = appUserResult.data || [];

      const userMap = new Map(
        users.map((user) => [
          String(user.user_id),
          user,
        ]),
      );

      const formattedReports = (
        reportResult.data || []
      ).map((report) => {
        const reporter = userMap.get(
          String(report.reporter_user_id),
        );

        const reportedUser = report.reported_user_id
          ? userMap.get(
              String(report.reported_user_id),
            )
          : null;

        return {
          kind: "report",
          id: report.id,
          reporterUserId:
            report.reporter_user_id,
          reportedUserId:
            report.reported_user_id,
          reporterName:
            reporter?.full_name ||
            reporter?.email ||
            "Unknown user",
          reporterEmail:
            reporter?.email || "—",
          reportedName:
            reportedUser?.full_name ||
            report.subject ||
            "General report",
          reportedEmail:
            reportedUser?.email || "—",
          role:
            reportedUser?.role ||
            report.category ||
            "player",
          category:
            report.category || "General",
          subject:
            report.subject || "User report",
          description:
            report.description ||
            "No description provided.",
          status: normaliseReportStatus(
            report.status,
          ),
          adminNote:
            report.admin_note || "",
          requestedAt:
            report.created_at ||
            report.requested_at,
        };
      });

      const formattedDeletions = (
        deletionResult.data || []
      ).map((request) => {
        const user = userMap.get(
          String(request.user_id),
        );

        return {
          kind: "deletion",
          id: request.id,
          userId: request.user_id,
          name:
            request.full_name ||
            user?.full_name ||
            request.email ||
            user?.email ||
            "Unknown account",
          email:
            request.email ||
            user?.email ||
            "—",
          role:
            request.role ||
            user?.role ||
            "player",
          accountStatus:
            user?.account_status ||
            "unknown",
          reason:
            request.reason ||
            "No reason provided",
          details:
            request.details || "",
          status:
            normaliseDeletionStatus(
              request.status,
            ),
          adminNote:
            request.admin_note || "",
          requestedAt:
            request.requested_at ||
            request.created_at,
          reviewedAt:
            request.reviewed_at || null,
        };
      });

      setReports(formattedReports);
      setDeletionRequests(
        formattedDeletions,
      );

      setSelected((current) => {
        if (!current) return null;

        const source =
          current.kind === "report"
            ? formattedReports
            : formattedDeletions;

        return (
          source.find(
            (item) => item.id === current.id,
          ) || null
        );
      });
    } catch (error) {
      console.error(
        "Unable to load reports and requests:",
        error,
      );

      setErrorMessage(
        error.message ||
          "Unable to load reports and requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel(
        `admin-reports-requests-${Date.now()}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_reports",
        },
        loadData,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "account_deletion_requests",
        },
        loadData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const items =
    tab === "reports"
      ? reports
      : deletionRequests;

  const filters =
    tab === "reports"
      ? REPORT_FILTERS
      : DELETION_FILTERS;

  const counts = useMemo(() => {
    const result = {};

    filters.forEach((status) => {
      result[status] =
        status === "All"
          ? items.length
          : items.filter(
              (item) =>
                item.status === status,
            ).length;
    });

    return result;
  }, [filters, items]);

  const visibleItems = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return items.filter((item) => {
      const matchesStatus =
        filter === "All" ||
        item.status === filter;

      const values =
        item.kind === "report"
          ? [
              item.reporterName,
              item.reporterEmail,
              item.reportedName,
              item.reportedEmail,
              item.subject,
              item.category,
              item.description,
            ]
          : [
              item.name,
              item.email,
              item.role,
              item.accountStatus,
              item.reason,
              item.details,
            ];

      const matchesSearch =
        !query ||
        values.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );

      return (
        matchesStatus && matchesSearch
      );
    });
  }, [filter, items, search]);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setFilter("All");
    setSearch("");
    setSelected(null);
    setPendingStatus("");
    setAdminNote("");
    setErrorMessage("");
  };

  const openReview = (item) => {
    setSelected(item);
    setPendingStatus("");
    setAdminNote(item.adminNote || "");
    setErrorMessage("");
  };

  const beginStatusUpdate = (status) => {
    if (!selected) return;

    setPendingStatus(status);
    setAdminNote(selected.adminNote || "");
    setErrorMessage("");
  };

  const saveStatus = async () => {
    if (!selected || !pendingStatus) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user: adminUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!adminUser?.id) {
        throw new Error(
          "Please log in as an administrator again.",
        );
      }

      const now = new Date().toISOString();

      if (selected.kind === "report") {
        const { error } = await supabase
          .from("user_reports")
          .update({
            status:
              pendingStatus.toLowerCase(),
            admin_note:
              adminNote.trim() || null,
            updated_at: now,
          })
          .eq("id", selected.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(
            "account_deletion_requests",
          )
          .update({
            status:
              pendingStatus.toLowerCase(),
            admin_note:
              adminNote.trim() || null,
            reviewed_at: now,
            reviewed_by: adminUser.id,
          })
          .eq("id", selected.id);

        if (error) throw error;
      }

      const targetName =
        selected.kind === "report"
          ? selected.reportedName
          : selected.name;

      const noun =
        selected.kind === "report"
          ? "Report"
          : "Deletion request";

      const savedStatus = pendingStatus;

      setSelected(null);
      setPendingStatus("");
      setAdminNote("");

      await loadData();

      setSuccessMessage(
        `${noun} for ${targetName} was marked as ${savedStatus}. The action was added to Activity Logs automatically.`,
      );
    } catch (error) {
      console.error(
        "Unable to update status:",
        error,
      );

      setErrorMessage(
        error.message ||
          "Unable to update the selected item.",
      );
    } finally {
      setSaving(false);
    }
  };

  const reportActions = [
    {
      label: "Dismiss",
      status: "Dismissed",
      background: "#F3F4F6",
      color: "#6B7280",
    },
    {
      label: "Mark reviewing",
      status: "Reviewing",
      background: "#DBEAFE",
      color: "#2563EB",
    },
    {
      label: "Resolve",
      status: "Resolved",
      background: "#00976C",
      color: "#FFFFFF",
    },
  ];

  const deletionActions = [
    {
      label: "Reject",
      status: "Rejected",
      background: "#FEE2E2",
      color: "#B91C1C",
    },
    {
      label: "Mark reviewing",
      status: "Reviewing",
      background: "#DBEAFE",
      color: "#2563EB",
    },
    {
      label: "Approve request",
      status: "Approved",
      background: "#00976C",
      color: "#FFFFFF",
    },
  ];

  const rowStyle = {
    cursor: "pointer",
    transition: "background 0.15s ease",
  };

  const handleRowKeyDown = (
    event,
    item,
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openReview(item);
    }
  };

  return (
    <>
      <SectionHeader
        title="Reports & Requests"
        subtitle="Review user reports and account deletion requests"
        action={
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              ...buttonBase,
              padding: "10px 16px",
              background: "#1A5FFF",
              color: "#FFFFFF",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        }
      />

      {errorMessage &&
        !pendingStatus && (
          <div
            style={{
              marginBottom: 14,
              padding: 13,
              borderRadius: 11,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#B91C1C",
              fontSize: 12,
            }}
          >
            {errorMessage}
          </div>
        )}

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() =>
            switchTab("reports")
          }
          style={{
            ...buttonBase,
            minWidth: 180,
            padding: "12px 18px",
            border:
              tab === "reports"
                ? "1.5px solid #0D1B3E"
                : "1.5px solid #DDE3EF",
            background:
              tab === "reports"
                ? "#0D1B3E"
                : "#FFFFFF",
            color:
              tab === "reports"
                ? "#FFFFFF"
                : "#6B7280",
          }}
        >
          User Reports · {reports.length}
        </button>

        <button
          type="button"
          onClick={() =>
            switchTab("deletions")
          }
          style={{
            ...buttonBase,
            minWidth: 190,
            padding: "12px 18px",
            border:
              tab === "deletions"
                ? "1.5px solid #0D1B3E"
                : "1.5px solid #DDE3EF",
            background:
              tab === "deletions"
                ? "#0D1B3E"
                : "#FFFFFF",
            color:
              tab === "deletions"
                ? "#FFFFFF"
                : "#6B7280",
          }}
        >
          Deletion Requests ·{" "}
          {deletionRequests.length}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
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
          {filters.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() =>
                setFilter(status)
              }
              style={{
                ...buttonBase,
                padding: "9px 14px",
                border:
                  filter === status
                    ? "1.5px solid #0D1B3E"
                    : "1.5px solid #DDE3EF",
                background:
                  filter === status
                    ? "#0D1B3E"
                    : "#FFFFFF",
                color:
                  filter === status
                    ? "#FFFFFF"
                    : "#6B7280",
              }}
            >
              {status} · {counts[status]}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder={
            tab === "reports"
              ? "Search user reports"
              : "Search deletion requests"
          }
          style={{
            ...inputStyle,
            width: 330,
            maxWidth: "100%",
          }}
        />
      </div>

      <TableCard>
        <div style={{ overflowX: "auto" }}>
          {tab === "reports" ? (
            <table
              style={{
                width: "100%",
                minWidth: 950,
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom:
                      "2px solid #EEF1F8",
                  }}
                >
                  {[
                    "Reporter",
                    "Reported account",
                    "Type",
                    "Subject",
                    "Requested",
                    "Status",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding:
                          "14px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        color: "#8892A4",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 38,
                        textAlign:
                          "center",
                        color:
                          "#8892A4",
                      }}
                    >
                      Loading reports...
                    </td>
                  </tr>
                ) : visibleItems.length ===
                  0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState text="No user reports found." />
                    </td>
                  </tr>
                ) : (
                  visibleItems.map(
                    (report, index) => (
                      <tr
                        key={report.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          openReview(report)
                        }
                        onKeyDown={(event) =>
                          handleRowKeyDown(
                            event,
                            report,
                          )
                        }
                        title={`Review report for ${report.reportedName}`}
                        style={{
                          ...rowStyle,
                          borderBottom:
                            index <
                            visibleItems.length -
                              1
                              ? "1px solid #EEF1F8"
                              : "none",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background =
                            "#F8FAFD";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background =
                            "transparent";
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight:
                                800,
                            }}
                          >
                            {report.reporterName}
                          </div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 10,
                              color:
                                "#8892A4",
                            }}
                          >
                            {report.reporterEmail}
                          </div>
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight:
                                800,
                            }}
                          >
                            {report.reportedName}
                          </div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 10,
                              color:
                                "#8892A4",
                            }}
                          >
                            {report.reportedEmail}
                          </div>
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <RoleBadge
                            role={report.role}
                          />
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                            fontSize: 12,
                          }}
                        >
                          {report.subject}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                            fontSize: 12,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatDate(
                            report.requestedAt,
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <StatusBadge
                            value={report.status}
                          />
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          ) : (
            <table
              style={{
                width: "100%",
                minWidth: 950,
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom:
                      "2px solid #EEF1F8",
                  }}
                >
                  {[
                    "Account",
                    "Role",
                    "Account status",
                    "Reason",
                    "Requested",
                    "Status",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding:
                          "14px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        color: "#8892A4",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 38,
                        textAlign:
                          "center",
                        color:
                          "#8892A4",
                      }}
                    >
                      Loading deletion requests...
                    </td>
                  </tr>
                ) : visibleItems.length ===
                  0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState text="No deletion requests found." />
                    </td>
                  </tr>
                ) : (
                  visibleItems.map(
                    (request, index) => (
                      <tr
                        key={request.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          openReview(request)
                        }
                        onKeyDown={(event) =>
                          handleRowKeyDown(
                            event,
                            request,
                          )
                        }
                        title={`Review deletion request for ${request.name}`}
                        style={{
                          ...rowStyle,
                          borderBottom:
                            index <
                            visibleItems.length -
                              1
                              ? "1px solid #EEF1F8"
                              : "none",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background =
                            "#F8FAFD";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background =
                            "transparent";
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight:
                                800,
                            }}
                          >
                            {request.name}
                          </div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 10,
                              color:
                                "#8892A4",
                            }}
                          >
                            {request.email}
                          </div>
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <RoleBadge
                            role={request.role}
                          />
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                            fontSize: 12,
                          }}
                        >
                          {capitalise(
                            request.accountStatus,
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                            fontSize: 12,
                            maxWidth: 300,
                          }}
                        >
                          {request.reason}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                            fontSize: 12,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatDate(
                            request.requestedAt,
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 16px",
                          }}
                        >
                          <StatusBadge
                            value={request.status}
                          />
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </TableCard>

      {selected && !pendingStatus && (
        <Modal
          title={
            selected.kind === "report"
              ? "Review user report"
              : "Review deletion request"
          }
          onClose={() =>
            setSelected(null)
          }
          maxWidth={650}
        >
          {selected.kind === "report" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  [
                    "Reporter",
                    selected.reporterName,
                  ],
                  [
                    "Reported account",
                    selected.reportedName,
                  ],
                  [
                    "Category",
                    selected.category,
                  ],
                  [
                    "Current status",
                    selected.status,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: 12,
                        borderRadius: 11,
                        border:
                          "1px solid #DDE3EF",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color:
                            "#8892A4",
                          fontWeight:
                            800,
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          fontWeight:
                            700,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div
                style={{
                  marginTop: 13,
                  padding: 14,
                  borderRadius: 11,
                  background: "#FFF7ED",
                  color: "#9A3412",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {selected.subject}
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 11,
                  border:
                    "1px solid #DDE3EF",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              >
                {selected.description}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  [
                    "Account",
                    selected.name,
                  ],
                  [
                    "Email",
                    selected.email,
                  ],
                  [
                    "Role",
                    capitalise(
                      selected.role,
                    ),
                  ],
                  [
                    "Account status",
                    capitalise(
                      selected.accountStatus,
                    ),
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: 12,
                        borderRadius: 11,
                        border:
                          "1px solid #DDE3EF",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color:
                            "#8892A4",
                          fontWeight:
                            800,
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          fontWeight:
                            700,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div
                style={{
                  marginTop: 13,
                  padding: 14,
                  borderRadius: 11,
                  background: "#FFF7ED",
                  color: "#9A3412",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <strong>Reason:</strong>{" "}
                {selected.reason}
              </div>

              {selected.details && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 11,
                    border:
                      "1px solid #DDE3EF",
                    whiteSpace:
                      "pre-wrap",
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  {selected.details}
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#EEF3FF",
                  color: "#1D4ED8",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Approving this request only
                changes its review status. It
                does not directly delete the
                Supabase Auth account.
              </div>
            </>
          )}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              gap: 8,
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            {(selected.kind === "report"
              ? reportActions
              : deletionActions
            ).map((action) => (
              <button
                key={action.status}
                type="button"
                onClick={() =>
                  beginStatusUpdate(
                    action.status,
                  )
                }
                style={{
                  ...buttonBase,
                  padding: "10px 14px",
                  background:
                    action.background,
                  color: action.color,
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {selected && pendingStatus && (
        <Modal
          title={`Confirm ${pendingStatus.toLowerCase()}`}
          onClose={() => {
            if (!saving) {
              setPendingStatus("");
              setErrorMessage("");
            }
          }}
          maxWidth={500}
        >
          <p
            style={{
              marginTop: 0,
              color: "#6B7280",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {selected.kind === "report"
              ? `The report will be marked as ${pendingStatus}.`
              : `The account deletion request will be marked as ${pendingStatus}.`}
          </p>

          <textarea
            rows={4}
            maxLength={1000}
            value={adminNote}
            onChange={(event) =>
              setAdminNote(
                event.target.value,
              )
            }
            placeholder="Add an admin note..."
            style={{
              ...inputStyle,
              width: "100%",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />

          {errorMessage && (
            <div
              style={{
                marginTop: 10,
                padding: 11,
                borderRadius: 10,
                background: "#FEF2F2",
                color: "#B91C1C",
                fontSize: 12,
              }}
            >
              {errorMessage}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setPendingStatus("");
                setErrorMessage("");
              }}
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background: "#F3F4F6",
                color: "#6B7280",
              }}
            >
              Go back
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={saveStatus}
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background:
                  pendingStatus ===
                    "Approved" ||
                  pendingStatus ===
                    "Resolved"
                    ? "#00976C"
                    : pendingStatus ===
                        "Rejected" ||
                      pendingStatus ===
                        "Dismissed"
                    ? "#DC2626"
                    : "#2563EB",
                color: "#FFFFFF",
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : `Confirm ${pendingStatus.toLowerCase()}`}
            </button>
          </div>
        </Modal>
      )}

      {successMessage && (
        <Modal
          title="Request updated"
          onClose={() =>
            setSuccessMessage("")
          }
          maxWidth={470}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 11,
              background: "#ECFDF5",
              color: "#047857",
              lineHeight: 1.55,
              fontSize: 13,
            }}
          >
            {successMessage}
          </div>
        </Modal>
      )}
    </>
  );
}