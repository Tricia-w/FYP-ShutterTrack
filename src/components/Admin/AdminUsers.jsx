import React, { useCallback, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Avatar,
  Badge,
  EmptyState,
  Field,
  Modal,
  SectionHeader,
  SummaryCard,
  TableCard,
  buttonBase,
  inputStyle,
} from "./AdminShared";

const ACCOUNT_COLORS = {
  Active: { color: "#00976C", background: "#E0FAF3" },
  Suspended: { color: "#DC2626", background: "#FEE2E2" },
  Terminated: { color: "#6B7280", background: "#F3F4F6" },
};

const ACTIVITY_COLORS = {
  Online: { color: "#00976C", background: "#E0FAF3" },
  Active: { color: "#1A5FFF", background: "#E8EFFE" },
  Inactive: { color: "#D97706", background: "#FEF3C7" },
  "Never active": { color: "#6B7280", background: "#F3F4F6" },
};

const SECURITY_COLORS = {
  Verified: {
    color: "#00976C",
    background: "#E0FAF3",
  },
  "Not verified": {
    color: "#DC2626",
    background: "#FEE2E2",
  },
  "Reverify required": {
    color: "#B45309",
    background: "#FEF3C7",
  },
  Unknown: {
    color: "#6B7280",
    background: "#F3F4F6",
  },
};

const toUiAccountStatus = (value) => {
  const clean = String(value || "Active").trim().toLowerCase();

  if (clean === "suspended") return "Suspended";

  if (clean === "disabled" || clean === "terminated") return "Terminated";

  return "Active";
};

const toDatabaseAccountStatus = (value) => {
  if (value === "Terminated") return "disabled";

  return String(value || "Active").toLowerCase();
};

const getSuspendedUntil = (amount, unit) => {
  const value = Math.max(1, Number(amount) || 1);

  const date = new Date();

  if (unit === "weeks") {
    date.setDate(date.getDate() + value * 7);
  } else if (unit === "months") {
    date.setMonth(date.getMonth() + value);
  } else if (unit === "years") {
    date.setFullYear(date.getFullYear() + value);
  } else {
    date.setDate(date.getDate() + value);
  }

  return date.toISOString();
};

const getRemainingSuspensionDays = (suspendedUntil) => {
  if (!suspendedUntil) return 1;

  const endMs = new Date(suspendedUntil).getTime();

  if (!Number.isFinite(endMs)) return 1;

  const remainingMs = endMs - Date.now();

  if (remainingMs <= 0) return 1;

  return Math.max(
    1,
    Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  );
};

const formatSuspensionDate = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function StatusPill({ value, colours }) {
  const meta = colours[value] || {
    color: "#6B7280",
    background: "#F3F4F6",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 20,
        background: meta.background,
        color: meta.color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {value}

    </span>
  );
}

export default function AdminUsers({
  users,
  currentAdminId,
  refreshUsers,
}) {
  const [roleFilter, setRoleFilter] = useState("All");

  const [activityFilter, setActivityFilter] = useState("All");

  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({
    name: "",
    role: "Player",
    accountStatus: "Active",
    suspensionAmount: 1,
    suspensionUnit: "days",
  });

  const [saving, setSaving] = useState(false);

  const [formError, setFormError] = useState("");

  const [showConfirmation, setShowConfirmation] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);

  const [removing, setRemoving] = useState(false);

  const [currentAdminIsSuper, setCurrentAdminIsSuper] = useState(false);
  const [accessByUser, setAccessByUser] = useState({});
  const [securityByUser, setSecurityByUser] = useState({});

  React.useEffect(() => {
    let cancelled = false;

    const loadCurrentAdminSecurity = async () => {
      if (!currentAdminId) {
        if (!cancelled) {
          setCurrentAdminIsSuper(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("app_users")
        .select("is_super_admin")
        .eq("user_id", currentAdminId)
        .maybeSingle();

      if (error) {
        console.error("Unable to load Super Admin status:", error);

        if (!cancelled) {
          setCurrentAdminIsSuper(false);
        }
        return;
      }

      if (!cancelled) {
        setCurrentAdminIsSuper(Boolean(data?.is_super_admin));
      }
    };
    loadCurrentAdminSecurity();

    return () => {
      cancelled = true;
    };
  }, [currentAdminId]);

  React.useEffect(() => {
    let cancelled = false;

    const loadRoleAndSecurityDetails = async () => {
      const userIds = [
        ...new Set(
          (users || [])
            .map((item) => item.userId)
            .filter(Boolean)
        ),
      ];

      if (userIds.length === 0) {
        if (!cancelled) {
          setAccessByUser({});
          setSecurityByUser({});
        }
        return;
      }

      const [accessResult, securityResult] = await Promise.all([
        supabase
          .from("app_users")
          .select("user_id, has_player_access, has_coach_access")
          .in("user_id", userIds),
        supabase.rpc("admin_get_user_security_status"),
      ]);

      if (accessResult.error) {
        console.error(
          "Unable to load additional account roles:",
          accessResult.error
        );
      } else if (!cancelled) {
        setAccessByUser(
          Object.fromEntries(
            (accessResult.data || []).map((row) => [
              row.user_id,
              {
                hasPlayerAccess: Boolean(row.has_player_access),
                hasCoachAccess: Boolean(row.has_coach_access),
              },
            ])
          )
        );
      }

      if (securityResult.error) {
        console.error(
          "Unable to load email verification status:",
          securityResult.error
        );
      } else if (!cancelled) {
        setSecurityByUser(
          Object.fromEntries(
            (securityResult.data || []).map((row) => [
              row.user_id,
              {
                emailConfirmedAt: row.email_confirmed_at || null,
              },
            ])
          )
        );
      }
    };
    loadRoleAndSecurityDetails();

    return () => {
      cancelled = true;
    };
  }, [users]);

  const getRole2 = (account) => {
    const access = accessByUser[account.userId];

    if (!access) return null;

    if (account.role === "Player" && access.hasCoachAccess) {
      return "Coach";
    }

    if (account.role === "Coach" && access.hasPlayerAccess) {
      return "Player";
    }

    return null;
  };

  const accountHasRole = useCallback(
    (account, role) => {
      if (account.role === role) return true;

      const access = accessByUser[account.userId];

      if (role === "Player") {
        return account.role === "Player" || access?.hasPlayerAccess === true;
      }

      if (role === "Coach") {
        return account.role === "Coach" || access?.hasCoachAccess === true;
      }

      return account.role === role;
    },
    [accessByUser]
  );

  const getSecurityStatus = (account) => {
    const hasPlayerRole = accountHasRole(account, "Player");

    if (
      hasPlayerRole &&
      toUiAccountStatus(account.accountStatus) === "Active" &&
      account.activityStatus === "Inactive"
    ) {
      return "Reverify required";
    }

    const security = securityByUser[account.userId];

    if (security) {
      return security.emailConfirmedAt ? "Verified" : "Not verified";
    }

    if (
      account.emailConfirmedAt ||
      account.email_confirmed_at ||
      account.emailVerified === true
    ) {
      return "Verified";
    }

    if (account.emailVerified === false) {
      return "Not verified";
    }

    return "Unknown";
  };

  const counts = useMemo(
    () => ({
      All: users.length,
      Player: users.filter((item) => accountHasRole(item, "Player")).length,
      Coach: users.filter((item) => accountHasRole(item, "Coach")).length,
      Admin: users.filter((item) => accountHasRole(item, "Admin")).length,
    }),
    [users, accountHasRole]
  );

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((item) => {
      const matchesRole =
        roleFilter === "All" || accountHasRole(item, roleFilter);

      const matchesActivity =
        activityFilter === "All" ||
        item.activityStatus === activityFilter;

      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.username.toLowerCase().includes(query);

      return matchesRole && matchesActivity && matchesSearch;
    });
  }, [users, roleFilter, activityFilter, search, accountHasRole]);

  const openEdit = async (account) => {
    setSelected(account);
    setFormError("");
    setShowConfirmation(false);
    setShowRemoveConfirmation(false);
    setSuccessMessage("");

    let savedSuspendedUntil =
      account.suspendedUntil ||
      account.suspended_until ||
      null;

    if (
      toUiAccountStatus(account.accountStatus) === "Suspended" &&
      !savedSuspendedUntil
    ) {
      const { data: latestAccount, error: suspendedUntilError } =
        await supabase
          .from("app_users")
          .select("suspended_until")
          .eq("user_id", account.userId)
          .maybeSingle();

      if (suspendedUntilError) {
        console.error(
          "Unable to load suspension end date:",
          suspendedUntilError
        );
      } else {
        savedSuspendedUntil =
          latestAccount?.suspended_until || null;
      }
    }
    setForm({
      name: account.name,
      role: account.role,
      accountStatus: toUiAccountStatus(account.accountStatus),
      suspensionAmount:
        toUiAccountStatus(account.accountStatus) === "Suspended"
          ? getRemainingSuspensionDays(savedSuspendedUntil)
          : 1,
      suspensionUnit: "days",
    });
  };

  const closeModal = () => {
    if (saving) return;
    setSelected(null);
    setFormError("");
    setShowConfirmation(false);
    setShowRemoveConfirmation(false);
  };

  const requestSaveConfirmation = () => {
    if (!selected) return;

    if (!form.name.trim()) {
      setFormError("Full name is required.");
      return;
    }

    const isEditingSelf = selected.userId === currentAdminId;

    if (
      isEditingSelf &&
      (form.role !== "Admin" || form.accountStatus !== "Active")
    ) {
      setFormError(
        "You cannot remove your own admin role, suspend your own account, or terminate your own account."
      );
      return;
    }

    const targetIsAdmin = selected.role === "Admin";

    if (
      !currentAdminIsSuper &&
      targetIsAdmin &&
      selected.userId !== currentAdminId
    ) {
      setFormError(
        "Only the Super Admin can modify another administrator."
      );
      return;
    }

    const hasChanges =
      form.name.trim() !== selected.name ||
      form.role !== selected.role ||
      form.accountStatus !== toUiAccountStatus(selected.accountStatus) ||
      form.accountStatus === "Suspended";

    if (!hasChanges) {
      setFormError("No changes were made.");
      return;
    }
    setFormError("");
    setShowConfirmation(true);
  };

  const requestRemoveUser = () => {
    if (!selected) return;

    if (selected.userId === currentAdminId) {
      setFormError("You cannot remove your own administrator account.");
      return;
    }

    if (!currentAdminIsSuper && selected.role === "Admin") {
      setFormError(
        "Only the Super Admin can remove another administrator."
      );
      return;
    }

    if (toUiAccountStatus(selected.accountStatus) !== "Terminated") {
      setFormError("Terminate this account first before removing the user.");
      return;
    }
    setFormError("");
    setShowRemoveConfirmation(true);
  };

  const removeUser = async () => {
    if (!selected) return;

    if (selected.userId === currentAdminId) {
      setFormError("You cannot remove your own administrator account.");
      return;
    }

    if (!currentAdminIsSuper && selected.role === "Admin") {
      setFormError(
        "Only the Super Admin can remove another administrator."
      );
      return;
    }

    if (toUiAccountStatus(selected.accountStatus) !== "Terminated") {
      setFormError("Terminate this account first before removing the user.");
      return;
    }
    setRemoving(true);
    setFormError("");

    const removedName = selected.name;

    const { error } = await supabase.rpc("admin_remove_app_user", {
      p_user_id: selected.userId,
    });

    if (error) {
      console.error("admin_remove_app_user error:", error);
      setFormError(error.message || "Unable to remove this user.");
      setRemoving(false);
      return;
    }
    await refreshUsers();
    setRemoving(false);
    setShowRemoveConfirmation(false);
    setSelected(null);
    setSuccessMessage(`${removedName} was removed from User Management.`);
  };

  const saveChanges = async () => {
    if (!selected) return;

    if (!form.name.trim()) {
      setFormError("Full name is required.");
      return;
    }

    const isEditingSelf = selected.userId === currentAdminId;

    if (
      isEditingSelf &&
      (form.role !== "Admin" || form.accountStatus !== "Active")
    ) {
      setFormError(
        "You cannot remove your own admin role, suspend your own account, or terminate your own account."
      );
      return;
    }

    const targetIsAdmin = selected.role === "Admin";

    if (
      !currentAdminIsSuper &&
      targetIsAdmin &&
      selected.userId !== currentAdminId
    ) {
      setFormError(
        "Only the Super Admin can modify another administrator."
      );
      return;
    }
    setSaving(true);
    setFormError("");

    const suspendedUntil =
      form.accountStatus === "Suspended"
        ? getSuspendedUntil(form.suspensionAmount, form.suspensionUnit)
        : null;

    const { error } = await supabase.rpc("admin_update_app_user", {
      p_user_id: selected.userId,
      p_full_name: form.name.trim(),
      p_role: form.role.toLowerCase(),
      p_account_status: toDatabaseAccountStatus(form.accountStatus),
      p_suspended_until: suspendedUntil,
    });

    if (error) {
      console.error("admin_update_app_user error:", error);
      setFormError(
        error.message || "Unable to update this user."
      );
      setSaving(false);
      return;
    }
    await refreshUsers();
    setSaving(false);
    setShowConfirmation(false);
    setSuccessMessage(
      form.accountStatus === "Suspended"
        ? `${form.name.trim()} was suspended until ${formatSuspensionDate(suspendedUntil)}.`
        : `${form.name.trim()} was updated successfully.`
    );
    setSelected(null);
  };

  return (
    <div className="adminReadablePage">
      <style>{`
        .adminReadablePage {
          font-family: "DM Sans", sans-serif;
          font-size: 14px;
          font-weight: 400;
        }
        .adminReadablePage [style*='font-size: 10px'] {
          font-size: 12px !important;
        }
        .adminReadablePage [style*='font-size: 11px'] {
          font-size: 13px !important;
        }
        .adminReadablePage [style*='font-size: 12px'],
        .adminReadablePage [style*='font-size: 13px'] {
          font-size: 14px !important;
        }
        .adminReadablePage [style*='font-weight: 800'],
        .adminReadablePage [style*='font-weight: 900'] {
          font-weight: 700 !important;
        }
        .adminReadablePage button,
        .adminReadablePage input,
        .adminReadablePage select,
        .adminReadablePage textarea {
          font-family: "DM Sans", sans-serif !important;
          font-size: 14px !important;
        }
        .adminReadablePage table {
          font-family: "DM Sans", sans-serif;
        }
        .adminReadablePage th {
          font-size: 13px !important;
          font-weight: 700 !important;
        }
        .adminReadablePage td {
          font-size: 14px !important;
        }
      `}</style>
      <SectionHeader
        title="User Management"
        subtitle="Manage registered ShuttleTrack accounts and activity"
        action={
          <button
            type="button"
            onClick={refreshUsers}
            style={{
              ...buttonBase,
              padding: "10px 18px",
              background: "#1A5FFF",
              color: "#fff",
            }}
          >
            Refresh users
          </button>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <SummaryCard
          label="Total users"
          value={counts.All}
          helper="All registered accounts"
          dark
        />
        <SummaryCard
          label="Players"
          value={counts.Player}
          helper="Registered player accounts"
          color="#00976C"
        />
        <SummaryCard
          label="Coaches"
          value={counts.Coach}
          helper="Registered coach accounts"
          color="#F59E0B"
        />
        <SummaryCard
          label="Administrators"
          value={counts.Admin}
          helper="Accounts with admin access"
          color="#7C3AED"
        />
      </div>
      <div
        style={{
          marginBottom: 14,
          padding: 14,
          borderRadius: 12,
          background: "#EEF3FF",
          color: "#38517D",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        Activity becomes <strong>Inactive</strong> when
        last seen at is older than 30 days. The account itself
        remains <strong>Active</strong>. For player accounts,
        ShuttleTrack will show <strong>Reverify required </strong>
        and require email verification the next time the player
        logs in.
      </div>
      <TableCard>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid #EEF1F8",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", "Player", "Coach", "Admin"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                style={{
                  ...buttonBase,
                  padding: "8px 14px",
                  border:
                    roleFilter === role
                      ? "1.5px solid #0D1B3E"
                      : "1.5px solid #DDE3EF",
                  background:
                    roleFilter === role ? "#0D1B3E" : "#fff",
                  color:
                    roleFilter === role ? "#fff" : "#6B7280",
                }}
              >
                {role} · {counts[role]}

              </button>
            ))}

          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <select
              value={activityFilter}
              onChange={(event) =>
                setActivityFilter(event.target.value)
              }
              style={{ ...inputStyle, width: 145 }}
            >
              <option>All</option>
              <option>Online</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Never active</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              style={{ ...inputStyle, width: 250 }}
            />
          </div>
        </div>
        <table
          style={{
            width: "100%",
            minWidth: 1280,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#F4F6FC",
                borderBottom: "1px solid #E3E8F2",
              }}
            >
              {[
                "User",
                "Role",
                "Role 2",
                "Account",
                "Activity",
                "Security Status",
                "Last seen",
                "Joined",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "13px 16px",
                    textAlign: "left",
                    color: "#7B879C",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  {heading}

                </th>
              ))}

            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState text="No registered users found." />
                </td>
              </tr>
            ) : (
              visibleUsers.map((account, index) => (
                <tr
                  key={account.userId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(account)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEdit(account);
                    }
                  }}
                  title={`Manage ${account.name}`}
                  style={{
                    borderBottom:
                      index < visibleUsers.length - 1
                        ? "1px solid #EEF1F8"
                        : "none",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = "#F8FAFD";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                  }}
                >
                  <td
                    style={{
                      padding: "13px 16px",
                      minWidth: 270,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Avatar
                        name={account.name}
                        role={account.role}
                      />
                      <div>
                        <div
                          style={{
                            color: "#0D1B3E",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {account.name}
                          {account.userId === currentAdminId
                            ? " (You)"
                            : ""}

                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            color: "#8892A4",
                            fontSize: 11,
                          }}
                        >
                          {account.email}

                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <Badge value={account.role} type="role" />
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {getRole2(account) ? (
                      <Badge value={getRole2(account)} type="role" />
                    ) : (
                      <span
                        style={{
                          color: "#A0A8B8",
                          fontSize: 11,
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <StatusPill
                      value={toUiAccountStatus(account.accountStatus)}
                      colours={ACCOUNT_COLORS}
                    />
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <StatusPill
                      value={account.activityStatus}
                      colours={ACTIVITY_COLORS}
                    />
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <StatusPill
                      value={getSecurityStatus(account)}
                      colours={SECURITY_COLORS}
                    />
                  </td>
                  <td
                    style={{
                      padding: "13px 16px",
                      color: "#6B7280",
                      fontSize: 11,
                    }}
                  >
                    {account.lastSeenLabel}

                  </td>
                  <td
                    style={{
                      padding: "13px 16px",
                      color: "#6B7280",
                      fontSize: 12,
                    }}
                  >
                    {account.joined}

                  </td>
                </tr>
              ))
            )}

          </tbody>
        </table>
      </TableCard>
      {selected && (
        <Modal
          title={`Manage ${selected.name}`}
          onClose={closeModal}
        >
          <Field label="Full name">
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Email">
            <input
              value={selected.email}
              style={{
                ...inputStyle,
                background: "#F4F6FC",
                color: "#7B879C",
              }}
              readOnly
            />
          </Field>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <Field label="Role">
              <select
                value={form.role}
                disabled={
                  selected.userId === currentAdminId ||
                  (!currentAdminIsSuper && selected.role === "Admin")
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option>Player</option>
                <option>Coach</option>
                <option>Admin</option>
              </select>
            </Field>
            <Field label="Account status">
              <select
                value={form.accountStatus}
                disabled={
                  selected.userId === currentAdminId ||
                  (!currentAdminIsSuper && selected.role === "Admin")
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accountStatus: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option>Active</option>
                <option>Suspended</option>
                <option>Terminated</option>
              </select>
            </Field>
          </div>
          {form.accountStatus === "Suspended" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <Field label="Suspend for">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.suspensionAmount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      suspensionAmount: Math.max(
                        1,
                        Number(event.target.value) || 1,
                      ),
                    }))
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="Duration">
                <select
                  value={form.suspensionUnit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      suspensionUnit: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="days">Day(s)</option>
                  <option value="weeks">Week(s)</option>
                  <option value="months">Month(s)</option>
                  <option value="years">Year(s)</option>
                </select>
              </Field>
            </div>
          )}
          {form.accountStatus === "Suspended" && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                background: "#FFF7ED",
                color: "#9A3412",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Suspension ends on{" "}

              <strong>
                {formatSuspensionDate(
                  getSuspendedUntil(
                    form.suspensionAmount,
                    form.suspensionUnit,
                  ),
                )}

              </strong>
              .
            </div>
          )}
          {selected.role === "Player" &&
            selected.accountStatus === "Active" &&
            selected.activityStatus === "Inactive" && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 10,
                  background: "#FEF3C7",
                  color: "#92400E",
                  fontSize: 11,
                  lineHeight: 1.6,
                }}
              >
                <strong>Reverify required.</strong> This player has
                been inactive for more than 30 days. Their account
                remains Active, but they must verify their email
                the next time they log in.
              </div>
            )}

          <div
            style={{
              marginBottom: 18,
              padding: 12,
              borderRadius: 10,
              background: "#FFF7ED",
              color: "#9A3412",
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            Suspended or Terminated accounts are logged out during
            the next account check and cannot continue using the
            authenticated pages.
          </div>
          {formError && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                background: "#FEF2F2",
                color: "#B91C1C",
                fontSize: 12,
              }}
            >
              {formError}

            </div>
          )}

          <div
            style={{
              marginBottom: 12,
              color: "#7B879C",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Review changes does not save immediately. Select
            <strong> Confirm changes </strong>
            on the next screen to apply the update.
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={closeModal}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                border: "1px solid #DDE3EF",
                background: "#fff",
                color: "#6B7280",
              }}
            >
              Cancel
            </button>
            {selected.userId !== currentAdminId &&
              toUiAccountStatus(selected.accountStatus) === "Terminated" &&
              (selected.role !== "Admin" || currentAdminIsSuper) && (
                <button
                  type="button"
                  disabled={saving || removing}
                  onClick={requestRemoveUser}
                  style={{
                    ...buttonBase,
                    padding: "10px 18px",
                    border: "1px solid #FCA5A5",
                    background: "#FEF2F2",
                    color: "#DC2626",
                    marginRight: "auto",
                  }}
                >
                  Remove user
                </button>
              )}

            <button
              type="button"
              disabled={saving || removing}
              onClick={requestSaveConfirmation}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                background: "#1A5FFF",
                color: "#fff",
                opacity: saving || removing ? 0.65 : 1,
              }}
            >
              Review changes
            </button>
          </div>
        </Modal>
      )}
      {selected && showConfirmation && (
        <Modal
          title="Confirm account changes"
          onClose={() => !saving && setShowConfirmation(false)}
          maxWidth={520}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
              padding: 14,
              borderRadius: 12,
              background: "#F4F7FF",
              border: "1px solid #DCE5FF",
            }}
          >
            <Avatar name={selected.name} role={selected.role} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1B3E" }}>
                {selected.name}

              </div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#8892A4" }}>
                {selected.email}

              </div>
            </div>
          </div>
          <div
            style={{
              marginBottom: 18,
              border: "1px solid #E5EAF3",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {[
              { label: "Full name", oldValue: selected.name, newValue: form.name.trim() },
              { label: "Role", oldValue: selected.role, newValue: form.role },
              {
                label: "Account status",
                oldValue: selected.accountStatus,
                newValue: form.accountStatus,
              },
            ].map((change, index) => (
              <div
                key={change.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr",
                  gap: 12,
                  padding: "12px 14px",
                  borderBottom: index < 2 ? "1px solid #EEF1F8" : "none",
                  background:
                    change.oldValue !== change.newValue ? "#FFFDF5" : "#fff",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7B879C" }}>
                  {change.label}

                </div>
                <div style={{ fontSize: 12, color: "#0D1B3E" }}>
                  {change.oldValue === change.newValue ? (
                    <span>{change.newValue} — no change</span>
                  ) : (
                    <>
                      <span style={{ color: "#8892A4", textDecoration: "line-through" }}>
                        {change.oldValue}

                      </span>
                      <span style={{ margin: "0 8px", color: "#8892A4" }}>→</span>
                      <strong>{change.newValue}</strong>
                    </>
                  )}

                </div>
              </div>
            ))}

          </div>
          {form.accountStatus === "Suspended" &&
            selected.accountStatus !== "Suspended" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 13,
                  borderRadius: 11,
                  background: "#FEF2F2",
                  color: "#B91C1C",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <strong>Suspend this account?</strong> The user will be signed out
                during the next account check and will not be able to continue
                using authenticated pages.
              </div>
            )}
          {form.accountStatus === "Terminated" &&
            toUiAccountStatus(selected.accountStatus) !== "Terminated" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 13,
                  borderRadius: 11,
                  background: "#F3F4F6",
                  color: "#374151",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <strong>Terminate this account?</strong> The account will remain in
                the database but will no longer be allowed to use ShuttleTrack.
              </div>
            )}
          {form.accountStatus === "Active" &&
            toUiAccountStatus(selected.accountStatus) !== "Active" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 13,
                  borderRadius: 11,
                  background: "#E0FAF3",
                  color: "#047857",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <strong>Reactivate this account?</strong> The user will regain
                access and can sign in again.
              </div>
            )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowConfirmation(false)}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                border: "1px solid #DDE3EF",
                background: "#fff",
                color: "#6B7280",
              }}
            >
              Go back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveChanges}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                background:
                  form.accountStatus === "Suspended"
                    ? "#DC2626"
                    : form.accountStatus === "Terminated"
                    ? "#4B5563"
                    : "#1A5FFF",
                color: "#fff",
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving ? "Saving..." : "Confirm changes"}

            </button>
          </div>
        </Modal>
      )}
      {selected && showRemoveConfirmation && (
        <Modal
          title="Remove user"
          onClose={() => !removing && setShowRemoveConfirmation(false)}
          maxWidth={500}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
              padding: 14,
              borderRadius: 12,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
            }}
          >
            <Avatar name={selected.name} role={selected.role} />
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0D1B3E",
                }}
              >
                {selected.name}

              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: "#8892A4",
                }}
              >
                {selected.email}

              </div>
            </div>
          </div>
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 12,
              background: "#FFF7ED",
              color: "#9A3412",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <strong>Are you sure you want to remove this user?</strong>
            <br />
            The account is already terminated. Removing it will hide the user
            from User Management, but historical ShuttleTrack records will be
            kept.
          </div>
          {formError && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                background: "#FEF2F2",
                color: "#B91C1C",
                fontSize: 12,
              }}
            >
              {formError}

            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              disabled={removing}
              onClick={() => setShowRemoveConfirmation(false)}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                border: "1px solid #DDE3EF",
                background: "#fff",
                color: "#6B7280",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={removeUser}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                background: "#DC2626",
                color: "#fff",
                opacity: removing ? 0.65 : 1,
              }}
            >
              {removing ? "Removing..." : "Yes, remove user"}

            </button>
          </div>
        </Modal>
      )}
      {successMessage && !selected && (
        <Modal title="Changes saved" onClose={() => setSuccessMessage("")} maxWidth={430}>
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#E0FAF3",
              color: "#047857",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {successMessage}

          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                background: "#1A5FFF",
                color: "#fff",
              }}
            >
              Done
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}