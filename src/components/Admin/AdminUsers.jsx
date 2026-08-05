import React, { useMemo, useState } from "react";
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
  Disabled: { color: "#6B7280", background: "#F3F4F6" },
};

const ACTIVITY_COLORS = {
  Online: { color: "#00976C", background: "#E0FAF3" },
  Active: { color: "#1A5FFF", background: "#E8EFFE" },
  Inactive: { color: "#D97706", background: "#FEF3C7" },
  "Never active": { color: "#6B7280", background: "#F3F4F6" },
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
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const counts = useMemo(
    () => ({
      All: users.length,
      Player: users.filter((item) => item.role === "Player").length,
      Coach: users.filter((item) => item.role === "Coach").length,
      Admin: users.filter((item) => item.role === "Admin").length,
    }),
    [users]
  );

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((item) => {
      const matchesRole =
        roleFilter === "All" || item.role === roleFilter;

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
  }, [users, roleFilter, activityFilter, search]);

  const openEdit = (account) => {
    setSelected(account);
    setForm({
      name: account.name,
      role: account.role,
      accountStatus: account.accountStatus,
    });
    setFormError("");
    setShowConfirmation(false);
    setSuccessMessage("");
  };

  const closeModal = () => {
    if (saving) return;
    setSelected(null);
    setFormError("");
    setShowConfirmation(false);
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
        "You cannot remove your own admin role or suspend your own account."
      );
      return;
    }

    const hasChanges =
      form.name.trim() !== selected.name ||
      form.role !== selected.role ||
      form.accountStatus !== selected.accountStatus;

    if (!hasChanges) {
      setFormError("No changes were made.");
      return;
    }

    setFormError("");
    setShowConfirmation(true);
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
        "You cannot remove your own admin role or suspend your own account."
      );
      return;
    }

    setSaving(true);
    setFormError("");

    const { error } = await supabase.rpc("admin_update_app_user", {
      p_user_id: selected.userId,
      p_full_name: form.name.trim(),
      p_role: form.role.toLowerCase(),
      p_account_status: form.accountStatus.toLowerCase(),
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
    setSuccessMessage(`${form.name.trim()} was updated successfully.`);
    setSelected(null);
  };

  return (
    <>
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
        last_seen_at is older than 30 days. This does not block
        login. Only the separate account status Suspended or
        Disabled blocks access.
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
            minWidth: 1050,
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
                "Account",
                "Activity",
                "Last seen",
                "Joined",
                "Setup",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "13px 16px",
                    textAlign: "left",
                    color: "#7B879C",
                    fontSize: 10,
                    fontWeight: 800,
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
                <td colSpan={7}>
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
                            fontWeight: 800,
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
                    <StatusPill
                      value={account.accountStatus}
                      colours={ACCOUNT_COLORS}
                    />
                  </td>

                  <td style={{ padding: "13px 16px" }}>
                    <StatusPill
                      value={account.activityStatus}
                      colours={ACTIVITY_COLORS}
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

                  <td style={{ padding: "13px 16px" }}>
                    <StatusPill
                      value={
                        account.setupCompleted
                          ? "Completed"
                          : "Not completed"
                      }
                      colours={{
                        Completed: {
                          color: "#00976C",
                          background: "#E0FAF3",
                        },
                        "Not completed": {
                          color: "#D97706",
                          background: "#FEF3C7",
                        },
                      }}
                    />
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
                disabled={selected.userId === currentAdminId}
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
                disabled={selected.userId === currentAdminId}
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
                <option>Disabled</option>
              </select>
            </Field>
          </div>

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
            Suspended or Disabled accounts are logged out during
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

            <button
              type="button"
              disabled={saving}
              onClick={requestSaveConfirmation}
              style={{
                ...buttonBase,
                padding: "10px 18px",
                background: "#1A5FFF",
                color: "#fff",
                opacity: saving ? 0.65 : 1,
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
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0D1B3E" }}>
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
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7B879C" }}>
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

          {form.accountStatus === "Disabled" &&
            selected.accountStatus !== "Disabled" && (
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
                <strong>Disable this account?</strong> The account will remain in
                the database but will not be allowed to use ShuttleTrack.
              </div>
            )}

          {form.accountStatus === "Active" &&
            selected.accountStatus !== "Active" && (
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
                    : form.accountStatus === "Disabled"
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
    </>
  );
}