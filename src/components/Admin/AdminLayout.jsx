import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./AdminLayout.module.css";
import AdminNotificationBell from "../Notifications/AdminNotificationBell";
import { AdminHeaderBellContext } from "./AdminShared";

const getStoredAdminName = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("adminDisplayName") || "";
};

const getInitials = (name) => {
  return (
    String(name || "Admin")
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "AD"
  );
};

export default function AdminLayout({
  activePage,
  setActivePage,
  pendingCoachCount = 0,
  pendingReportCount = 0,
  children,
}) {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const fallbackName = useMemo(() => {
    return (
      profile?.full_name ||
      profile?.username ||
      user?.user_metadata?.full_name ||
      user?.name ||
      getStoredAdminName() ||
      "Admin"
    );
  }, [profile, user]);

  const [adminDisplayName, setAdminDisplayName] =
    useState(fallbackName);

  useEffect(() => {
    setAdminDisplayName(
      getStoredAdminName() ||
        profile?.full_name ||
        profile?.username ||
        user?.user_metadata?.full_name ||
        user?.name ||
        "Admin"
    );
  }, [profile, user]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      const nextName =
        event?.detail?.display_name ||
        event?.detail?.full_name;

      if (!nextName?.trim()) {
        return;
      }

      const cleanName = nextName.trim();

      setAdminDisplayName(cleanName);
      localStorage.setItem("adminDisplayName", cleanName);
    };

    window.addEventListener(
      "profile-updated",
      handleProfileUpdated
    );

    return () => {
      window.removeEventListener(
        "profile-updated",
        handleProfileUpdated
      );
    };
  }, []);

  const initials = useMemo(
    () => getInitials(adminDisplayName),
    [adminDisplayName]
  );

  const navItems = [
    {
      key: "dashboard",
      label: "Overview",
      icon: "▦",
    },
    {
      key: "users",
      label: "User Management",
      icon: "♙",
    },
    {
      key: "coaches",
      label: "Coach Verification",
      icon: "✓",
      count: Number(pendingCoachCount || 0),
    },
    {
      key: "clubs",
      label: "Club Management",
      icon: "⌂",
    },
    {
      key: "reports",
      label: "Reports",
      icon: "!",
      count: Number(pendingReportCount || 0),
    },
    {
      key: "logs",
      label: "Activity Logs",
      icon: "≡",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "⚙",
    },
  ];

  const handleLogout = async () => {
    try {
      localStorage.removeItem("adminDisplayName");

      if (logout) {
        await logout();
      }

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      console.error("Admin logout error:", error);
    }
  };

  return (
    <div className={styles.adminApp}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoMark}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              width="18"
              height="18"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="white"
                strokeWidth="1.5"
              />

              <path
                d="M6 10 Q10 4 14 10 Q10 16 6 10Z"
                fill="white"
                opacity="0.8"
              />

              <circle
                cx="10"
                cy="10"
                r="2"
                fill="white"
              />
            </svg>
          </div>

          <div className={styles.logoName}>
            ShuttleTrack
          </div>

          <div className={styles.logoSub}>
            Admin Panel
          </div>
        </div>

        <nav className={styles.navSection}>
          <div className={styles.navLabel}>
            Administration
          </div>

          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActivePage(item.key)}
              className={`${styles.navItem} ${
                activePage === item.key
                  ? styles.active
                  : ""
              }`}
            >
              <span className={styles.navIcon}>
                {item.icon}
              </span>

              <span className={styles.navText}>
                {item.label}
              </span>

              {item.count > 0 && (
                <span className={styles.navCount}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.sidebarUser}>
            <div className={styles.userAv}>
              {initials}
            </div>

            <div className={styles.userText}>
              <div
                className={styles.userName}
                title={adminDisplayName}
              >
                {adminDisplayName}
              </div>

              <div className={styles.userRole}>
                Administrator
              </div>
            </div>
          </div>

          <div className={styles.sidebarLogout}>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <AdminHeaderBellContext.Provider
          value={
            <AdminNotificationBell
              setActivePage={setActivePage}
            />
          }
        >
          {children}
        </AdminHeaderBellContext.Provider>
      </main>
    </div>
  );
}