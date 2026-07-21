import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "../Layout/Layout.module.css";

const ROLE_META = {
  Admin:   { color: "#7C3AED", bg: "#EDE9FE" },
  Coach:   { color: "#0891B2", bg: "#E0F2FE" },
  Player:  { color: "#1A5FFF", bg: "#E8EFFE" },
};

const INITIAL_USERS = [
  { id: 1, name: "Adeline",    email: "adeline@demo.com",   role: "Player", status: "Active",   joined: "Jan 2026", club: "Penang BC" },
  { id: 2, name: "Ali", email: "ali@demo.com",   role: "Player", status: "Active",   joined: "Feb 2026", club: "Seberang BC" },
  { id: 3, name: "Adam", email: "adam@demo.com", role: "Player", status: "Active",   joined: "Feb 2026", club: "Penang BC" },
  { id: 4, name: "Danial",   email: "danial@demo.com",  role: "Player", status: "Inactive", joined: "Mar 2026", club: "USM BC" },
  { id: 5, name: "Coach Rahman",   email: "rahman@demo.com",  role: "Coach",  status: "Active",   joined: "Jan 2026", club: "Penang BC" },
  { id: 6, name: "Tricia",    email: "tricia@demo.com",   role: "Admin",  status: "Active",   joined: "Jan 2026", club: "–" },
];

const EMPTY_FORM = { name: "", email: "", role: "Player", status: "Active", club: "" };

function Avatar({ name, role }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const { color, bg } = ROLE_META[role] || ROLE_META.Player;
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function Badge({ role }) {
  const { color, bg } = ROLE_META[role] || ROLE_META.Player;
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{role}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(13,27,62,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1B3E" }}>{title}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "#EEF1F8", cursor: "pointer", fontSize: 16, color: "#8892A4" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#8892A4", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 14px", border: "1.5px solid #EEF1F8", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0D1B3E" };

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AD'

  const [users, setUsers] = useState(INITIAL_USERS);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const counts = { All: users.length, ...Object.fromEntries(["Admin","Coach","Player"].map(r => [r, users.filter(u => u.role === r).length])) };

  const visible = users.filter(u =>
    (filter === "All" || u.role === filter) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => { setForm(EMPTY_FORM); setModal("add"); };
  const openEdit = u => { setSelected(u); setForm({ name: u.name, email: u.email, role: u.role, status: u.status, club: u.club }); setModal("edit"); };
  const openDelete = u => { setSelected(u); setModal("delete"); };

  const saveAdd = () => {
    if (!form.name || !form.email) return;
    setUsers(prev => [...prev, { id: Date.now(), joined: "May 2026", ...form }]);
    setModal(null);
  };
  const saveEdit = () => {
    setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, ...form } : u));
    setModal(null);
  };
  const confirmDelete = () => {
    setUsers(prev => prev.filter(u => u.id !== selected.id));
    setModal(null);
  };

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }



  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F6F8FF" }}>

      {/* ── Sidebar — same as Layout.js ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoMark}>
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
              <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5"/>
              <path d="M6 10 Q10 4 14 10 Q10 16 6 10Z" fill="white" opacity="0.8"/>
              <circle cx="10" cy="10" r="2" fill="white"/>
            </svg>
          </div>
          <div className={styles.logoName}>ShuttleTrack</div>
          <div className={styles.logoSub}>Admin Panel</div>
        </div>

        <nav className={styles.navSection}>
          <div className={styles.navLabel}>Management</div>
          <div className={`${styles.navItem} ${styles.active}`}>
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
              <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="13" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            User Management
          </div>
        </nav>

        <div className={styles.sidebarUser}>
          <div className={styles.userAv}>{initials}</div>
          <div>
            <div className={styles.userName}>{user?.name || 'Admin'}</div>
            <div className={styles.userRole}>Administrator</div>
          </div>
        </div>

        <div className={styles.sidebarLogout}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 1H2a1 1 0 00-1 1v10a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={styles.main}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1B3E" }}>User Management</div>
            <div style={{ fontSize: 13, color: "#8892A4", marginTop: 4 }}>Manage all players, coaches, and admins</div>
          </div>
          <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 11, background: "#0D1B3E", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Add user
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Total users", val: counts.All,    bg: "linear-gradient(135deg,#0D1B3E,#1C3160)", text: "#fff",    sub: "rgba(255,255,255,0.55)" },
            { label: "Players",     val: counts.Player, bg: "#fff", text: "#1A5FFF", sub: "#8892A4" },
            { label: "Coaches",     val: counts.Coach,  bg: "#fff", text: "#0891B2", sub: "#8892A4" },
            { label: "Admins",      val: counts.Admin,  bg: "#fff", text: "#7C3AED", sub: "#8892A4" },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 4px rgba(13,27,62,0.09)" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: c.text, lineHeight: 1 }}>{c.val}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.sub, marginTop: 6 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["All","Player","Coach","Admin"].map(r => (
              <button key={r} onClick={() => setFilter(r)} style={{
                padding: "7px 16px", borderRadius: 30, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid",
                borderColor: filter === r ? "#0D1B3E" : "#DDE3EF",
                background: filter === r ? "#0D1B3E" : "#fff",
                color: filter === r ? "#fff" : "#8892A4",
                transition: "all 0.15s"
              }}>
                {r} <span style={{ opacity: 0.7, fontWeight: 500 }}>·{counts[r] ?? counts.All}</span>
              </button>
            ))}
          </div>
          <div style={{ position: "relative", flex: "0 0 260px" }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8892A4" }} width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
        </div>

        {/* User table */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(13,27,62,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #EEF1F8" }}>
                {["User","Role","Status","Club","Joined","Actions"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, color: "#8892A4", letterSpacing: "0.6px", textTransform: "uppercase", padding: "14px 16px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#8892A4", fontSize: 13 }}>No users found.</td></tr>
              )}
              {visible.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < visible.length - 1 ? "1px solid #EEF1F8" : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFBFF"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={u.name} role={u.role} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0D1B3E" }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "#8892A4" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px" }}><Badge role={u.role} /></td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{
                      background: u.status === "Active" ? "#E0FAF3" : "#F3F4F6",
                      color: u.status === "Active" ? "#00976C" : "#6B7280",
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20
                    }}>{u.status}</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#8892A4" }}>{u.club}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#8892A4" }}>{u.joined}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(u)} style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #DDE3EF", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#0D1B3E" }}>Edit</button>
                      <button onClick={() => openDelete(u)} style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #FEE2E2", background: "#FEF2F2", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ADD modal */}
      {modal === "add" && (
        <Modal title="Add new user" onClose={() => setModal(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Full name"><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ahmad Hakim" /></Field>
            <Field label="Email"><input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. ahmad@demo.com" /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Role">
              <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option>Player</option><option>Coach</option><option>Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Active</option><option>Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Club"><input style={inputStyle} value={form.club} onChange={e => setForm(f => ({ ...f, club: e.target.value }))} placeholder="e.g. Penang BC" /></Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #C8D0E0", background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveAdd} style={{ padding: "9px 20px", borderRadius: 10, background: "#0D1B3E", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Add user</button>
          </div>
        </Modal>
      )}

      {/* EDIT modal */}
      {modal === "edit" && (
        <Modal title={`Edit — ${selected?.name}`} onClose={() => setModal(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Full name"><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Email"><input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Role">
              <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option>Player</option><option>Coach</option><option>Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Active</option><option>Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Club"><input style={inputStyle} value={form.club} onChange={e => setForm(f => ({ ...f, club: e.target.value }))} /></Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #C8D0E0", background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveEdit} style={{ padding: "9px 20px", borderRadius: 10, background: "#1A5FFF", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save changes</button>
          </div>
        </Modal>
      )}

      {/* DELETE modal */}
      {modal === "delete" && (
        <Modal title="Delete user?" onClose={() => setModal(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#FEF2F2", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
            <Avatar name={selected?.name || ""} role={selected?.role || "Player"} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0D1B3E" }}>{selected?.name}</div>
              <div style={{ fontSize: 12, color: "#8892A4" }}>{selected?.email} · <Badge role={selected?.role} /></div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>This action cannot be undone. The user will be permanently removed from ShuttleTrack.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #C8D0E0", background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={confirmDelete} style={{ padding: "9px 20px", borderRadius: 10, background: "#DC2626", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete user</button>
          </div>
        </Modal>
      )}
    </div>
  );
}