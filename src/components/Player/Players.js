import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import styles from "../Layout/Pages.module.css";
import Loader from "../Loader/Loader";
import useLoadingDelay from "../Loader/LoadingDelay";

const C = {
  text: "var(--text, #0D1B3E)",
  muted: "var(--text-muted, #8892A4)",
  card: "var(--card, #FFFFFF)",
  soft: "var(--soft, #F6F8FF)",
  line: "var(--line, #EEF1F8)",
};

const CURRENT_PLAYER = {
  level: "Intermediate",
  style: "Aggressive",
  state: "Penang",
  weakness: "Defense",
};

function SkillBar({ name, val, dim }) {
  return (
    <div className={styles.skillRow}>
      <div className={styles.skillLbl}>{name}</div>
      <div className={styles.skillTrack}>
        <div
          className={styles.skillFill}
          style={{
            width: `${val}%`,
            background: dim
              ? "linear-gradient(90deg,#93b4f5,#bdd1fb)"
              : "linear-gradient(90deg,#1A5FFF,#3B7BFF)",
          }}
        />
      </div>
      <div className={styles.skillVal}>{val}</div>
    </div>
  );
}

function getPartnerMatch(player, criteria) {
  let score = 0;
  const reasons = [];

  if (criteria.level === "Any" || player.level === criteria.level) {
    score += 25;
    reasons.push(criteria.level === "Any" ? "Level suitable" : "Same level");
  }

  if (criteria.state === "Any" || player.state === criteria.state) {
    score += 20;
    reasons.push(criteria.state === "Any" ? "Location okay" : "Same state");
  }

  if (criteria.style === "Auto") {
    if (
      CURRENT_PLAYER.style === "Aggressive" &&
      ["Defensive", "All-round"].includes(player.style)
    ) {
      score += 20;
      reasons.push("Balances your attacking style");
    } else if (player.style === "All-round") {
      score += 15;
      reasons.push("Flexible style");
    }
  } else if (criteria.style === "Any" || player.style === criteria.style) {
    score += 18;
    reasons.push(
      criteria.style === "Any" ? "Style suitable" : `Matches ${criteria.style}`,
    );
  }

  if (criteria.gameType !== "Singles") {
    if (player.net >= 70) {
      score += 12;
      reasons.push("Good net play");
    }

    if (player.defense >= 70) {
      score += 10;
      reasons.push("Strong defense");
    }
  }

  if (CURRENT_PLAYER.weakness === "Defense" && player.defense >= 75) {
    score += 13;
    reasons.push("Covers defense weakness");
  }

  return {
    score: Math.min(score, 100),
    reasons: reasons.slice(0, 3),
  };
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          marginBottom: 6,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>

      <select
        className={styles.formSelect}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: "100%" }}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function SmallInfo({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
        {value || "—"}
      </div>
    </div>
  );
}

function PlayerDetail({
  p,
  isPartner,
  onAddOpponent,
  onRemoveOpponent,
  onAddPartner,
  onRemovePartner,
}) {
  const streakColor = p.streak?.startsWith("W") ? "#16a34a" : "#DC2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={styles.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div
            className={styles.av}
            style={{ width: 48, height: 48, fontSize: 16 }}
          >
            {p.init}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              {p.name}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {p.club} · {p.state}
            </div>

            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
              }}
            >
              <span className={styles.badgeBlue}>{p.level}</span>
              <span className={styles.badgeGray}>{p.style}</span>
              {p.isOpp && <span className={styles.badgeAmber}>Opponent</span>}
              {isPartner && <span className={styles.badgeGreen}>Partner</span>}
              {p.source === "public" && (
                <span className={styles.badgeGray}>Public profile</span>
              )}
            </div>
          </div>
        </div>

        {p.ig && (
          <div style={{ marginBottom: 14 }}>
            <a
              href={`https://instagram.com/${p.ig.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                padding: "4px 12px",
                background: "#FFF0F6",
                border: "1px solid #FBC8DC",
                borderRadius: 20,
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 11, color: "#B5305A", fontWeight: 600 }}>
                {p.ig}
              </span>
            </a>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[
            { label: "Matches", value: p.matches, color: C.text },
            { label: "Win rate", value: `${p.winRate}%`, color: "#1A5FFF" },
            { label: "Streak", value: p.streak, color: streakColor },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: C.soft,
                borderRadius: 10,
                padding: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, color: C.muted }}>{stat.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div className={styles.cardTitle}>Skill profile</div>
          <SkillBar name="Smash" val={p.smash} />
          <SkillBar name="Footwork" val={p.footwork} />
          <SkillBar name="Defense" val={p.defense} />
          <SkillBar name="Net play" val={p.net} />
          <SkillBar name="Drop shot" val={p.dropShot} dim />
          <SkillBar name="Serve" val={p.serve} dim />
        </div>
      </div>

      {p.isOpp && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Head-to-head vs you</div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              padding: "16px 0",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#00C48C" }}>
                {p.w}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Your wins</div>
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.muted,
                alignSelf: "center",
              }}
            >
              vs
            </div>

            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#EF4444" }}>
                {p.l}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Your losses</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: C.muted }}>
            Last played: {p.last}
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardTitle}>About</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <SmallInfo label="Club" value={p.club} />
          <SmallInfo label="Hand" value={p.hand} />
          <SmallInfo label="Playing since" value={p.since} />
          <SmallInfo label="Preferred court" value={p.court} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {isPartner ? (
          <button
            className={styles.btnOutline}
            style={{
              width: "100%",
              color: "#DC2626",
              borderColor: "#FECACA",
              background: "#FEF2F2",
            }}
            onClick={() => onRemovePartner(p)}
          >
            Remove partner
          </button>
        ) : p.partnerRequestStatus === "pending" ? (
          <button
            className={styles.btnOutline}
            style={{ width: "100%" }}
            disabled
          >
            Request pending
          </button>
        ) : (
          <button
            className={styles.btnPrimary}
            style={{ width: "100%" }}
            onClick={() => onAddPartner(p)}
          >
            Request partner
          </button>
        )}

        {p.isOpp ? (
          <button
            className={styles.btnOutline}
            style={{
              width: "100%",
              color: "#DC2626",
              borderColor: "#FECACA",
              background: "#FEF2F2",
            }}
            onClick={() => onRemoveOpponent(p)}
          >
            Remove opponent
          </button>
        ) : (
          <button
            className={styles.btnOutline}
            style={{ width: "100%" }}
            onClick={() => onAddOpponent(p)}
          >
            + Add opponent
          </button>
        )}
      </div>
    </div>
  );
}

function CoachStatusBadge({ status }) {
  if (status === "accepted") {
    return <span className={styles.badgeGreen}>My coach</span>;
  }

  if (status === "pending") {
    return <span className={styles.badgeAmber}>Request pending</span>;
  }

  if (status === "rejected") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          padding: "3px 8px",
          background: "#FEF2F2",
          color: "#DC2626",
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        Request declined
      </span>
    );
  }

  return null;
}

function CoachDetail({ coach, onRequest, onCancel }) {
  const [message, setMessage] = useState(coach.requestMessage || "");
  const requestStatus = coach.requestStatus;

  useEffect(() => {
    setMessage(coach.requestMessage || "");
  }, [coach.id, coach.requestMessage]);

  const requestButtonLabel =
    requestStatus === "rejected" || requestStatus === "cancelled"
      ? "Send request again"
      : "Request coach";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={styles.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div
            className={styles.av}
            style={{ width: 52, height: 52, fontSize: 17 }}
          >
            {coach.init}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>
              {coach.name}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              {coach.club} · {coach.state}
            </div>

            {coach.headline && (
              <div
                style={{
                  fontSize: 12,
                  color: C.text,
                  marginTop: 7,
                  lineHeight: 1.5,
                }}
              >
                {coach.headline}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 5,
                marginTop: 7,
              }}
            >
              <span className={styles.badgeBlue}>{coach.coachingLevel}</span>
              {coach.isAccepting ? (
                <span className={styles.badgeGreen}>Accepting players</span>
              ) : (
                <span className={styles.badgeGray}>Not accepting players</span>
              )}
              <CoachStatusBadge status={requestStatus} />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: C.soft,
              borderRadius: 12,
              padding: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, color: C.muted }}>Experience</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A5FFF" }}>
              {coach.yearsExperience} year
              {coach.yearsExperience === 1 ? "" : "s"}
            </div>
          </div>

          <div
            style={{
              background: C.soft,
              borderRadius: 12,
              padding: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, color: C.muted }}>Player capacity</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
              Up to {coach.maxPlayers}
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div className={styles.cardTitle}>Coaching specialties</div>

          {coach.specialties.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted }}>
              No specialties added yet.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {coach.specialties.map((specialty) => (
                <span key={specialty} className={styles.badgeBlue}>
                  {specialty}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>About coach</div>
        <div
          style={{
            fontSize: 13,
            color: C.text,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {coach.bio || "This coach has not added a biography yet."}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          <SmallInfo label="Club" value={coach.club} />
          <SmallInfo label="State" value={coach.state} />
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
              Certification
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              {coach.certification || "Not provided"}
            </div>

            {coach.certificationIssuer && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Issued by {coach.certificationIssuer}
              </div>
            )}

            {coach.certificationFileUrl && (
              <a
                href={coach.certificationFileUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: 6,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "#E8EFFE",
                  color: "#1A5FFF",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                View certificate
              </a>
            )}
          </div>

          <SmallInfo label="Coaching level" value={coach.coachingLevel} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          <SmallInfo label="Training venue" value={coach.trainingVenue} />
          <SmallInfo label="Availability" value={coach.availability} />
          <SmallInfo
            label="Player levels"
            value={coach.playerLevels.join(", ")}
          />
          <SmallInfo
            label="Session types"
            value={coach.sessionTypes.join(", ")}
          />
        </div>

        {coach.coachingPhilosophy && (
          <div style={{ marginTop: 16 }}>
            <div className={styles.cardTitle}>Coaching philosophy</div>
            <div
              style={{
                fontSize: 13,
                color: C.text,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {coach.coachingPhilosophy}
            </div>
          </div>
        )}

        {coach.achievements && (
          <div style={{ marginTop: 16 }}>
            <div className={styles.cardTitle}>Achievements</div>
            <div
              style={{
                fontSize: 13,
                color: C.text,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {coach.achievements}
            </div>
          </div>
        )}

        {coach.instagram && (
          <a
            href={`https://instagram.com/${coach.instagram.replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              marginTop: 14,
              padding: "5px 12px",
              background: "#FFF0F6",
              border: "1px solid #FBC8DC",
              borderRadius: 20,
              textDecoration: "none",
              color: "#B5305A",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {coach.instagram}
          </a>
        )}
      </div>

      {(requestStatus === null ||
        requestStatus === "rejected" ||
        requestStatus === "cancelled") && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Request this coach</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            Add a short message about your training goal. This is optional.
          </div>

          <textarea
            className={styles.formInput}
            rows={4}
            placeholder="Example: I want to improve my footwork and match consistency."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
          />

          <button
            className={styles.btnPrimary}
            style={{ width: "100%", opacity: coach.isAccepting ? 1 : 0.55 }}
            disabled={!coach.isAccepting}
            onClick={() => onRequest(coach, message)}
          >
            {coach.isAccepting
              ? requestButtonLabel
              : "Coach is not accepting players"}
          </button>
        </div>
      )}

      {requestStatus === "pending" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Request sent</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            The coach can accept or decline this request from the coach page.
          </div>

          <button
            className={styles.btnOutline}
            style={{
              width: "100%",
              marginTop: 12,
              color: "#DC2626",
              borderColor: "#FECACA",
              background: "#FEF2F2",
            }}
            onClick={() => onCancel(coach, false)}
          >
            Cancel request
          </button>
        </div>
      )}

      {requestStatus === "accepted" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Coach connected</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            This coach can now manage your coaching progress and leave feedback.
          </div>

          <button
            className={styles.btnOutline}
            style={{
              width: "100%",
              marginTop: 12,
              color: "#DC2626",
              borderColor: "#FECACA",
              background: "#FEF2F2",
            }}
            onClick={() => onCancel(coach, true)}
          >
            Remove coach
          </button>
        </div>
      )}
    </div>
  );
}


function formatNotificationDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PLAYER_DIRECTORY_NOTIFICATION_TYPES = [
  "coach_request_accepted",
  "coach_request_declined",
  "coach_request_rejected",
  "partner_request_received",
  "partner_request_accepted",
  "partner_request_rejected",
];

function normaliseNotificationText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isPlayerDirectoryNotification(notification) {
  const type = normaliseNotificationText(notification?.type);
  const title = normaliseNotificationText(notification?.title);
  const message = normaliseNotificationText(notification?.message);

  const acceptedTypes = PLAYER_DIRECTORY_NOTIFICATION_TYPES.map((item) =>
    normaliseNotificationText(item),
  );

  if (acceptedTypes.includes(type)) {
    return true;
  }

  const combined = `${title} ${message}`;

  return [
    "coach request accepted",
    "coach request declined",
    "coach request rejected",
    "new partner request",
    "partner request accepted",
    "partner request declined",
    "partner request rejected",
  ].some((phrase) => combined.includes(phrase));
}

function NotificationCenter({ onPartnerChanged }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNotifications([]);
        setPartnerRequests([]);
        return;
      }

      const [notificationResult, requestResult] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("player_partner_requests")
          .select("*")
          .eq("recipient_user_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      if (notificationResult.error) {
        console.error("Failed to load notifications:", notificationResult.error);
      } else {
        setNotifications(
          (notificationResult.data || []).filter(
            isPlayerDirectoryNotification,
          ),
        );
      }

      if (requestResult.error) {
        console.error("Failed to load partner requests:", requestResult.error);
      } else {
        setPartnerRequests(requestResult.data || []);
      }
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let channel = null;

    loadNotifications();

    async function setupRealtime() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Failed to start notification realtime:", error);
        return;
      }

      if (!active || !user) return;

      const channelName = [
        "players-notifications",
        user.id,
        Date.now(),
        Math.random().toString(36).slice(2),
      ].join("-");

      const nextChannel = supabase.channel(channelName);

      nextChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (active) loadNotifications();
        },
      );

      nextChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_partner_requests",
          filter: `recipient_user_id=eq.${user.id}`,
        },
        () => {
          if (!active) return;
          loadNotifications();
          onPartnerChanged?.();
        },
      );

      channel = nextChannel;

      nextChannel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Notification realtime channel failed.");
        }
      });

      if (!active) {
        supabase.removeChannel(nextChannel);
      }
    }

    setupRealtime();

    return () => {
      active = false;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [loadNotifications, onPartnerChanged]);

  const unreadCount =
    notifications.filter((item) => !item.is_read).length + partnerRequests.length;

  async function markAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("id", unreadIds);

    if (error) {
      console.error("Failed to mark notifications read:", error);
      return;
    }

    await loadNotifications();
  }

  async function clearNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const notificationIds = notifications.map(
      (notification) => notification.id,
    );

    if (notificationIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .in("id", notificationIds);

    if (error) {
      console.error("Failed to clear notifications:", error);
      return;
    }

    await loadNotifications();
  }

  async function deleteNotification(id) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete notification:", error);
      return;
    }

    await loadNotifications();
  }

  async function respondToPartnerRequest(request, nextStatus) {
    const { error } = await supabase
      .from("player_partner_requests")
      .update({
        status: nextStatus,
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      console.error("Failed to respond to partner request:", error);
      alert(error.message || "Failed to update partner request.");
      return;
    }

    await loadNotifications();
    await onPartnerChanged?.();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) loadNotifications();
        }}
        aria-label="Notifications"
        style={{
          width: 46,
          height: 42,
          borderRadius: 12,
          border: `1.5px solid ${C.line}`,
          background: C.card,
          cursor: "pointer",
          fontSize: 20,
          position: "relative",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              right: -5,
              top: -7,
              minWidth: 21,
              height: 21,
              padding: "0 5px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#FFFFFF",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              border: "2px solid #FFFFFF",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 50,
            right: 0,
            width: "min(430px, calc(100vw - 30px))",
            maxHeight: 560,
            overflowY: "auto",
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 18,
            boxShadow: "0 18px 45px rgba(13,27,62,0.18)",
            padding: 14,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
              Notifications
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#1A5FFF",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Mark read
              </button>
              <button
                type="button"
                onClick={clearNotifications}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#EF4444",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {partnerRequests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.muted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 7,
                }}
              >
                Partner requests
              </div>

              {partnerRequests.map((request) => (
                <div
                  key={request.id}
                  style={{
                    padding: 12,
                    borderRadius: 13,
                    border: "1px solid #BFDBFE",
                    background: "#EFF6FF",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 13 }}>
                    🤝 {request.requester_name || "A player"} wants to be your partner
                  </div>
                  {request.message && (
                    <div
                      style={{
                        color: C.muted,
                        fontSize: 12,
                        lineHeight: 1.5,
                        marginTop: 5,
                      }}
                    >
                      {request.message}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 7,
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => respondToPartnerRequest(request, "rejected")}
                      style={{ color: "#DC2626", borderColor: "#FECACA" }}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => respondToPartnerRequest(request, "accepted")}
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loadingNotifications && notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.muted }}>
              Loading notifications...
            </div>
          ) : notifications.length === 0 && partnerRequests.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: C.muted }}>
              No coach or partner notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  position: "relative",
                  padding: "12px 38px 12px 12px",
                  borderRadius: 13,
                  border: notification.is_read
                    ? `1px solid ${C.line}`
                    : "1px solid #93C5FD",
                  background: notification.is_read ? C.soft : "#EFF6FF",
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => deleteNotification(notification.id)}
                  style={{
                    position: "absolute",
                    right: 9,
                    top: 9,
                    width: 25,
                    height: 25,
                    borderRadius: 999,
                    border: "1px solid #FECACA",
                    background: "#FFFFFF",
                    color: "#EF4444",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  ×
                </button>

                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                  {notification.title || "Notification"}
                  {!notification.is_read && (
                    <span style={{ color: "#1A5FFF", marginLeft: 7 }}>●</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: C.muted,
                    marginTop: 4,
                  }}
                >
                  {notification.message || notification.body || ""}
                </div>
                <div style={{ fontSize: 10, color: "#A0A9BA", marginTop: 6 }}>
                  {formatNotificationDate(notification.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function normaliseSpecialties(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export default function Players() {
  const [tab, setTab] = useState("all");

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [players, setPlayers] = useState([]);

  const [coachSearch, setCoachSearch] = useState("");
  const [coachLevelFilter, setCoachLevelFilter] = useState("");
  const [coachStateFilter, setCoachStateFilter] = useState("");
  const [coachSpecialtyFilter, setCoachSpecialtyFilter] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);

  const [loading, setLoading] = useState(true);
  const showLoader = useLoadingDelay(loading, 350);

  const [partnerCriteria, setPartnerCriteria] = useState({
    gameType: "Doubles",
    level: "Intermediate",
    style: "Auto",
    state: "Penang",
    goal: "Training",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Failed to read current user:", userError);
      }

      const [
        publicPlayerResult,
        profilePlayerResult,
        skillResult,
        coachResult,
      ] = await Promise.all([
        supabase
          .from("public_players")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("player_profiles")
          .select("*")
          .order("display_name", { ascending: true }),
        supabase
          .from("player_skill_ratings")
          .select("*"),
        supabase
          .from("coach_profiles")
          .select("*")
          .order("display_name", { ascending: true }),
      ]);

      if (publicPlayerResult.error) {
        console.error(
          "Failed to load public players:",
          publicPlayerResult.error,
        );
      }

      if (profilePlayerResult.error) {
        console.error(
          "Failed to load registered player profiles:",
          profilePlayerResult.error,
        );
      }

      if (skillResult.error) {
        console.error("Failed to load player skills:", skillResult.error);
      }

      if (coachResult.error) {
        console.error("Failed to load coaches:", coachResult.error);
      }

      const ratingsByPlayerId = new Map();

      (skillResult.data || []).forEach((rating) => {
        [
          rating.player_id,
          rating.user_id,
          rating.profile_id,
          rating.id,
        ]
          .filter(Boolean)
          .forEach((key) => {
            ratingsByPlayerId.set(String(key), rating);
          });
      });

      let connectionData = [];
      let coachRelationshipData = [];
      let outgoingPartnerRequests = [];

      if (user) {
        const [connectionResult, relationshipResult, partnerRequestResult] = await Promise.all([
          supabase
            .from("player_connections")
            .select("*")
            .eq("user_id", user.id),
          supabase
            .from("coach_player_relationships")
            .select("*")
            .eq("player_user_id", user.id),
          supabase
            .from("player_partner_requests")
            .select("*")
            .eq("requester_user_id", user.id),
        ]);

        if (connectionResult.error) {
          console.error(
            "Failed to load player connections:",
            connectionResult.error,
          );
        } else {
          connectionData = connectionResult.data || [];
        }

        if (relationshipResult.error) {
          console.error(
            "Failed to load coach relationships:",
            relationshipResult.error,
          );
        } else {
          coachRelationshipData = relationshipResult.data || [];
        }

        if (partnerRequestResult.error) {
          console.error(
            "Failed to load partner requests:",
            partnerRequestResult.error,
          );
        } else {
          outgoingPartnerRequests = partnerRequestResult.data || [];
        }
      }

      const registeredPlayers = (profilePlayerResult.data || [])
        .filter((player) => !user || player.user_id !== user.id)
        .map((player) => {
          const rating =
            ratingsByPlayerId.get(String(player.user_id)) ||
            ratingsByPlayerId.get(String(player.id)) ||
            null;

          const partner = connectionData.find(
            (connection) =>
              (
                connection.target_player_id === player.id ||
                connection.target_player_id === player.user_id
              ) &&
              connection.type === "partner",
          );

          const opponent = connectionData.find(
            (connection) =>
              (
                connection.target_player_id === player.id ||
                connection.target_player_id === player.user_id
              ) &&
              connection.type === "opponent",
          );

          return {
            id: player.id,
            userId: player.user_id || null,
            source: "registered",
            init:
              player.display_name?.charAt(0)?.toUpperCase() || "?",
            name: player.display_name || "Unknown",
            club: player.club || "No club",
            state: player.state || player.location || "-",
            level:
              player.level ||
              player.skill_level ||
              player.player_category ||
              player.category ||
              "Beginner",
            style:
              player.playing_style ||
              player.play_style ||
              player.style ||
              "All-round",
            hand:
              player.dominant_hand ||
              player.playing_hand ||
              player.hand ||
              "-",
            since:
              player.playing_since ||
              player.since ||
              "-",
            court:
              player.preferred_court ||
              player.court ||
              "-",
            ig: player.instagram || null,
            smash: Number(rating?.smash ?? 0),
            defense: Number(rating?.defense ?? 0),
            footwork: Number(rating?.footwork ?? 0),
            dropShot: Number(
              rating?.drop_shot ??
              rating?.dropShot ??
              0
            ),
            net: Number(
              rating?.net_play ??
              rating?.net ??
              0
            ),
            serve: Number(rating?.serve ?? 0),
            matches: Number(player.matches || 0),
            winRate: Number(player.win_rate || 0),
            streak: player.streak || "W0",
            isPartner: Boolean(partner),
            partnerRequestStatus:
              outgoingPartnerRequests.find(
                (request) =>
                  request.recipient_user_id === player.user_id,
              )?.status || null,
            isOpp: Boolean(opponent),
            w: Number(opponent?.h2h_wins || 0),
            l: Number(opponent?.h2h_losses || 0),
            last: opponent?.last_played || "—",
          };
        });

      const registeredNames = new Set(
        registeredPlayers.map((player) =>
          player.name.trim().toLowerCase(),
        ),
      );

      const publicPlayers = (publicPlayerResult.data || [])
        .filter((player) => {
          if (user && player.user_id === user.id) return false;

          const name = String(player.name || "")
            .trim()
            .toLowerCase();

          return name && !registeredNames.has(name);
        })
        .map((player) => {
          const rating =
            ratingsByPlayerId.get(String(player.id)) ||
            (player.user_id
              ? ratingsByPlayerId.get(String(player.user_id))
              : null);

          const partner = connectionData.find(
            (connection) =>
              connection.target_player_id === player.id &&
              connection.type === "partner",
          );

          const opponent = connectionData.find(
            (connection) =>
              connection.target_player_id === player.id &&
              connection.type === "opponent",
          );

          return {
            id: player.id,
            userId: player.user_id || null,
            source: "public",
            init: player.name?.charAt(0)?.toUpperCase() || "?",
            name: player.name || "Unknown",
            club: player.club || "-",
            state: player.state || "-",
            level: player.level || "Beginner",
            style: player.style || "All-round",
            hand: player.hand || "-",
            since: player.since || "-",
            court: player.court || "-",
            ig: player.instagram || null,
            smash: Number(
              player.smash ??
              rating?.smash ??
              0
            ),
            defense: Number(
              player.defense ??
              rating?.defense ??
              0
            ),
            footwork: Number(
              player.footwork ??
              rating?.footwork ??
              0
            ),
            dropShot: Number(
              player.drop_shot ??
              player.dropShot ??
              rating?.drop_shot ??
              rating?.dropShot ??
              0
            ),
            net: Number(
              player.net_play ??
              player.net ??
              rating?.net_play ??
              rating?.net ??
              0
            ),
            serve: Number(
              player.serve ??
              rating?.serve ??
              0
            ),
            matches: Number(player.matches || 0),
            winRate: Number(player.win_rate || 0),
            streak: player.streak || "W0",
            isPartner: Boolean(partner),
            partnerRequestStatus:
              outgoingPartnerRequests.find(
                (request) =>
                  request.recipient_user_id === player.user_id,
              )?.status || null,
            isOpp: Boolean(opponent),
            w: Number(opponent?.h2h_wins || 0),
            l: Number(opponent?.h2h_losses || 0),
            last: opponent?.last_played || "—",
          };
        });

      const formattedPlayers = [
        ...registeredPlayers,
        ...publicPlayers,
      ].sort((a, b) => a.name.localeCompare(b.name));

      const formattedCoaches = (coachResult.data || [])
        .filter((coach) => !user || coach.user_id !== user.id)
        .map((coach) => {
          const relationship = coachRelationshipData.find(
            (item) => item.coach_user_id === coach.user_id,
          );

          return {
            id: coach.id,
            userId: coach.user_id,
            init: coach.display_name?.charAt(0)?.toUpperCase() || "?",
            name: coach.display_name || "Unknown coach",
            club: coach.club || "-",
            state: coach.state || "-",
            coachingLevel: coach.coaching_level || "Community Coach",
            yearsExperience: Number(coach.experience_years || 0),
            specialties: normaliseSpecialties(coach.specialties),
            bio: coach.bio || "",
            instagram: coach.instagram || null,
            headline: coach.headline || "",
            playerLevels: Array.isArray(coach.player_levels) ? coach.player_levels : [],
            sessionTypes: Array.isArray(coach.session_types) ? coach.session_types : [],
            trainingVenue: coach.training_venue || "-",
            availability: coach.availability || "-",
            coachingPhilosophy: coach.coaching_philosophy || "",
            achievements: coach.achievements || "",
            certification: coach.certification || "-",
            certificationIssuer: coach.certification_issuer || "",
            certificationFileUrl: coach.certification_file_url || null,
            isAccepting: Boolean(coach.accepting_players),
            maxPlayers: Number(coach.player_capacity || 10),
            requestStatus: relationship?.status || null,
            requestMessage: relationship?.message || "",
            relationshipId: relationship?.id || null,
          };
        });

      setPlayers(formattedPlayers);
      setCoaches(formattedCoaches);

      setSelected((previous) =>
        previous
          ? formattedPlayers.find((player) => player.id === previous.id) || null
          : null,
      );

      setSelectedCoach((previous) =>
        previous
          ? formattedCoaches.find((coach) => coach.id === previous.id) || null
          : null,
      );
    } catch (error) {
      console.error("Unexpected loading error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pool = players.filter((player) =>
    tab === "opp" ? player.isOpp : true,
  );

  const filtered = pool.filter((player) => {
    const matchesSearch =
      !search ||
      [player.name, player.club, player.state].some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase()),
      );

    return (
      matchesSearch &&
      (!levelFilter || player.level === levelFilter) &&
      (!styleFilter || player.style === styleFilter)
    );
  });

  const partnerRecommendations = useMemo(() => {
    return players
      .map((player) => {
        const match = getPartnerMatch(player, partnerCriteria);
        return {
          ...player,
          matchScore: match.score,
          reasons: match.reasons,
        };
      })
      .filter((player) => player.matchScore >= 45)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [players, partnerCriteria]);

  const savedPartners = players.filter((player) => player.isPartner);

  const coachLevels = useMemo(
    () =>
      [
        ...new Set(coaches.map((coach) => coach.coachingLevel).filter(Boolean)),
      ].sort(),
    [coaches],
  );

  const coachStates = useMemo(
    () =>
      [...new Set(coaches.map((coach) => coach.state).filter(Boolean))].sort(),
    [coaches],
  );

  const coachSpecialties = useMemo(
    () =>
      [
        ...new Set(
          coaches.flatMap((coach) => coach.specialties).filter(Boolean),
        ),
      ].sort(),
    [coaches],
  );

  const filteredCoaches = useMemo(() => {
    const query = coachSearch.trim().toLowerCase();

    return coaches.filter((coach) => {
      const matchesSearch =
        !query ||
        [
          coach.name,
          coach.club,
          coach.state,
          coach.coachingLevel,
          ...coach.specialties,
        ].some((value) => String(value).toLowerCase().includes(query));

      const matchesLevel =
        !coachLevelFilter || coach.coachingLevel === coachLevelFilter;

      const matchesState =
        !coachStateFilter || coach.state === coachStateFilter;

      const matchesSpecialty =
        !coachSpecialtyFilter ||
        coach.specialties.includes(coachSpecialtyFilter);

      return matchesSearch && matchesLevel && matchesState && matchesSpecialty;
    });
  }, [
    coaches,
    coachSearch,
    coachLevelFilter,
    coachStateFilter,
    coachSpecialtyFilter,
  ]);

  async function addConnection(player, type) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      return;
    }

    const { error } = await supabase.from("player_connections").upsert(
      {
        user_id: user.id,
        target_player_id: player.id,
        type,
        h2h_wins: type === "opponent" ? player.w || 0 : 0,
        h2h_losses: type === "opponent" ? player.l || 0 : 0,
        last_played: type === "opponent" ? player.last || "—" : null,
      },
      { onConflict: "user_id,target_player_id,type" },
    );

    if (error) {
      console.error(error);
      alert("Failed to save.");
      return;
    }

    await fetchData();
  }


  async function requestPartner(player, message = "") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (!player.userId) {
      alert(
        "This public player is not linked to a registered account, so a partner request cannot be sent.",
      );
      return;
    }

    if (player.userId === user.id) {
      alert("You cannot send a partner request to yourself.");
      return;
    }

    const { data: ownProfile } = await supabase
      .from("player_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("player_partner_requests").upsert(
      {
        requester_user_id: user.id,
        recipient_user_id: player.userId,
        requester_name:
          ownProfile?.display_name || user.user_metadata?.display_name || "A player",
        recipient_name: player.name,
        message: message.trim() || null,
        status: "pending",
        responded_at: null,
      },
      { onConflict: "requester_user_id,recipient_user_id" },
    );

    if (error) {
      console.error("Failed to send partner request:", error);
      alert(error.message || "Failed to send partner request.");
      return;
    }

    await fetchData();
    alert("Partner request sent.");
  }

  async function removeConnection(player, type) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("player_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("target_player_id", player.id)
      .eq("type", type);

    if (error) {
      console.error(error);
      alert("Failed to remove.");
      return;
    }

    await fetchData();
  }

  async function requestCoach(coach, message) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (!coach.isAccepting) {
      alert("This coach is not accepting players right now.");
      return;
    }

    const { error } = await supabase.from("coach_player_relationships").upsert(
      {
        player_user_id: user.id,
        coach_user_id: coach.userId,
        status: "pending",
        message: message.trim() || null,
        responded_at: null,
      },
      { onConflict: "player_user_id,coach_user_id" },
    );

    if (error) {
      console.error("Failed to request coach:", error);
      alert(error.message || "Failed to send coach request.");
      return;
    }

    await fetchData();
    alert("Coach request sent.");
  }

  async function cancelCoachRelationship(coach, isAccepted) {
    const actionText = isAccepted ? "remove this coach" : "cancel this request";

    if (!window.confirm(`Are you sure you want to ${actionText}?`)) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("coach_player_relationships")
      .update({
        status: "cancelled",
        responded_at: null,
      })
      .eq("player_user_id", user.id)
      .eq("coach_user_id", coach.userId);

    if (error) {
      console.error("Failed to cancel coach relationship:", error);
      alert(error.message || "Failed to update coach request.");
      return;
    }

    await fetchData();
  }

  function switchTab(nextTab) {
    setTab(nextTab);
    setSelected(null);
    setSelectedCoach(null);
  }

  if (loading && !showLoader) {
    return null;
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading player directory..." />
      </div>
    );
  }

  return (
    <div>
      <div
        className={styles.pageHead}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <div className={styles.pageTitle}>Players, Opponents & Coaches</div>
          <div className={styles.pageSub}>
            Search players, find partners, review opponents and connect with a
            coach
          </div>
        </div>

        <NotificationCenter onPartnerChanged={fetchData} />
      </div>

      <div className={styles.tabs} style={{ marginBottom: 16 }}>
        <button
          className={`${styles.tab} ${tab === "all" ? styles.tabActive : ""}`}
          onClick={() => switchTab("all")}
        >
          All players
        </button>

        <button
          className={`${styles.tab} ${
            tab === "partner" ? styles.tabActive : ""
          }`}
          onClick={() => switchTab("partner")}
        >
          Find partner
        </button>

        <button
          className={`${styles.tab} ${tab === "opp" ? styles.tabActive : ""}`}
          onClick={() => switchTab("opp")}
        >
          My opponents
        </button>

        <button
          className={`${styles.tab} ${tab === "coach" ? styles.tabActive : ""}`}
          onClick={() => switchTab("coach")}
        >
          Find coach
        </button>
      </div>

      {tab !== "partner" && tab !== "coach" && (
        <div className={styles.g2}>
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                className={styles.formInput}
                style={{ flex: 1, minWidth: 160 }}
                placeholder="Search by name, club or state..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                className={styles.formSelect}
                style={{ width: 130 }}
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
              >
                <option value="">All levels</option>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>

              <select
                className={styles.formSelect}
                style={{ width: 130 }}
                value={styleFilter}
                onChange={(event) => setStyleFilter(event.target.value)}
              >
                <option value="">All styles</option>
                <option>Aggressive</option>
                <option>Defensive</option>
                <option>All-round</option>
                <option>Attacking</option>
              </select>
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {filtered.length} player{filtered.length !== 1 ? "s" : ""} found
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length === 0 && (
                <div
                  className={styles.card}
                  style={{ textAlign: "center", padding: 40, color: C.muted }}
                >
                  No players match your search.
                </div>
              )}

              {filtered.map((player) => {
                const isSelected = selected?.id === player.id;

                return (
                  <div
                    key={player.id}
                    onClick={() => setSelected(player)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 16,
                      cursor: "pointer",
                      background: isSelected ? C.soft : C.card,
                      border: isSelected
                        ? "2px solid #1A5FFF"
                        : `1.5px solid ${C.line}`,
                    }}
                  >
                    <div className={styles.av}>{player.init}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: C.text,
                        }}
                      >
                        {player.name}
                      </div>
                      <div
                        style={{ fontSize: 11, color: C.muted, marginTop: 2 }}
                      >
                        {player.club} · {player.state}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className={styles.badgeBlue}>{player.level}</span>
                        <span className={styles.badgeGray}>{player.style}</span>
                        {player.isOpp && (
                          <span className={styles.badgeAmber}>Opponent</span>
                        )}
                        {player.isPartner && (
                          <span className={styles.badgeGreen}>Partner</span>
                        )}
                        {player.source === "public" && (
                          <span className={styles.badgeGray}>
                            Public profile
                          </span>
                        )}
                      </div>
                    </div>

                    {player.isOpp && (
                      <span className={styles.badgeAmber}>
                        H2H {player.w}W {player.l}L
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {!selected ? (
              <div
                className={styles.card}
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.muted,
                }}
              >
                Select a player
              </div>
            ) : (
              <PlayerDetail
                key={`${selected.id}-${selected.isOpp}-${selected.isPartner}`}
                p={selected}
                isPartner={selected.isPartner}
                onAddOpponent={(player) => {
                  addConnection(player, "opponent");
                  setTab("opp");
                }}
                onRemoveOpponent={(player) => {
                  removeConnection(player, "opponent");
                  setTab("all");
                }}
                onAddPartner={(player) => requestPartner(player)}
                onRemovePartner={(player) =>
                  removeConnection(player, "partner")
                }
              />
            )}
          </div>
        </div>
      )}

      {tab === "partner" && (
        <div className={styles.g2}>
          <div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Find suitable partner</div>

              <FormSelect
                label="Game type"
                value={partnerCriteria.gameType}
                onChange={(value) =>
                  setPartnerCriteria((previous) => ({
                    ...previous,
                    gameType: value,
                  }))
                }
                options={["Singles", "Doubles", "Mixed Doubles"]}
              />

              <FormSelect
                label="Preferred level"
                value={partnerCriteria.level}
                onChange={(value) =>
                  setPartnerCriteria((previous) => ({
                    ...previous,
                    level: value,
                  }))
                }
                options={["Any", "Beginner", "Intermediate", "Advanced"]}
              />

              <FormSelect
                label="Preferred style"
                value={partnerCriteria.style}
                onChange={(value) =>
                  setPartnerCriteria((previous) => ({
                    ...previous,
                    style: value,
                  }))
                }
                options={[
                  "Auto",
                  "Any",
                  "Aggressive",
                  "Defensive",
                  "All-round",
                  "Attacking",
                ]}
              />

              <FormSelect
                label="State"
                value={partnerCriteria.state}
                onChange={(value) =>
                  setPartnerCriteria((previous) => ({
                    ...previous,
                    state: value,
                  }))
                }
                options={["Any", "Penang", "Selangor", "Kuala Lumpur", "Johor"]}
              />

              <FormSelect
                label="Goal"
                value={partnerCriteria.goal}
                onChange={(value) =>
                  setPartnerCriteria((previous) => ({
                    ...previous,
                    goal: value,
                  }))
                }
                options={["Casual", "Training", "Tournament"]}
              />

              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  background: C.soft,
                  border: `1px solid ${C.line}`,
                  borderRadius: 12,
                  color: C.text,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: C.text,
                    marginBottom: 10,
                  }}
                >
                  Your profile used for matching
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px minmax(0, 1fr)",
                    rowGap: 7,
                    columnGap: 10,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: C.muted }}>Level</span>
                  <strong style={{ color: C.text }}>
                    {CURRENT_PLAYER.level}
                  </strong>

                  <span style={{ color: C.muted }}>Style</span>
                  <strong style={{ color: C.text }}>
                    {CURRENT_PLAYER.style}
                  </strong>

                  <span style={{ color: C.muted }}>State</span>
                  <strong style={{ color: C.text }}>
                    {CURRENT_PLAYER.state}
                  </strong>

                  <span style={{ color: C.muted }}>Weakness</span>
                  <strong style={{ color: C.text }}>
                    {CURRENT_PLAYER.weakness}
                  </strong>
                </div>
              </div>
            </div>

            <div className={styles.card} style={{ marginTop: 12 }}>
              <div className={styles.cardTitle}>Saved partners</div>

              {savedPartners.length === 0 && (
                <div style={{ fontSize: 13, color: C.muted }}>
                  No saved partners yet.
                </div>
              )}

              {savedPartners.map((player) => (
                <div key={player.id} className={styles.listRow}>
                  <div className={styles.av}>{player.init}</div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontSize: 13, fontWeight: 700, color: C.text }}
                    >
                      {player.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {player.club} · {player.level} · {player.style}
                    </div>
                  </div>

                  <button
                    className={styles.btnOutline}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      color: "#DC2626",
                      borderColor: "#FECACA",
                      background: "#FEF2F2",
                    }}
                    onClick={() => removeConnection(player, "partner")}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Recommended partners</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {partnerRecommendations.map((player) => (
                <div
                  key={player.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px minmax(0,1fr) 76px 110px",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  <div className={styles.av}>{player.init}</div>

                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 800, color: C.text }}
                    >
                      {player.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {player.club} · {player.state}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 5,
                        flexWrap: "wrap",
                        marginTop: 6,
                      }}
                    >
                      <span className={styles.badgeBlue}>{player.level}</span>
                      <span className={styles.badgeGray}>{player.style}</span>
                      {player.reasons.map((reason) => (
                        <span key={reason} className={styles.badgeAmber}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.muted }}>Match</div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: player.matchScore >= 75 ? "#00976C" : "#1A5FFF",
                      }}
                    >
                      {player.matchScore}%
                    </div>
                  </div>

                  {player.isPartner ? (
                    <button
                      className={styles.btnOutline}
                      style={{
                        color: "#DC2626",
                        borderColor: "#FECACA",
                        background: "#FEF2F2",
                      }}
                      onClick={() => removeConnection(player, "partner")}
                    >
                      Remove
                    </button>
                  ) : player.partnerRequestStatus === "pending" ? (
                    <button className={styles.btnOutline} disabled>
                      Pending
                    </button>
                  ) : (
                    <button
                      className={styles.btnPrimary}
                      onClick={() => requestPartner(player)}
                    >
                      Request
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "coach" && (
        <div className={styles.g2}>
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                className={styles.formInput}
                style={{ flex: 1, minWidth: 180 }}
                placeholder="Search coach, club, state or specialty..."
                value={coachSearch}
                onChange={(event) => setCoachSearch(event.target.value)}
              />

              <select
                className={styles.formSelect}
                style={{ width: 150 }}
                value={coachLevelFilter}
                onChange={(event) => setCoachLevelFilter(event.target.value)}
              >
                <option value="">All coaching levels</option>
                {coachLevels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>

              <select
                className={styles.formSelect}
                style={{ width: 135 }}
                value={coachStateFilter}
                onChange={(event) => setCoachStateFilter(event.target.value)}
              >
                <option value="">All states</option>
                {coachStates.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>

              <select
                className={styles.formSelect}
                style={{ width: 150 }}
                value={coachSpecialtyFilter}
                onChange={(event) =>
                  setCoachSpecialtyFilter(event.target.value)
                }
              >
                <option value="">All specialties</option>
                {coachSpecialties.map((specialty) => (
                  <option key={specialty}>{specialty}</option>
                ))}
              </select>
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {filteredCoaches.length} coach
              {filteredCoaches.length !== 1 ? "es" : ""} found
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredCoaches.length === 0 && (
                <div
                  className={styles.card}
                  style={{ textAlign: "center", padding: 40, color: C.muted }}
                >
                  No coaches match your search.
                </div>
              )}

              {filteredCoaches.map((coach) => {
                const isSelected = selectedCoach?.id === coach.id;

                return (
                  <div
                    key={coach.id}
                    onClick={() => setSelectedCoach(coach)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 16,
                      cursor: "pointer",
                      background: isSelected ? C.soft : C.card,
                      border: isSelected
                        ? "2px solid #1A5FFF"
                        : `1.5px solid ${C.line}`,
                    }}
                  >
                    <div className={styles.av}>{coach.init}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: C.text,
                        }}
                      >
                        {coach.name}
                      </div>
                      <div
                        style={{ fontSize: 11, color: C.muted, marginTop: 2 }}
                      >
                        {coach.club} · {coach.state} · {coach.yearsExperience}{" "}
                        year
                        {coach.yearsExperience === 1 ? "" : "s"} experience
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className={styles.badgeBlue}>
                          {coach.coachingLevel}
                        </span>

                        {coach.specialties.slice(0, 2).map((specialty) => (
                          <span key={specialty} className={styles.badgeGray}>
                            {specialty}
                          </span>
                        ))}

                        <CoachStatusBadge status={coach.requestStatus} />
                      </div>
                    </div>

                    {coach.isAccepting ? (
                      <span className={styles.badgeGreen}>Available</span>
                    ) : (
                      <span className={styles.badgeGray}>Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {!selectedCoach ? (
              <div
                className={styles.card}
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.muted,
                }}
              >
                Select a coach
              </div>
            ) : (
              <CoachDetail
                key={`${selectedCoach.id}-${selectedCoach.requestStatus}`}
                coach={selectedCoach}
                onRequest={requestCoach}
                onCancel={cancelCoachRelationship}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}