import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import {
  Avatar,
  Badge,
  EmptyState,
  Modal,
  SectionHeader,
  SummaryCard,
  TableCard,
  buttonBase,
  inputStyle,
} from "./AdminShared";

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normaliseStatus = (value) => {
  const clean = String(value || "active").trim().toLowerCase();

  if (clean === "paused") return "Paused";
  if (clean === "removed") return "Removed";
  return "Active";
};

export default function AdminClubs() {
  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedClub, setSelectedClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: clubRows, error: clubError } = await supabase
        .from("clubs")
        .select(`
          id,
          owner_id,
          owner_name,
          short_name,
          name,
          description,
          state,
          location,
          logo_url,
          accepting_members,
          status,
          admin_note,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (clubError) throw clubError;

      const clubIds = (clubRows || []).map((club) => club.id);

      let memberships = [];

      if (clubIds.length > 0) {
        const { data, error } = await supabase
          .from("club_members")
          .select("club_id, status, member_role")
          .in("club_id", clubIds);

        if (error) throw error;
        memberships = data || [];
      }

      const countsByClub = new Map();

      memberships.forEach((membership) => {
        const current = countsByClub.get(membership.club_id) || {
          accepted: 0,
          pending: 0,
          coaches: 0,
          players: 0,
        };

        if (membership.status === "accepted") {
          current.accepted += 1;

          if (
            membership.member_role === "coach" ||
            membership.member_role === "manager"
          ) {
            current.coaches += 1;
          } else {
            current.players += 1;
          }
        }

        if (membership.status === "pending") {
          current.pending += 1;
        }

        countsByClub.set(membership.club_id, current);
      });

      setClubs(
        (clubRows || []).map((club) => {
          const counts = countsByClub.get(club.id) || {
            accepted: 0,
            pending: 0,
            coaches: 0,
            players: 0,
          };

          return {
            id: club.id,
            ownerId: club.owner_id,
            ownerName: club.owner_name || "Unknown manager",
            shortName: club.short_name || "—",
            name: club.name || "Unnamed club",
            description: club.description || "",
            state: club.state || "—",
            location: club.location || "—",
            logoUrl: club.logo_url || "",
            acceptingMembers: club.accepting_members !== false,
            status: normaliseStatus(club.status),
            adminNote: club.admin_note || "",
            createdAt: club.created_at,
            updatedAt: club.updated_at,
            memberCount: counts.accepted,
            pendingCount: counts.pending,
            coachCount: counts.coaches,
            playerCount: counts.players,
          };
        }),
      );
    } catch (error) {
      console.error("Admin club load error:", error);
      setErrorMessage(
        error.message || "Unable to load club information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const counts = useMemo(
    () => ({
      total: clubs.length,
      active: clubs.filter((club) => club.status === "Active").length,
      paused: clubs.filter((club) => club.status === "Paused").length,
      members: clubs.reduce(
        (total, club) => total + Number(club.memberCount || 0),
        0,
      ),
    }),
    [clubs],
  );

  const visibleClubs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clubs.filter((club) => {
      const matchesStatus =
        statusFilter === "All" || club.status === statusFilter;

      const matchesSearch =
        !query ||
        [
          club.shortName,
          club.name,
          club.ownerName,
          club.state,
          club.location,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query),
        );

      return matchesStatus && matchesSearch;
    });
  }, [clubs, search, statusFilter]);

  const openClub = async (club) => {
    setSelectedClub(club);
    setMembers([]);
    setLoadingMembers(true);

    try {
      const { data: membershipRows, error: membershipError } =
        await supabase
          .from("club_members")
          .select(`
            id,
            club_id,
            user_id,
            member_name,
            status,
            member_role,
            requested_at,
            responded_at
          `)
          .eq("club_id", club.id)
          .order("requested_at", { ascending: true });

      if (membershipError) throw membershipError;

      const rows = membershipRows || [];
      const userIds = [
        ...new Set(rows.map((row) => row.user_id).filter(Boolean)),
      ];

      let appUsersById = new Map();
      let playersById = new Map();
      let coachesById = new Map();

      if (userIds.length > 0) {
        const [appUserResult, playerResult, coachResult] =
          await Promise.all([
            supabase
              .from("app_users")
              .select("user_id, full_name, email, role, account_status")
              .in("user_id", userIds),
            supabase
              .from("player_profiles")
              .select("user_id, display_name, state, player_category")
              .in("user_id", userIds),
            supabase
              .from("coach_profiles")
              .select("user_id, display_name, state, coaching_level")
              .in("user_id", userIds),
          ]);

        if (appUserResult.error) throw appUserResult.error;
        if (playerResult.error) {
          console.error("Unable to load player club profiles:", playerResult.error);
        }
        if (coachResult.error) {
          console.error("Unable to load coach club profiles:", coachResult.error);
        }

        appUsersById = new Map(
          (appUserResult.data || []).map((row) => [row.user_id, row]),
        );

        playersById = new Map(
          (playerResult.data || []).map((row) => [row.user_id, row]),
        );

        coachesById = new Map(
          (coachResult.data || []).map((row) => [row.user_id, row]),
        );
      }

      setMembers(
        rows.map((row) => {
          const appUser = appUsersById.get(row.user_id);
          const player = playersById.get(row.user_id);
          const coach = coachesById.get(row.user_id);

          return {
            ...row,
            name:
              player?.display_name ||
              coach?.display_name ||
              appUser?.full_name ||
              row.member_name ||
              "Unknown member",
            email: appUser?.email || "—",
            accountRole:
              appUser?.role ||
              (coach ? "coach" : "player"),
            accountStatus: appUser?.account_status || "active",
            state: player?.state || coach?.state || "—",
            level:
              player?.player_category ||
              coach?.coaching_level ||
              "—",
          };
        }),
      );
    } catch (error) {
      console.error("Admin club member load error:", error);
      setErrorMessage(
        error.message || "Unable to load club members.",
      );
    } finally {
      setLoadingMembers(false);
    }
  };

  const writeAdminLog = async (action, detail, club) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("admin_activity_logs")
      .insert({
        admin_user_id: user?.id || null,
        target_user_id: club?.ownerId || null,
        action,
        detail,
      });

    if (error) {
      console.error("Unable to save club admin log:", error);
    }
  };

  const changeClubStatus = async (club, nextStatus) => {
    const label =
      nextStatus === "paused"
        ? "pause"
        : nextStatus === "active"
          ? "reactivate"
          : "remove";

    if (
      !window.confirm(
        `Are you sure you want to ${label} ${club.shortName} · ${club.name}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const updateData = {
        status: nextStatus,
      };

      if (nextStatus === "paused" || nextStatus === "removed") {
        updateData.accepting_members = false;
      }

      const { error } = await supabase
        .from("clubs")
        .update(updateData)
        .eq("id", club.id);

      if (error) throw error;

      await writeAdminLog(
        nextStatus === "paused"
          ? "Club paused"
          : nextStatus === "active"
            ? "Club reactivated"
            : "Club removed",
        `${club.shortName} · ${club.name} was changed to ${nextStatus}.`,
        club,
      );

      setSelectedClub(null);
      await loadClubs();
    } catch (error) {
      console.error("Admin club status error:", error);
      setErrorMessage(
        error.message || "Unable to update the club.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteClub = async (club) => {
    if (
      !window.confirm(
        `Permanently delete ${club.shortName} · ${club.name}? This also removes all club memberships and cannot be undone.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("clubs")
        .delete()
        .eq("id", club.id);

      if (error) throw error;

      await writeAdminLog(
        "Club deleted",
        `${club.shortName} · ${club.name} was permanently deleted.`,
        club,
      );

      setSelectedClub(null);
      await loadClubs();
    } catch (error) {
      console.error("Admin club delete error:", error);
      setErrorMessage(
        error.message || "Unable to delete the club.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Club Management"
        subtitle="Review clubs, managers, members and club status"
      />

      {errorMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: 13,
            borderRadius: 11,
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
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <SummaryCard
          label="Total clubs"
          value={counts.total}
          helper="All registered clubs"
          dark
        />
        <SummaryCard
          label="Active clubs"
          value={counts.active}
          color="#00976C"
        />
        <SummaryCard
          label="Paused clubs"
          value={counts.paused}
          color="#D97706"
        />
        <SummaryCard
          label="Club members"
          value={counts.members}
          color="#1A5FFF"
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search club, manager, state or location..."
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ ...inputStyle, width: 160 }}
        >
          <option>All</option>
          <option>Active</option>
          <option>Paused</option>
          <option>Removed</option>
        </select>
      </div>

      <TableCard>
        {loading ? (
          <EmptyState text="Loading clubs..." />
        ) : visibleClubs.length === 0 ? (
          <EmptyState text="No clubs match the current filter." />
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 900,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#F8FAFD",
                  color: "#8892A4",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {[
                  "Club",
                  "Manager",
                  "Location",
                  "Members",
                  "Requests",
                  "Created",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "13px 16px",
                      textAlign: "left",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleClubs.map((club) => (
                <tr
                  key={club.id}
                  onClick={() => openClub(club)}
                  style={{
                    borderTop: "1px solid #EEF1F8",
                    cursor: "pointer",
                  }}
                  title="View club details"
                >
                  <td style={{ padding: "14px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {club.logoUrl ? (
                        <img
                          src={club.logoUrl}
                          alt=""
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <Avatar name={club.shortName} role="Player" />
                      )}

                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#0D1B3E",
                          }}
                        >
                          {club.shortName} · {club.name}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "#8892A4",
                          }}
                        >
                          {club.acceptingMembers
                            ? "Accepting members"
                            : "Join requests paused"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {club.ownerName}
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {club.location} · {club.state}
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {club.memberCount}
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {club.pendingCount}
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {formatDate(club.createdAt)}
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <Badge value={club.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      {selectedClub && (
        <Modal
          title={`${selectedClub.shortName} · ${selectedClub.name}`}
          onClose={() => {
            if (!saving) setSelectedClub(null);
          }}
          maxWidth={760}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {[
              ["Manager", selectedClub.ownerName],
              ["Location", `${selectedClub.location} · ${selectedClub.state}`],
              ["Members", selectedClub.memberCount],
              ["Pending requests", selectedClub.pendingCount],
              ["Created", formatDate(selectedClub.createdAt)],
              ["Status", selectedClub.status],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 12,
                  borderRadius: 11,
                  background: "#F8FAFD",
                }}
              >
                <div style={{ fontSize: 10, color: "#8892A4" }}>
                  {label}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0D1B3E",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#8892A4",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 7,
              }}
            >
              Description
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#0D1B3E",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedClub.description || "No club description."}
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#8892A4",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Members and requests
          </div>

          <div
            style={{
              border: "1px solid #EEF1F8",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            {loadingMembers ? (
              <EmptyState text="Loading club members..." />
            ) : members.length === 0 ? (
              <EmptyState text="This club has no membership records." />
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "12px 14px",
                    borderTop: "1px solid #EEF1F8",
                  }}
                >
                  <Avatar
                    name={member.name}
                    role={
                      String(member.accountRole).toLowerCase() === "coach"
                        ? "Coach"
                        : "Player"
                    }
                  />

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0D1B3E",
                      }}
                    >
                      {member.name}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: "#8892A4",
                      }}
                    >
                      {member.email} · {member.state} · {member.level}
                    </div>
                  </div>

                  <Badge
                    value={
                      member.member_role === "manager"
                        ? "Coach"
                        : String(member.accountRole).toLowerCase() === "coach"
                          ? "Coach"
                          : "Player"
                    }
                    type="role"
                  />

                  <Badge
                    value={
                      member.status === "accepted"
                        ? "Active"
                        : member.status === "pending"
                          ? "Pending"
                          : "Inactive"
                    }
                  />
                </div>
              ))
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            {selectedClub.status === "Active" ? (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  changeClubStatus(selectedClub, "paused")
                }
                style={{
                  ...buttonBase,
                  padding: "10px 15px",
                  background: "#FEF3C7",
                  color: "#B45309",
                }}
              >
                Pause club
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  changeClubStatus(selectedClub, "active")
                }
                style={{
                  ...buttonBase,
                  padding: "10px 15px",
                  background: "#E0FAF3",
                  color: "#047857",
                }}
              >
                Reactivate club
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => deleteClub(selectedClub)}
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background: "#FEE2E2",
                color: "#DC2626",
              }}
            >
              Delete club
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}