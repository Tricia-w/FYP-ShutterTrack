import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

import AdminLayout from "./AdminLayout";
import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminCoaches from "./AdminCoaches";
import AdminClubs from "./AdminClubs";
import AdminReports from "./AdminReports";
import AdminLogs from "./AdminLogs";
import AdminSettings from "./AdminSettings";

const capitalise = (value = "") =>
  value
    ? value.charAt(0).toUpperCase() +
      value.slice(1).toLowerCase()
    : "";

const formatMonthYear = (value) => {
  if (!value) return "–";

  return new Date(value).toLocaleDateString("en-MY", {
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "Never";

  return new Date(value).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getActivityStatus = (lastSeenAt) => {
  if (!lastSeenAt) return "Never active";

  const difference =
    Date.now() - new Date(lastSeenAt).getTime();

  const fiveMinutes = 5 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  if (difference <= fiveMinutes) return "Online";
  if (difference <= thirtyDays) return "Active";
  return "Inactive";
};

export default function Admin() {
  const { profile } = useAuth();

  const [activePage, setActivePage] =
    useState("dashboard");

  const [users, setUsers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState("");

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_users")
      .select(`
        user_id,
        email,
        full_name,
        username,
        role,
        setup_completed,
        account_status,
        last_seen_at,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setUsers(
      (data || []).map((row) => ({
        id: row.user_id,
        userId: row.user_id,
        name:
          row.full_name ||
          row.username ||
          row.email ||
          "Unnamed user",
        email: row.email || "–",
        username: row.username || "",
        role: capitalise(row.role || "player"),
        accountStatus: capitalise(
          row.account_status || "active"
        ),
        activityStatus: getActivityStatus(
          row.last_seen_at
        ),
        lastSeenAt: row.last_seen_at,
        lastSeenLabel: formatDateTime(
          row.last_seen_at
        ),
        joined: formatMonthYear(row.created_at),
        setupCompleted: Boolean(row.setup_completed),
      }))
    );
  }, []);

  const loadCoaches = useCallback(async () => {
    const [
      publicCoachResult,
      verificationResult,
    ] = await Promise.all([
      supabase
        .from("public_coaches")
        .select(`
          id,
          user_id,
          display_name,
          headline,
          club,
          state,
          coaching_level,
          years_experience,
          specialties,
          player_levels,
          session_types,
          certification,
          certification_issuer,
          certification_issue_date,
          certification_expiry_date,
          certification_file_url,
          max_players,
          is_accepting_players,
          training_venue,
          availability,
          phone,
          instagram,
          bio,
          coaching_philosophy,
          achievements,
          avatar_url,
          created_at,
          updated_at
        `)
        .order("display_name", { ascending: true }),

      supabase
        .from("coach_profiles")
        .select(`
          user_id,
          verification_status,
          verified_at,
          verified_by,
          rejection_reason
        `),
    ]);

    if (publicCoachResult.error) {
      throw publicCoachResult.error;
    }

    if (verificationResult.error) {
      throw verificationResult.error;
    }

    const coachRows = publicCoachResult.data || [];

    const coachUserIds = [
      ...new Set(
        coachRows
          .map((coach) => coach.user_id)
          .filter(Boolean)
      ),
    ];

    let appUsers = [];

    if (coachUserIds.length > 0) {
      const { data, error } = await supabase
        .from("app_users")
        .select(
          "user_id, email, full_name, account_status"
        )
        .in("user_id", coachUserIds);

      if (error) throw error;
      appUsers = data || [];
    }

    const appUserMap = new Map(
      appUsers.map((row) => [
        String(row.user_id),
        row,
      ])
    );

    const verificationMap = new Map(
      (verificationResult.data || []).map((row) => [
        String(row.user_id),
        row,
      ])
    );

    setCoaches(
      coachRows.map((row) => {
        const appUser = appUserMap.get(
          String(row.user_id)
        );

        const verification = verificationMap.get(
          String(row.user_id)
        );

        const certificates = row.certification
          ? [
              {
                id: `${row.user_id}-certificate`,
                name: row.certification,
                issuer:
                  row.certification_issuer ||
                  "Issuer not provided",
                fileUrl:
                  row.certification_file_url || "",
                issueDate:
                  row.certification_issue_date || null,
                expiryDate:
                  row.certification_expiry_date || null,
              },
            ]
          : [];

        return {
          id: row.id,
          userId: row.user_id,
          name:
            row.display_name ||
            appUser?.full_name ||
            "Unnamed coach",
          email: appUser?.email || "–",
          avatarUrl: row.avatar_url || "",
          headline: row.headline || "",
          club: row.club || "No club",
          state: row.state || "No state",
          level:
            row.coaching_level ||
            "Level not provided",
          experience:
            Number(row.years_experience) || 0,
          specialisation:
            Array.isArray(row.specialties) &&
            row.specialties.length > 0
              ? row.specialties.join(", ")
              : "Not provided",
          playerLevels:
            Array.isArray(row.player_levels)
              ? row.player_levels
              : [],
          sessionTypes:
            Array.isArray(row.session_types)
              ? row.session_types
              : [],
          certifications: certificates,
          status: capitalise(
            verification?.verification_status ||
              "pending"
          ),
          verifiedAt:
            verification?.verified_at || null,
          rejectionReason:
            verification?.rejection_reason || "",
          maxPlayers:
            Number(row.max_players) || 0,
          acceptingPlayers:
            Boolean(row.is_accepting_players),
          trainingVenue:
            row.training_venue || "",
          availability:
            row.availability || "",
          phone: row.phone || "",
          instagram: row.instagram || "",
          bio: row.bio || "",
          coachingPhilosophy:
            row.coaching_philosophy || "",
          achievements:
            row.achievements || "",
          accountStatus:
            appUser?.account_status || "active",
        };
      })
    );
  }, []);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_activity_logs")
      .select(`
        id,
        admin_user_id,
        target_user_id,
        action,
        detail,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    setLogs(
      (data || []).map((row) => ({
        id: row.id,
        action: row.action,
        detail: row.detail,
        admin:
          row.admin_user_id === profile?.user_id
            ? profile?.full_name || "Admin"
            : "Administrator",
        time: formatDateTime(row.created_at),
      }))
    );
  }, [profile?.full_name, profile?.user_id]);

  const refreshAdminData = useCallback(async () => {
    setLoading(true);
    setAdminError("");

    try {
      await Promise.all([
        loadUsers(),
        loadCoaches(),
        loadLogs(),
      ]);
    } catch (error) {
      console.error("Admin data load error:", error);
      setAdminError(
        error.message ||
          "Unable to load admin data."
      );
    } finally {
      setLoading(false);
    }
  }, [loadCoaches, loadLogs, loadUsers]);

  const refreshCoaches = useCallback(async () => {
    setAdminError("");

    try {
      await Promise.all([
        loadCoaches(),
        loadLogs(),
      ]);
    } catch (error) {
      console.error(
        "Coach refresh error:",
        error
      );
      setAdminError(
        error.message ||
          "Unable to refresh coach data."
      );
    }
  }, [loadCoaches, loadLogs]);

  useEffect(() => {
    refreshAdminData();
  }, [refreshAdminData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setUsers((current) =>
        current.map((item) => ({
          ...item,
          activityStatus: getActivityStatus(
            item.lastSeenAt
          ),
          lastSeenLabel: formatDateTime(
            item.lastSeenAt
          ),
        }))
      );
    }, 60 * 1000);

    return () =>
      window.clearInterval(intervalId);
  }, []);

  const pendingCoachCount = useMemo(
    () =>
      coaches.filter(
        (coach) => coach.status === "Pending"
      ).length,
    [coaches]
  );

  const pendingReportCount = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.status === "Pending" ||
          report.status === "Reviewing"
      ).length,
    [reports]
  );

  const addLog = async () => {
    await loadLogs();
  };

  const renderPage = () => {
    if (loading) {
      return (
        <div
          style={{
            background: "#fff",
            padding: 30,
            borderRadius: 16,
            color: "#8892A4",
          }}
        >
          Loading admin data...
        </div>
      );
    }

    switch (activePage) {
      case "users":
        return (
          <AdminUsers
            users={users}
            currentAdminId={profile?.user_id}
            refreshUsers={refreshAdminData}
          />
        );

      case "coaches":
        return (
          <AdminCoaches
            coaches={coaches}
            refreshCoaches={refreshCoaches}
          />
        );

      case "clubs":
        return <AdminClubs />;

      case "reports":
        return (
          <AdminReports
            reports={reports}
            setReports={setReports}
            addLog={addLog}
          />
        );

      case "logs":
        return <AdminLogs logs={logs} />;

      case "settings":
        return <AdminSettings />;

      default:
        return (
          <AdminDashboard
            users={users}
            coaches={coaches}
            reports={reports}
            logs={logs}
            setActivePage={setActivePage}
          />
        );
    }
  };

  return (
    <AdminLayout
      activePage={activePage}
      setActivePage={setActivePage}
      pendingCoachCount={pendingCoachCount}
      pendingReportCount={pendingReportCount}
    >
      {adminError && (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            background: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 13,
          }}
        >
          {adminError}
        </div>
      )}

      {renderPage()}
    </AdminLayout>
  );
}