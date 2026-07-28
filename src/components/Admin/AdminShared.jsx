import React from "react";

export const ROLE_META = {
  Admin: { color: "#7C3AED", bg: "#EDE9FE" },
  Coach: { color: "#0891B2", bg: "#E0F2FE" },
  Player: { color: "#1A5FFF", bg: "#E8EFFE" },
};

export const STATUS_META = {
  Active: { color: "#00976C", bg: "#E0FAF3" },
  Inactive: { color: "#6B7280", bg: "#F3F4F6" },
  Suspended: { color: "#DC2626", bg: "#FEE2E2" },
  Pending: { color: "#D97706", bg: "#FEF3C7" },
  Verified: { color: "#00976C", bg: "#E0FAF3" },
  Rejected: { color: "#DC2626", bg: "#FEE2E2" },
  Reviewing: { color: "#2563EB", bg: "#DBEAFE" },
  Resolved: { color: "#00976C", bg: "#E0FAF3" },
  Dismissed: { color: "#6B7280", bg: "#F3F4F6" },
};

export const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #DDE3EF",
  borderRadius: 10,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  color: "#0D1B3E",
  background: "#fff",
};

export const buttonBase = {
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

export function Avatar({ name = "", role = "Player", size = 36 }) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "US";

  const meta = ROLE_META[role] || ROLE_META.Player;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: meta.bg,
        color: meta.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 36 ? 12 : 16,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export function Badge({ value, type = "status" }) {
  const meta =
    type === "role"
      ? ROLE_META[value] || ROLE_META.Player
      : STATUS_META[value] || { color: "#6B7280", bg: "#F3F4F6" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: meta.bg,
        color: meta.color,
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );
}

export function Modal({ title, onClose, children, maxWidth = 500 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,27,62,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 20,
          padding: 26,
          boxShadow: "0 15px 50px rgba(13,27,62,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 22,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1B3E" }}>
            {title}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              ...buttonBase,
              width: 34,
              height: 34,
              background: "#EEF1F8",
              color: "#8892A4",
            }}
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 11,
          fontWeight: 800,
          color: "#8892A4",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 22,
      }}
    >
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1B3E" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#8892A4", marginTop: 4 }}>
          {subtitle}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SummaryCard({
  label,
  value,
  helper,
  color = "#1A5FFF",
  dark = false,
}) {
  return (
    <div
      style={{
        background: dark
          ? "linear-gradient(135deg,#0D1B3E,#1C3160)"
          : "#fff",
        borderRadius: 16,
        padding: "20px 22px",
        boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 800,
          color: dark ? "#fff" : color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 7,
          fontSize: 12,
          fontWeight: 700,
          color: dark ? "rgba(255,255,255,0.7)" : "#6B7280",
        }}
      >
        {label}
      </div>
      {helper && (
        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            color: dark ? "rgba(255,255,255,0.5)" : "#A0A8B8",
          }}
        >
          {helper}
        </div>
      )}
    </div>
  );
}

export function TableCard({ children }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 1px 5px rgba(13,27,62,0.08)",
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div
      style={{
        padding: 42,
        textAlign: "center",
        color: "#8892A4",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
