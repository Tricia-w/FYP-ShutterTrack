import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  Avatar,
  Field,
  SectionHeader,
  inputStyle,
} from "./AdminShared";

const getSavedTheme = () => {
  if (typeof window === "undefined") return null;

  const savedTheme = localStorage.getItem("shuttleTheme");

  if (savedTheme === "dark") return true;
  if (savedTheme === "light") return false;

  return null;
};

const applyTheme = (darkMode) => {
  const theme = darkMode ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("shuttleTheme", theme);
};

const roleLabel = (role) => {
  const value = String(role || "admin").toLowerCase();

  if (value === "admin") return "Administrator";

  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function AdminSettings() {
  const {
    user,
    profile,
    refreshProfile,
  } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "admin",
  });

  const [darkMode, setDarkMode] = useState(
    getSavedTheme() ?? false
  );

  const [loading, setLoading] = useState(true);
  const [accountSaveStatus, setAccountSaveStatus] =
    useState("");
  const [themeSaveStatus, setThemeSaveStatus] =
    useState("");
  const [accountError, setAccountError] =
    useState("");
  const [themeError, setThemeError] =
    useState("");
  const [lastUpdated, setLastUpdated] =
    useState("—");

  const accountLoadedRef = useRef(false);
  const initialFormRef = useRef({
    name: "",
  });
  const accountSaveTimerRef = useRef(null);
  const accountStatusTimerRef = useRef(null);
  const themeStatusTimerRef = useRef(null);

  const adminName = useMemo(() => {
    return (
      form.name ||
      profile?.full_name ||
      profile?.username ||
      user?.user_metadata?.full_name ||
      user?.name ||
      "Admin"
    );
  }, [form.name, profile, user]);

  useEffect(() => {
    let mounted = true;

    const loadAdminSettings = async () => {
      setLoading(true);
      setAccountError("");
      setThemeError("");

      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authUser?.id) {
          throw new Error("Please log in again.");
        }

        const [
          appUserResult,
          adminProfileResult,
          settingsResult,
        ] = await Promise.all([
          supabase
            .from("app_users")
            .select(`
              user_id,
              full_name,
              username,
              email,
              role,
              account_status,
              updated_at
            `)
            .eq("user_id", authUser.id)
            .maybeSingle(),

          supabase
            .from("admin_profiles")
            .select(`
              user_id,
              display_name,
              updated_at
            `)
            .eq("user_id", authUser.id)
            .maybeSingle(),

          supabase
            .from("user_settings")
            .select(`
              user_id,
              dark_mode,
              updated_at
            `)
            .eq("user_id", authUser.id)
            .maybeSingle(),
        ]);

        if (appUserResult.error) {
          throw appUserResult.error;
        }

        if (adminProfileResult.error) {
          throw adminProfileResult.error;
        }

        if (settingsResult.error) {
          throw settingsResult.error;
        }

        const appUser = appUserResult.data;
        const adminProfile =
          adminProfileResult.data;
        const savedSettings =
          settingsResult.data;

        if (
          appUser?.role &&
          String(appUser.role).toLowerCase() !==
            "admin"
        ) {
          throw new Error(
            "The current account is not an administrator."
          );
        }

        if (
          appUser?.account_status &&
          String(appUser.account_status).toLowerCase() !==
            "active"
        ) {
          throw new Error(
            "This administrator account is not active."
          );
        }

        const loadedName =
          adminProfile?.display_name ||
          authUser.user_metadata?.full_name ||
          appUser?.full_name ||
          appUser?.username ||
          "Admin";

        const loadedEmail =
          appUser?.email ||
          authUser.email ||
          "";

        const loadedRole =
          appUser?.role || "admin";

        const localTheme = getSavedTheme();

        const loadedDarkMode =
          localTheme !== null
            ? localTheme
            : Boolean(savedSettings?.dark_mode);

        if (!mounted) return;

        const loadedForm = {
          name: loadedName,
          email: loadedEmail,
          role: loadedRole,
        };

        setForm(loadedForm);

        initialFormRef.current = {
          name: loadedName.trim(),
        };

        setDarkMode(loadedDarkMode);
        applyTheme(loadedDarkMode);

        const latestUpdated =
          adminProfile?.updated_at ||
          savedSettings?.updated_at ||
          appUser?.updated_at;

        setLastUpdated(
          latestUpdated
            ? new Date(latestUpdated).toLocaleString(
                "en-MY"
              )
            : "—"
        );

        accountLoadedRef.current = true;
      } catch (error) {
        console.error(
          "Load admin settings error:",
          error
        );

        if (!mounted) return;

        setAccountError(
          error?.message ||
            "Unable to load administrator settings."
        );

        const fallbackTheme =
          getSavedTheme() ?? false;

        setDarkMode(fallbackTheme);
        applyTheme(fallbackTheme);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAdminSettings();

    return () => {
      mounted = false;

      if (accountSaveTimerRef.current) {
        window.clearTimeout(
          accountSaveTimerRef.current
        );
      }

      if (accountStatusTimerRef.current) {
        window.clearTimeout(
          accountStatusTimerRef.current
        );
      }

      if (themeStatusTimerRef.current) {
        window.clearTimeout(
          themeStatusTimerRef.current
        );
      }
    };
  }, []);

  const setField = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const saveAdminAccount = async (
    currentForm
  ) => {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!authUser?.id) {
      throw new Error("Please log in again.");
    }

    const cleanName = currentForm.name.trim();

    if (!cleanName) {
      throw new Error(
        "Display name cannot be empty."
      );
    }

    const now = new Date().toISOString();

    const { error: adminProfileError } =
      await supabase
        .from("admin_profiles")
        .upsert(
          {
            user_id: authUser.id,
            display_name: cleanName,
            updated_at: now,
          },
          {
            onConflict: "user_id",
          }
        );

    if (adminProfileError) {
      throw adminProfileError;
    }

    /*
      This updates Auth metadata, not public.app_users.
      It helps components that display user.user_metadata.full_name.
    */
    const { error: metadataError } =
      await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
        },
      });

    if (metadataError) {
      console.warn(
        "Auth metadata name update warning:",
        metadataError
      );
    }

    initialFormRef.current = {
      name: cleanName,
    };

    setLastUpdated(
      new Date(now).toLocaleString("en-MY")
    );

    localStorage.setItem(
      "adminDisplayName",
      cleanName
    );

    if (refreshProfile) {
      await refreshProfile();
    }

    window.dispatchEvent(
      new CustomEvent("profile-updated", {
        detail: {
          display_name: cleanName,
          full_name: cleanName,
          role: "admin",
        },
      })
    );
  };

  useEffect(() => {
    if (
      !accountLoadedRef.current ||
      loading
    ) {
      return undefined;
    }

    const cleanName = form.name.trim();

    const nameChanged =
      cleanName !==
      initialFormRef.current.name;

    /*
      Do not autosave when the page first opens.
      Only save after the display name is edited.
    */
    if (!nameChanged) {
      return undefined;
    }

    if (accountSaveTimerRef.current) {
      window.clearTimeout(
        accountSaveTimerRef.current
      );
    }

    setAccountSaveStatus("Saving...");
    setAccountError("");

    accountSaveTimerRef.current =
      window.setTimeout(async () => {
        try {
          await saveAdminAccount(form);

          setAccountSaveStatus(
            "Saved automatically"
          );

          if (accountStatusTimerRef.current) {
            window.clearTimeout(
              accountStatusTimerRef.current
            );
          }

          accountStatusTimerRef.current =
            window.setTimeout(() => {
              setAccountSaveStatus("");
            }, 1800);
        } catch (error) {
          console.error(
            "Admin account autosave error:",
            error
          );

          setAccountSaveStatus(
            "Could not save"
          );

          setAccountError(
            error?.message ||
              "Administrator information could not be saved."
          );
        }
      }, 700);

    return () => {
      if (accountSaveTimerRef.current) {
        window.clearTimeout(
          accountSaveTimerRef.current
        );
      }
    };
  }, [form.name, loading]);

  const toggleDarkMode = async () => {
    if (
      loading ||
      themeSaveStatus === "Saving..."
    ) {
      return;
    }

    const nextValue = !darkMode;

    setDarkMode(nextValue);
    applyTheme(nextValue);
    setThemeSaveStatus("Saving...");
    setThemeError("");

    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authUser?.id) {
        throw new Error("Please log in again.");
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: authUser.id,
            dark_mode: nextValue,
            updated_at: now,
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) throw error;

      setLastUpdated(
        new Date(now).toLocaleString("en-MY")
      );

      setThemeSaveStatus(
        "Saved automatically"
      );

      if (themeStatusTimerRef.current) {
        window.clearTimeout(
          themeStatusTimerRef.current
        );
      }

      themeStatusTimerRef.current =
        window.setTimeout(() => {
          setThemeSaveStatus("");
        }, 1800);
    } catch (error) {
      console.error(
        "Save admin theme error:",
        error
      );

      const revertedValue = !nextValue;

      setDarkMode(revertedValue);
      applyTheme(revertedValue);

      setThemeSaveStatus(
        "Could not save"
      );

      setThemeError(
        error?.message ||
          "Appearance setting could not be saved."
      );
    }
  };

  const ToggleSwitch = ({
    checked,
    onChange,
    disabled,
  }) => (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-label="Toggle dark mode"
      aria-pressed={checked}
      style={{
        width: 46,
        height: 24,
        borderRadius: 999,
        border: "none",
        padding: 3,
        cursor: disabled
          ? "not-allowed"
          : "pointer",
        background: checked
          ? "var(--navy, #0D1B3E)"
          : "#CBD5E1",
        display: "flex",
        alignItems: "center",
        justifyContent: checked
          ? "flex-end"
          : "flex-start",
        transition: "0.2s ease",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#FFFFFF",
          display: "block",
          boxShadow:
            "0 1px 4px rgba(0,0,0,0.18)",
        }}
      />
    </button>
  );

  const cardStyle = {
    background:
      "var(--card, #FFFFFF)",
    border:
      "1px solid var(--line, #EEF1F8)",
    borderRadius: 16,
    boxShadow:
      "0 1px 5px rgba(13,27,62,0.08)",
    padding: 24,
  };

  if (loading) {
    return (
      <>
        <SectionHeader
          title="Admin Settings"
          subtitle="Manage administrator information and appearance"
        />

        <div
          style={{
            ...cardStyle,
            maxWidth: 650,
            color:
              "var(--text-muted, #8892A4)",
            fontSize: 13,
          }}
        >
          Loading administrator settings...
        </div>
      </>
    );
  }

  return (
    <>
      <SectionHeader
        title="Admin Settings"
        subtitle="Manage administrator information and appearance"
      />

      <div
        style={{
          maxWidth: 650,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              paddingBottom: 20,
              marginBottom: 20,
              borderBottom:
                "1px solid var(--line, #EEF1F8)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Avatar
                name={adminName}
                role="Admin"
                size={48}
              />

              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color:
                      "var(--text, #0D1B3E)",
                  }}
                >
                  {adminName}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color:
                      "var(--text-muted, #8892A4)",
                    marginTop: 3,
                  }}
                >
                  {form.email ||
                    "Administrator account"}
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  accountSaveStatus ===
                  "Could not save"
                    ? "#EF4444"
                    : accountSaveStatus ===
                        "Saving..."
                      ? "var(--text-muted, #8892A4)"
                      : "#00A878",
              }}
            >
              {accountSaveStatus ||
                "Changes save automatically"}
            </span>
          </div>

          {accountError && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 10,
                border:
                  "1px solid #FECACA",
                background: "#FEF2F2",
                color: "#B91C1C",
                fontSize: 11,
                lineHeight: 1.55,
              }}
            >
              {accountError}
            </div>
          )}

          <Field label="Display name">
            <input
              style={{
                ...inputStyle,
                background:
                  "var(--card, #FFFFFF)",
                color:
                  "var(--text, #0D1B3E)",
              }}
              value={form.name}
              onChange={setField("name")}
              placeholder="Administrator name"
            />
          </Field>

          <Field label="Email address">
            <input
              style={{
                ...inputStyle,
                background:
                  "var(--card, #FFFFFF)",
                color:
                  "var(--text, #0D1B3E)",
                opacity: 0.72,
                cursor: "not-allowed",
              }}
              value={form.email}
              readOnly
              title="Login email cannot be changed from this page."
            />

            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                color:
                  "var(--text-muted, #8892A4)",
              }}
            >
              This is the administrator login
              email. Email changes require a
              separate verification process.
            </div>
          </Field>

          <Field label="Account role">
            <input
              style={{
                ...inputStyle,
                background:
                  "var(--card, #FFFFFF)",
                color:
                  "var(--text, #0D1B3E)",
                opacity: 0.72,
                cursor: "not-allowed",
              }}
              value={roleLabel(form.role)}
              readOnly
            />
          </Field>

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: 12,
              paddingTop: 14,
              marginTop: 6,
              borderTop:
                "1px solid var(--line, #EEF1F8)",
              fontSize: 12,
            }}
          >
            <span
              style={{
                color:
                  "var(--text-muted, #8892A4)",
              }}
            >
              Last updated
            </span>

            <span
              style={{
                color:
                  "var(--text, #0D1B3E)",
                fontWeight: 700,
              }}
            >
              {lastUpdated}
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color:
                  "var(--text-muted, #71809A)",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Appearance
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  themeSaveStatus ===
                  "Could not save"
                    ? "#EF4444"
                    : themeSaveStatus ===
                        "Saving..."
                      ? "var(--text-muted, #8892A4)"
                      : "#00A878",
              }}
            >
              {themeSaveStatus ||
                "Auto-saved"}
            </span>
          </div>

          {themeError && (
            <div
              style={{
                marginBottom: 12,
                padding: "9px 11px",
                borderRadius: 9,
                border:
                  "1px solid #FECACA",
                background: "#FEF2F2",
                color: "#B91C1C",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {themeError}
            </div>
          )}

          <div
            style={{
              minHeight: 50,
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 12,
              borderBottom:
                "1px solid var(--line, #EEF1F8)",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color:
                  "var(--text-muted, #6B7280)",
              }}
            >
              Dark mode
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color:
                    "var(--text-muted, #8892A4)",
                }}
              >
                {darkMode ? "On" : "Off"}
              </span>

              <ToggleSwitch
                checked={darkMode}
                onChange={toggleDarkMode}
                disabled={
                  loading ||
                  themeSaveStatus ===
                    "Saving..."
                }
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <span
              style={{
                display: "inline-flex",
                padding: "4px 9px",
                borderRadius: 999,
                background: "#E8EFFE",
                color: "#1A5FFF",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              Current mode:{" "}
              {darkMode ? "Dark" : "Light"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}