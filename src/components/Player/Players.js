import NotificationBell from "../Notifications/NotificationBell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { QRCodeCanvas } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../../lib/supabase";
import { calculateMatchStats } from "../../utils/matchStats";
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

const REPORT_REASON_OPTIONS = [
  "Harassment or bullying",
  "Fake or misleading profile",
  "Inappropriate content",
  "Spam or scam",
  "Unsafe behaviour",
  "Impersonation",
  "Other",
];

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

function calculateAgeFromDob(dateOfBirth) {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  if (Number.isNaN(birthDate.getTime())) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function calculateExperienceYears(dateOfBirth, startedPlayingAge, fallback = 0) {
  const currentAge = calculateAgeFromDob(dateOfBirth);
  const startAge = Number(startedPlayingAge);

  if (
    currentAge !== null &&
    startedPlayingAge !== null &&
    startedPlayingAge !== undefined &&
    startedPlayingAge !== "" &&
    Number.isFinite(startAge) &&
    startAge >= 0 &&
    startAge <= currentAge
  ) {
    return currentAge - startAge;
  }

  return Number(fallback || 0);
}

function calculatePlayerExperience(player = {}) {
  const calculated = calculateExperienceYears(
    player.date_of_birth,
    player.started_playing_age,
    player.experience_years ?? player.years_experience
  );

  if (calculated > 0) {
    return calculated;
  }

  const sinceYear = Number(
    String(player.since || "").trim()
  );
  const currentYear = new Date().getFullYear();

  if (
    Number.isInteger(sinceYear) &&
    sinceYear >= 1900 &&
    sinceYear <= currentYear
  ) {
    return currentYear - sinceYear;
  }

  return 0;
}



function ReportModal({
  target,
  submitting,
  onClose,
  onSubmit,
}) {
  const [reason, setReason] = useState(REPORT_REASON_OPTIONS[0]);
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setReason(REPORT_REASON_OPTIONS[0]);
    setDetails("");
    setError("");
  }, [target?.id, target?.type]);

  if (!target) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!reason) {
      setError("Please choose a report reason.");
      return;
    }

    if (reason === "Other" && !details.trim()) {
      setError("Please explain the report.");
      return;
    }

    setError("");
    await onSubmit({
      reason,
      details: details.trim(),
    });
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(13, 27, 62, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(520px, 100%)",
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 24px 60px rgba(13,27,62,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
              }}
            >
              Report {target.type}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: C.muted,
              }}
            >
              Report {target.name} to the ShuttleTrack administrator.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close report form"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${C.line}`,
              background: C.card,
              color: C.muted,
              cursor: submitting ? "wait" : "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 11,
              fontWeight: 800,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: 0.7,
            }}
          >
            Reason
          </label>

          <select
            className={styles.formSelect}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            style={{ width: "100%" }}
          >
            {REPORT_REASON_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 11,
              fontWeight: 800,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: 0.7,
            }}
          >
            Details
          </label>

          <textarea
            className={styles.formInput}
            rows={5}
            maxLength={1000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            disabled={submitting}
            placeholder="Describe what happened. Do not include passwords or private financial information."
            style={{
              width: "100%",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />

          <div
            style={{
              marginTop: 5,
              textAlign: "right",
              fontSize: 10,
              color: C.muted,
            }}
          >
            {details.length}/1000
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: 11,
              borderRadius: 10,
              background: "#FEF2F2",
              color: "#B91C1C",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            padding: 12,
            borderRadius: 11,
            background: "#FFF7ED",
            color: "#9A3412",
            fontSize: 11,
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          Reports are reviewed by an administrator. Submitting a false report
          may lead to account action.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 9,
          }}
        >
          <button
            type="button"
            className={styles.btnOutline}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "9px 15px",
              background: "#DC2626",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 800,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlayerDetail({
  p,
  isPartner,
  onAddOpponent,
  onRemoveOpponent,
  onAddPartner,
  onCancelPartnerRequest,
  onRemovePartner,
  onAddFavourite,
  onRemoveFavourite,
  onReport,
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
              {p.isFavourite && (
                <span className={styles.badgeBlue}>Favourite</span>
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
            gap: 12,
          }}
        >
          <SmallInfo label="Club" value={p.club} />
          <SmallInfo label="Hand" value={p.hand} />
          <SmallInfo
            label="Experience"
            value={
              p.experienceYears > 0
                ? `${p.experienceYears} ${p.experienceYears === 1 ? "year" : "years"}`
                : "—"
            }
          />

          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
              Playing video
            </div>

            {p.videoUrl ? (
              <video
                src={p.videoUrl}
                controls
                preload="metadata"
                title={p.videoTitle || "Playing video"}
                style={{
                  width: "100%",
                  maxHeight: 150,
                  borderRadius: 10,
                  background: "#0F172A",
                  display: "block",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  minHeight: 72,
                  borderRadius: 10,
                  border: `1px dashed ${C.line}`,
                  background: C.soft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 10,
                  color: C.muted,
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                No featured playing video
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Equipment</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <SmallInfo label="Racket" value={p.racket} />
          <SmallInfo label="String" value={p.stringName} />
          <SmallInfo
            label="String tension"
            value={
              p.stringTension !== null &&
              p.stringTension !== undefined &&
              p.stringTension !== ""
                ? `${p.stringTension} lbs`
                : "—"
            }
          />
          <SmallInfo label="Shoes" value={p.shoes} />
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
            style={{
              width: "100%",
              color: "#DC2626",
              borderColor: "#FECACA",
              background: "#FEF2F2",
            }}
            onClick={() => onCancelPartnerRequest(p)}
          >
            Cancel request
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

      {p.isFavourite ? (
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => onRemoveFavourite(p)}
          style={{
            width: "100%",
            color: "#B45309",
            borderColor: "#FDE68A",
            background: "#FFFBEB",
          }}
        >
          ★ Remove from favourites
        </button>
      ) : (
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => onAddFavourite(p)}
          style={{
            width: "100%",
            color: "#1A5FFF",
            borderColor: "#BFDBFE",
            background: "#EFF6FF",
          }}
        >
          ☆ Add to favourites
        </button>
      )}

      <button
        type="button"
        className={styles.btnOutline}
        onClick={() => onReport(p)}
        style={{
          width: "100%",
          color: "#DC2626",
          borderColor: "#FECACA",
          background: "#FFF7F7",
        }}
      >
        Report player
      </button>
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


function getWhatsAppNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";

  // Convert Malaysian local numbers such as 012-3456789 to 60123456789.
  if (digits.startsWith("0")) {
    return `60${digits.slice(1)}`;
  }

  return digits;
}

function getCoachVenueMapEmbedUrl(venue, state) {
  const locationText = [
    venue?.venueName,
    venue?.venueAddress,
    state,
  ]
    .filter(
      value =>
        value &&
        value !== "-" &&
        value !== "—"
    )
    .join(", ");

  if (!locationText) return "";

  return `https://www.google.com/maps?q=${encodeURIComponent(
    locationText,
  )}&output=embed`;
}

function CoachDetail({
  coach,
  onRequest,
  onCancel,
  onAcceptIncoming,
  onDeclineIncoming,
  onReport,
  onRequestClub,
  onCancelClubRequest,
}) {
  const [message, setMessage] = useState(coach.requestMessage || "");
  const requestStatus = coach.requestStatus;
  const requestSentByCoach =
    requestStatus === "pending" &&
    coach.requestedBy === "coach";

  useEffect(() => {
    setMessage(coach.requestMessage || "");
  }, [coach.id, coach.requestMessage]);

  const requestButtonLabel =
    ["rejected", "cancelled", "removed"].includes(requestStatus)
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
          {coach.avatarUrl ? (
            <img
              src={coach.avatarUrl}
              alt={`${coach.name} profile`}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              className={styles.av}
              style={{ width: 52, height: 52, fontSize: 17, flexShrink: 0 }}
            >
              {coach.init}
            </div>
          )}

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
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
            marginTop: 18,
          }}
        >
          <SmallInfo label="Club" value={coach.club} />
          <SmallInfo label="State" value={coach.state} />
          <SmallInfo label="Coaching level" value={coach.coachingLevel} />
          <SmallInfo
            label="Primary training venue"
            value={
              coach.trainingVenues.find(
                venue => venue.isPrimary
              )?.venueName ||
              coach.trainingVenues[0]?.venueName ||
              coach.trainingVenue
            }
          />
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

        {coach.trainingVenues.length > 0 && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <div className={styles.cardTitle}>
              Training venues
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {coach.trainingVenues.map((venue) => (
                <div
                  key={venue.id}
                  style={{
                    overflow: "hidden",
                    borderRadius: 14,
                    border: venue.isPrimary
                      ? "1.5px solid #1A5FFF"
                      : `1px solid ${C.line}`,
                    background: C.soft,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: C.text,
                        }}
                      >
                        {venue.venueName}
                      </div>

                      {venue.venueAddress && (
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: C.muted,
                            lineHeight: 1.5,
                          }}
                        >
                          {venue.venueAddress}
                        </div>
                      )}
                    </div>

                    {venue.isPrimary && (
                      <span className={styles.badgeBlue}>
                        Primary
                      </span>
                    )}
                  </div>

                  {getCoachVenueMapEmbedUrl(
                    venue,
                    coach.state,
                  ) && (
                    <iframe
                      title={`${coach.name} ${venue.venueName} map`}
                      src={getCoachVenueMapEmbedUrl(
                        venue,
                        coach.state,
                      )}
                      width="100%"
                      height="220"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{
                        display: "block",
                        border: 0,
                      }}
                    />
                  )}

                  {venue.locationUrl && (
                    <div style={{ padding: "9px 14px 12px" }}>
                      <a
                        href={venue.locationUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#1A5FFF",
                          fontSize: 12,
                          fontWeight: 800,
                          textDecoration: "none",
                        }}
                      >
                        Open in Google Maps ↗
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {requestStatus === "accepted" && coach.phone && (
          <a
            href={`https://wa.me/${getWhatsAppNumber(
              coach.phone,
            )}?text=${encodeURIComponent(
              `Hi ${coach.name}, I found your coaching profile on ShuttleTrack and would like to ask about badminton coaching.`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className={styles.btnPrimary}
            style={{
              marginTop: 16,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            WhatsApp coach
          </a>
        )}

        {(coach.certification ||
          coach.certificationFileUrl ||
          coach.relevantCertificates.length > 0) && (
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <div className={styles.cardTitle}>Certificates</div>

            {(coach.certification || coach.certificationFileUrl) && (
              <div
                role={coach.certificationFileUrl ? "button" : undefined}
                tabIndex={coach.certificationFileUrl ? 0 : undefined}
                onClick={() => {
                  if (coach.certificationFileUrl) {
                    window.open(
                      coach.certificationFileUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    coach.certificationFileUrl &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    window.open(
                      coach.certificationFileUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }}
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #93B4F5",
                  background: C.soft,
                  cursor: coach.certificationFileUrl ? "pointer" : "default",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
                title={
                  coach.certificationFileUrl
                    ? "Click to view certificate"
                    : "No certificate file uploaded"
                }
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: C.text,
                        }}
                      >
                        {coach.certification || "Certificate uploaded"}
                      </div>

                      <span className={styles.badgeBlue}>Primary</span>
                    </div>

                    {coach.certificationIssuer && (
                      <div
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          marginTop: 4,
                        }}
                      >
                        Issued by {coach.certificationIssuer}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {coach.relevantCertificates.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.muted,
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Other relevant certificates
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {coach.relevantCertificates.map((certificate) => (
                    <div
                      key={certificate.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        window.open(
                          certificate.file_url,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          window.open(
                            certificate.file_url,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }
                      }}
                      title="Click to view certificate"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "11px 12px",
                        borderRadius: 10,
                        border: `1px solid ${C.line}`,
                        background: C.soft,
                        cursor: "pointer",
                        transition: "transform 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: C.text,
                          }}
                        >
                          {certificate.certificate_name}
                        </div>

                        {certificate.issuer && (
                          <div
                            style={{
                              fontSize: 10,
                              color: C.muted,
                              marginTop: 3,
                            }}
                          >
                            Issued by {certificate.issuer}
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          flexShrink: 0,
                          color: "#1A5FFF",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        Open
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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

        {requestStatus === "accepted" && (
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            {coach.clubMatch && (
              <div>
                <div className={styles.cardTitle}>
                  Join your coach&apos;s club
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: C.text,
                    lineHeight: 1.6,
                    marginBottom: 12,
                  }}
                >
                  Your coach is from{" "}
                  <strong>
                    {coach.clubMatch.shortName
                      ? `${coach.clubMatch.shortName} · ${coach.clubMatch.name}`
                      : coach.clubMatch.name}
                  </strong>
                  . Joining the club is optional and separate from your coach
                  relationship.
                </div>

                {coach.clubMembershipStatus === "accepted" ? (
                  <span className={styles.badgeGreen}>Already joined</span>
                ) : coach.clubMembershipStatus === "pending" ? (
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => onCancelClubRequest(coach)}
                    style={{
                      width: "100%",
                      color: "#DC2626",
                      borderColor: "#FECACA",
                      background: "#FEF2F2",
                    }}
                  >
                    Cancel club request
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => onRequestClub(coach)}
                    disabled={!coach.clubMatch.acceptingMembers}
                    style={{
                      width: "100%",
                      opacity: coach.clubMatch.acceptingMembers ? 1 : 0.55,
                    }}
                  >
                    {coach.clubMatch.acceptingMembers
                      ? "Request to join club"
                      : "Club is not accepting members"}
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: coach.clubMatch ? 16 : 0,
                paddingTop: coach.clubMatch ? 16 : 0,
                borderTop: coach.clubMatch
                  ? `1px solid ${C.line}`
                  : "none",
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => onCancel(coach, true)}
                style={{
                  width: "100%",
                  color: "#DC2626",
                  borderColor: "#FECACA",
                  background: "#FEF2F2",
                }}
              >
                Remove coach
              </button>

              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => onReport(coach)}
                style={{
                  width: "100%",
                  color: "#DC2626",
                  borderColor: "#FECACA",
                  background: "#FFF7F7",
                }}
              >
                Report coach
              </button>
            </div>
          </div>
        )}
      </div>

      {(requestStatus === null ||
        requestStatus === "rejected" ||
        requestStatus === "cancelled" ||
        requestStatus === "removed") && (
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

      {requestSentByCoach && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Coach request received</div>
          <div
            style={{
              fontSize: 13,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            {coach.name} invited you to connect as their player.
            Accepting gives the coach access to your synced progress,
            fitness and assigned training sessions.
          </div>

          {coach.requestMessage && (
            <div
              style={{
                marginTop: 10,
                padding: 11,
                borderRadius: 10,
                background: C.soft,
                color: C.text,
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {coach.requestMessage}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => onDeclineIncoming(coach)}
              style={{
                color: "#DC2626",
                borderColor: "#FECACA",
                background: "#FEF2F2",
              }}
            >
              Decline
            </button>

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => onAcceptIncoming(coach)}
            >
              Accept coach
            </button>
          </div>
        </div>
      )}

      {requestStatus === "pending" && !requestSentByCoach && (
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

      {requestStatus !== "accepted" && (
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => onReport(coach)}
          style={{
            width: "100%",
            color: "#DC2626",
            borderColor: "#FECACA",
            background: "#FFF7F7",
          }}
        >
          Report coach
        </button>
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
  const [searchParams] = useSearchParams();
  const notificationTab = searchParams.get("tab");
  const notificationCoachId = searchParams.get("coach");

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

  const [reportTarget, setReportTarget] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const [currentUserId, setCurrentUserId] = useState("");
  const [showMyQr, setShowMyQr] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanError, setScanError] = useState("");
  const qrScannerRef = useRef(null);
  const scanCloseTimerRef = useRef(null);

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
        equipmentResult,
        skillResult,
        playerMediaResult,
        coachResult,
        coachCertificatesResult,
        coachVenuesResult,
        clubsResult,
        acceptedMembershipsResult,
        playerMatchesResult,
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
          .from("player_equipment")
          .select("player_id, racket, string, tension_lbs, shoes"),
        supabase
          .from("player_skill_ratings")
          .select("*"),
        supabase
          .from("player_profile_media")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("coach_profiles")
          .select("*")
          .order("display_name", { ascending: true }),
        supabase
          .from("coach_certifications")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("coach_training_venues")
          .select("*")
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("clubs")
          .select("id, short_name, name, accepting_members"),
        supabase
          .from("club_members")
          .select(`
            user_id,
            status,
            clubs (
              id,
              short_name,
              name
            )
          `)
          .eq("status", "accepted"),
        supabase
          .from("player_matches")
          .select("id, player_id, match_date, result, created_at")
          .order("match_date", { ascending: false })
          .order("created_at", { ascending: false }),
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

      if (equipmentResult.error) {
        console.error(
          "Failed to load player equipment:",
          equipmentResult.error,
        );
      }

      if (skillResult.error) {
        console.error("Failed to load player skills:", skillResult.error);
      }

      if (playerMediaResult.error) {
        console.error("Failed to load player profile media:", playerMediaResult.error);
      }

      if (coachResult.error) {
        console.error("Failed to load coaches:", coachResult.error);
      }

      if (coachCertificatesResult.error) {
        console.error(
          "Failed to load coach certificates:",
          coachCertificatesResult.error,
        );
      }

      if (coachVenuesResult.error) {
        console.error(
          "Failed to load coach training venues:",
          coachVenuesResult.error,
        );
      }

      if (clubsResult.error) {
        console.error("Failed to load clubs:", clubsResult.error);
      }

      if (acceptedMembershipsResult.error) {
        console.error(
          "Failed to load accepted club memberships:",
          acceptedMembershipsResult.error,
        );
      }

      const acceptedClubByUserId = new Map();

      (acceptedMembershipsResult.data || []).forEach((row) => {
        if (!row?.user_id) return;

        const userId = String(row.user_id);

        if (acceptedClubByUserId.has(userId)) return;

        const club = Array.isArray(row.clubs)
          ? row.clubs[0]
          : row.clubs;

        const clubName = String(
          club?.short_name || club?.name || "",
        ).trim();

        if (clubName) {
          acceptedClubByUserId.set(userId, clubName);
        }
      });

      if (playerMatchesResult.error) {
        console.error(
          "Failed to load player matches:",
          playerMatchesResult.error,
        );
      }

      const matchesByProfileId = new Map();

      (playerMatchesResult.data || []).forEach((match) => {
        const profileId = match.player_id;
        if (!profileId) return;

        const key = String(profileId);
        const current = matchesByProfileId.get(key) || [];
        current.push(match);
        matchesByProfileId.set(key, current);
      });

      const matchStatsByProfileId = new Map();

      matchesByProfileId.forEach((matches, profileId) => {
        matchStatsByProfileId.set(
          profileId,
          calculateMatchStats(matches),
        );
      });

      const certificatesByCoachId = new Map();

      (coachCertificatesResult.data || []).forEach((certificate) => {
        const coachId = certificate.coach_user_id;
        if (!coachId) return;

        const current = certificatesByCoachId.get(coachId) || [];
        current.push(certificate);
        certificatesByCoachId.set(coachId, current);
      });

      const venuesByCoachId = new Map();

      (coachVenuesResult.data || []).forEach((venue) => {
        const coachId = venue.coach_user_id;
        if (!coachId) return;

        const current = venuesByCoachId.get(coachId) || [];
        current.push({
          id: venue.id,
          venueName: venue.venue_name || "",
          venueAddress: venue.venue_address || "",
          locationUrl: venue.location_url || "",
          isPrimary: venue.is_primary === true,
        });
        venuesByCoachId.set(coachId, current);
      });

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

      const videoByPlayerId = new Map();

      (playerMediaResult.data || []).forEach((media) => {
        const playerId = media.player_id;
        const mediaUrl = media.media_url || media.file_url || "";
        const fileType = String(media.file_type || media.mime_type || "").toLowerCase();
        const fileName = String(media.file_name || "").toLowerCase();
        const isVideo =
          fileType.startsWith("video/") ||
          /\.(mp4|mov|webm|m4v|avi)$/i.test(fileName) ||
          /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(mediaUrl);

        if (
          playerId &&
          mediaUrl &&
          isVideo &&
          media.is_featured === true
        ) {
          videoByPlayerId.set(String(playerId), {
            url: mediaUrl,
            title: media.title || media.file_name || "Playing video",
          });
        }
      });

      let connectionData = [];
      let coachRelationshipData = [];
      let outgoingPartnerRequests = [];
      let ownClubMemberships = [];

      if (user) {
        const [
          connectionResult,
          relationshipResult,
          partnerRequestResult,
          clubMembershipResult,
        ] = await Promise.all([
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
          supabase
            .from("club_members")
            .select("*")
            .eq("user_id", user.id),
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


        if (clubMembershipResult.error) {
          console.error(
            "Failed to load club memberships:",
            clubMembershipResult.error,
          );
        } else {
          ownClubMemberships = clubMembershipResult.data || [];
        }
      }

      const equipmentByPlayerId = new Map();

      (equipmentResult.data || []).forEach((equipment) => {
        if (!equipment?.player_id) return;
        equipmentByPlayerId.set(String(equipment.player_id), equipment);
      });

      const allRegisteredProfiles = profilePlayerResult.data || [];

      // Build duplicate guards before privacy filtering. This prevents a
      // hidden registered account from reappearing through public_players.
      const allRegisteredNames = new Set(
        allRegisteredProfiles
          .map((player) =>
            String(player.display_name || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );

      const allRegisteredUserIds = new Set(
        allRegisteredProfiles
          .map((player) => player.user_id && String(player.user_id))
          .filter(Boolean),
      );

      const registeredPlayers = allRegisteredProfiles
        .filter((player) => {
          if (user && player.user_id === user.id) return false;
          return player.profile_public !== false;
        })
        .map((player) => {
          const rating =
            ratingsByPlayerId.get(String(player.user_id)) ||
            ratingsByPlayerId.get(String(player.id)) ||
            null;

          const equipment =
            equipmentByPlayerId.get(String(player.id)) ||
            null;

          const matchStats =
            matchStatsByProfileId.get(String(player.id)) ||
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

          const favourite = connectionData.find(
            (connection) =>
              (
                connection.target_player_id === player.id ||
                connection.target_player_id === player.user_id
              ) &&
              connection.type === "favourite",
          );

          return {
            id: player.id,
            userId: player.user_id || null,
            source: "registered",
            init:
              player.display_name?.charAt(0)?.toUpperCase() || "?",
            name: player.display_name || "Unknown",
            club:
              player.club ||
              acceptedClubByUserId.get(String(player.user_id)) ||
              player.external_club ||
              "No club",
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
            startedPlayingAge:
              player.started_playing_age !== null &&
              player.started_playing_age !== undefined
                ? Number(player.started_playing_age)
                : null,
            experienceYears: calculatePlayerExperience(player),
            videoUrl: videoByPlayerId.get(String(player.id))?.url || null,
            videoTitle: videoByPlayerId.get(String(player.id))?.title || "Playing video",
            ig: player.instagram || null,
            racket:
              equipment?.racket ||
              player.racket ||
              "—",
            stringName:
              equipment?.string ||
              player.string ||
              player.string_name ||
              "—",
            stringTension:
              equipment?.tension_lbs !== null &&
              equipment?.tension_lbs !== undefined &&
              equipment?.tension_lbs !== ""
                ? Number(equipment.tension_lbs)
                : player.tension_lbs !== null &&
                  player.tension_lbs !== undefined &&
                  player.tension_lbs !== ""
                  ? Number(player.tension_lbs)
                  : player.string_tension !== null &&
                    player.string_tension !== undefined &&
                    player.string_tension !== ""
                    ? Number(player.string_tension)
                    : null,
            shoes:
              equipment?.shoes ||
              player.shoes ||
              "—",
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
            matches: Number(
              matchStats?.totalMatches ??
              player.matches ??
              0
            ),
            winRate: Number(
              matchStats?.winRate ??
              player.win_rate ??
              0
            ),
            streak:
              matchStats?.currentStreak ||
              player.streak ||
              "W0",
            isPartner: Boolean(partner),
            partnerRequestStatus:
              outgoingPartnerRequests.find(
                (request) =>
                  request.recipient_user_id === player.user_id &&
                  request.status === "pending",
              )?.status || null,
            isOpp: Boolean(opponent),
            isFavourite: Boolean(favourite),
            w: Number(opponent?.h2h_wins || 0),
            l: Number(opponent?.h2h_losses || 0),
            last: opponent?.last_played || "—",
          };
        });

      const publicPlayers = (publicPlayerResult.data || [])
        .filter((player) => {
          if (user && player.user_id === user.id) return false;

          const publicUserId = player.user_id
            ? String(player.user_id)
            : "";

          const name = String(player.name || "")
            .trim()
            .toLowerCase();

          if (!name) return false;

          // Registered player_profiles is always the source of truth.
          // Block legacy duplicates even when the registered profile is private.
          if (
            publicUserId &&
            allRegisteredUserIds.has(publicUserId)
          ) {
            return false;
          }

          if (allRegisteredNames.has(name)) {
            return false;
          }

          return true;
        })
        .map((player) => {
          const rating =
            ratingsByPlayerId.get(String(player.id)) ||
            (player.user_id
              ? ratingsByPlayerId.get(String(player.user_id))
              : null);

          const equipment =
            equipmentByPlayerId.get(String(player.id)) ||
            null;

          const matchStats =
            matchStatsByProfileId.get(String(player.id)) ||
            null;

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

          const favourite = connectionData.find(
            (connection) =>
              connection.target_player_id === player.id &&
              connection.type === "favourite",
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
            startedPlayingAge:
              player.started_playing_age !== null &&
              player.started_playing_age !== undefined
                ? Number(player.started_playing_age)
                : null,
            experienceYears: calculatePlayerExperience(player),
            videoUrl: player.video_url || player.playing_video_url || null,
            videoTitle: player.video_title || "Playing video",
            ig: player.instagram || null,
            racket:
              equipment?.racket ||
              player.racket ||
              "—",
            stringName:
              equipment?.string ||
              player.string ||
              player.string_name ||
              "—",
            stringTension:
              equipment?.tension_lbs !== null &&
              equipment?.tension_lbs !== undefined &&
              equipment?.tension_lbs !== ""
                ? Number(equipment.tension_lbs)
                : player.tension_lbs !== null &&
                  player.tension_lbs !== undefined &&
                  player.tension_lbs !== ""
                  ? Number(player.tension_lbs)
                  : player.string_tension !== null &&
                    player.string_tension !== undefined &&
                    player.string_tension !== ""
                    ? Number(player.string_tension)
                    : null,
            shoes:
              equipment?.shoes ||
              player.shoes ||
              "—",
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
            matches: Number(
              matchStats?.totalMatches ??
              player.matches ??
              0
            ),
            winRate: Number(
              matchStats?.winRate ??
              player.win_rate ??
              0
            ),
            streak:
              matchStats?.currentStreak ||
              player.streak ||
              "W0",
            isPartner: Boolean(partner),
            partnerRequestStatus:
              outgoingPartnerRequests.find(
                (request) =>
                  request.recipient_user_id === player.user_id &&
                  request.status === "pending",
              )?.status || null,
            isOpp: Boolean(opponent),
            isFavourite: Boolean(favourite),
            w: Number(opponent?.h2h_wins || 0),
            l: Number(opponent?.h2h_losses || 0),
            last: opponent?.last_played || "—",
          };
        });

      const formattedPlayers = [
        ...registeredPlayers,
        ...publicPlayers,
      ].sort((a, b) => a.name.localeCompare(b.name));

      const clubsByShortName = new Map(
        (clubsResult.data || [])
          .filter((club) => club.short_name)
          .map((club) => [
            String(club.short_name).trim().toUpperCase(),
            {
              id: club.id,
              shortName: String(club.short_name).trim().toUpperCase(),
              name: club.name || "Unnamed club",
              acceptingMembers: club.accepting_members !== false,
            },
          ]),
      );

      const formattedCoaches = (coachResult.data || [])
        .filter((coach) => !user || coach.user_id !== user.id)
        .map((coach) => {
          const relationship = coachRelationshipData.find(
            (item) => item.coach_user_id === coach.user_id,
          );

          const coachClubShortName = String(coach.club || "")
            .trim()
            .toUpperCase();
          const clubMatch =
            clubsByShortName.get(coachClubShortName) || null;
          const clubMembership = clubMatch
            ? ownClubMemberships.find(
                (membership) => membership.club_id === clubMatch.id,
              )
            : null;

          return {
            id: coach.id,
            userId: coach.user_id,
            init: coach.display_name?.charAt(0)?.toUpperCase() || "?",
            avatarUrl: coach.avatar_url || null,
            name: coach.display_name || "Unknown coach",
            club: coach.club || "-",
            state: coach.state || "-",
            coachingLevel: coach.coaching_level || "Community Coach",
            yearsExperience: Number(coach.experience_years || 0),
            specialties: normaliseSpecialties(coach.specialties),
            bio: coach.bio || "",
            phone: coach.phone || "",
            instagram: coach.instagram || null,
            headline: coach.headline || "",
            playerLevels: Array.isArray(coach.player_levels) ? coach.player_levels : [],
            sessionTypes: Array.isArray(coach.session_types) ? coach.session_types : [],
            trainingVenue: coach.training_venue || "-",
            trainingVenues:
              venuesByCoachId.get(coach.user_id) ||
              (
                coach.training_venue
                  ? [
                      {
                        id: `legacy-${coach.user_id}`,
                        venueName: coach.training_venue,
                        venueAddress: "",
                        locationUrl:
                          coach.training_venue_url || "",
                        isPrimary: true,
                      },
                    ]
                  : []
              ),
            availability: coach.availability || "-",
            coachingPhilosophy: coach.coaching_philosophy || "",
            achievements: coach.achievements || "",
            certification: coach.certification || "-",
            certificationIssuer: coach.certification_issuer || "",
            certificationFileUrl: coach.certification_file_url || null,
            relevantCertificates: (certificatesByCoachId.get(coach.user_id) || [])
              .filter(item => item.certificate_name && item.file_url),
            isAccepting: Boolean(coach.accepting_players),
            maxPlayers: Number(coach.player_capacity || 10),
            requestStatus: relationship?.status || null,
            requestMessage: relationship?.message || "",
            requestedBy:
              String(relationship?.requested_by || "")
                .trim()
                .toLowerCase(),
            relationshipId: relationship?.id || null,
            clubMatch,
            clubMembershipStatus: clubMembership?.status || null,
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

  useEffect(() => {
    if (notificationTab !== "coach") return;

    setTab("coach");
    setSelected(null);

    if (!notificationCoachId || coaches.length === 0) {
      return;
    }

    const matchingCoach = coaches.find(
      (coach) =>
        String(coach.userId || "") === String(notificationCoachId) ||
        String(coach.id || "") === String(notificationCoachId)
    );

    if (matchingCoach) {
      setSelectedCoach(matchingCoach);
      setCoachSearch("");
    }
  }, [notificationTab, notificationCoachId, coaches]);

  useEffect(() => {
    let mounted = true;

    async function loadCurrentUserId() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Failed to load current user for QR:", error);
        return;
      }

      if (mounted) {
        setCurrentUserId(user?.id || "");
      }
    }

    loadCurrentUserId();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`players-privacy-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_profiles",
        },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coach_player_relationships",
          filter: currentUserId
            ? `player_user_id=eq.${currentUserId}`
            : undefined,
        },
        () => fetchData(),
      )
      .subscribe();

    const handleVisibilityUpdated = () => fetchData();
    window.addEventListener(
      "profile-visibility-updated",
      handleVisibilityUpdated,
    );

    return () => {
      window.removeEventListener(
        "profile-visibility-updated",
        handleVisibilityUpdated,
      );
      supabase.removeChannel(channel);
    };
  }, [fetchData, currentUserId]);

  const pool = players.filter((player) => {
    if (tab === "opp") return player.isOpp;
    if (tab === "fav") return player.isFavourite;

    return true;
  });

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


  function openPlayerReport(player) {
    setReportTarget({
      id: player.id,
      userId: player.userId || null,
      type: "player",
      name: player.name,
      source: player.source || "registered",
    });
  }

  function openCoachReport(coach) {
    setReportTarget({
      id: coach.id,
      userId: coach.userId || null,
      type: "coach",
      name: coach.name,
      source: "registered",
    });
  }

  async function submitReport({ reason, details }) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    if (!reportTarget) return;

    if (
      reportTarget.userId &&
      reportTarget.userId === user.id
    ) {
      alert("You cannot report your own profile.");
      setReportTarget(null);
      return;
    }

    setSubmittingReport(true);

    try {
      const { error } = await supabase
        .from("user_reports")
        .insert({
          reporter_user_id: user.id,
          reported_user_id: reportTarget.userId,
          category: reportTarget.type,
          subject: reportTarget.name,
          description: [
            `Reason: ${reason}`,
            `Details: ${details || "No additional details provided."}`,
          ].join("\n"),
          status: "pending",
        });

      if (error) throw error;

      setReportTarget(null);
      alert(
        `Your ${reportTarget.type} report has been submitted for admin review.`,
      );
    } catch (error) {
      console.error("Failed to submit report:", error);
      alert(error.message || "Failed to submit report.");
    } finally {
      setSubmittingReport(false);
    }
  }

  async function addConnection(player, type) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    if (!player?.id) {
      alert("This player could not be identified.");
      return;
    }

    if (!["partner", "opponent", "favourite"].includes(type)) {
      alert("Invalid connection type.");
      return;
    }

    try {
      const { error } = await supabase
        .from("player_connections")
        .upsert(
          {
            user_id: user.id,
            target_player_id: player.id,
            type,
            h2h_wins:
              type === "opponent" ? Number(player.w || 0) : 0,
            h2h_losses:
              type === "opponent" ? Number(player.l || 0) : 0,
            last_played:
              type === "opponent" && player.last && player.last !== "—"
                ? player.last
                : null,
          },
          {
            onConflict: "user_id,target_player_id,type",
          },
        );

      if (error) throw error;

      await fetchData();

    } catch (error) {
      console.error(`Failed to save ${type}:`, error);
      alert(error?.message || `Failed to save ${type}.`);
    }
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

  async function cancelPartnerRequest(player) {
    const confirmed = window.confirm(
      `Cancel your partner request to ${player.name}?`,
    );

    if (!confirmed) return;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    if (!player.userId) {
      alert("This player is not linked to a registered account.");
      return;
    }

    try {
      const { data: cancelledRequest, error: cancelError } = await supabase
        .from("player_partner_requests")
        .update({
          status: "cancelled",
          responded_at: new Date().toISOString(),
        })
        .eq("requester_user_id", user.id)
        .eq("recipient_user_id", player.userId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (cancelError) throw cancelError;

      if (!cancelledRequest) {
        throw new Error(
          "No pending partner request was found. Refresh the page and try again.",
        );
      }

      // Remove the related notification when the notification row stores
      // the partner-request ID in source_id. Cancellation still succeeds
      // even when notification cleanup is blocked by an RLS policy.
      const { error: notificationError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", player.userId)
        .eq("type", "partner_request_received")
        .eq("source_id", cancelledRequest.id);

      if (notificationError) {
        console.warn(
          "Partner request cancelled, but notification cleanup was blocked:",
          notificationError,
        );
      }

      setPlayers((current) =>
        current.map((item) =>
          item.id === player.id
            ? { ...item, partnerRequestStatus: null }
            : item,
        ),
      );

      setSelected((current) =>
        current?.id === player.id
          ? { ...current, partnerRequestStatus: null }
          : current,
      );

      await fetchData();
      alert("Partner request cancelled.");
    } catch (error) {
      console.error("Failed to cancel partner request:", error);
      alert(error.message || "Failed to cancel partner request.");
    }
  }

  async function removeConnection(player, type) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    if (!player?.id) {
      alert("This player could not be identified.");
      return;
    }

    try {
      const { error } = await supabase
        .from("player_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("target_player_id", player.id)
        .eq("type", type);

      if (error) throw error;

      await fetchData();

    } catch (error) {
      console.error(`Failed to remove ${type}:`, error);
      alert(error?.message || `Failed to remove ${type}.`);
    }
  }

  async function requestCoach(coach, message) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (coach.userId === user.id) {
      alert("You cannot request yourself as a coach.");
      return;
    }

    /*
     * A player profile is required. A dual-role account can
     * request another coach because it has both profile rows.
     */
    const {
      data: ownPlayerProfile,
      error: playerProfileError,
    } = await supabase
      .from("player_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (playerProfileError) {
      console.error(
        "Failed to verify player profile:",
        playerProfileError,
      );
      alert(
        playerProfileError.message ||
          "Unable to verify your player profile.",
      );
      return;
    }

    if (!ownPlayerProfile) {
      alert(
        "A player profile is required before requesting a coach.",
      );
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
        requested_by: "player",
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

  async function respondToIncomingCoachRequest(
    coach,
    nextStatus,
  ) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    const { error } = await supabase
      .from("coach_player_relationships")
      .update({
        status: nextStatus,
        responded_at: new Date().toISOString(),
      })
      .eq("player_user_id", user.id)
      .eq("coach_user_id", coach.userId)
      .eq("status", "pending")
      .eq("requested_by", "coach");

    if (error) {
      console.error(
        "Failed to respond to coach request:",
        error,
      );
      alert(
        error.message ||
          "Failed to respond to the coach request.",
      );
      return;
    }

    await fetchData();

    alert(
      nextStatus === "accepted"
        ? `${coach.name} is now your coach.`
        : `You declined ${coach.name}'s request.`,
    );
  }

  async function acceptIncomingCoachRequest(coach) {
    await respondToIncomingCoachRequest(
      coach,
      "accepted",
    );
  }

  async function declineIncomingCoachRequest(coach) {
    await respondToIncomingCoachRequest(
      coach,
      "rejected",
    );
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

  async function requestCoachClub(coach) {
    const club = coach.clubMatch;

    if (!club) {
      alert("This coach is not linked to a registered club.");
      return;
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    const { error } = await supabase
      .from("club_members")
      .upsert(
        {
          club_id: club.id,
          user_id: user.id,
          status: "pending",
          member_role: "player",
          requested_at: new Date().toISOString(),
          responded_at: null,
        },
        { onConflict: "club_id,user_id" },
      );

    if (error) {
      console.error("Failed to request club membership:", error);
      alert(error.message || "Failed to send club request.");
      return;
    }

    await fetchData();
    alert("Club join request sent.");
  }

  async function cancelCoachClubRequest(coach) {
    const club = coach.clubMatch;
    if (!club) return;

    if (!window.confirm(`Cancel your request to join ${club.name}?`)) {
      return;
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    const { error } = await supabase
      .from("club_members")
      .update({
        status: "cancelled",
        responded_at: new Date().toISOString(),
      })
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (error) {
      console.error("Failed to cancel club request:", error);
      alert(error.message || "Failed to cancel club request.");
      return;
    }

    await fetchData();
  }

  const stopQrScanner = useCallback(async () => {
    if (scanCloseTimerRef.current) {
      window.clearTimeout(scanCloseTimerRef.current);
      scanCloseTimerRef.current = null;
    }

    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (error) {
        console.warn("Unable to stop QR scanner:", error);
      }

      try {
        await scanner.clear();
      } catch (error) {
        console.warn("Unable to clear QR scanner:", error);
      }
    }

    setCameraActive(false);
    setScannerStarting(false);
  }, []);

  const closeScanner = useCallback(async () => {
    await stopQrScanner();
    setShowScanner(false);
    setScanSuccess(false);
    setScanError("");
  }, [stopQrScanner]);

  const processScannedValue = useCallback(
    async (decodedText) => {
      if (scanSuccess) return;

      const rawValue = String(decodedText || "").trim();
      let scannedUserId = "";

      if (rawValue.startsWith("SHUTTLETRACK_PLAYER:")) {
        scannedUserId = rawValue
          .slice("SHUTTLETRACK_PLAYER:".length)
          .trim();
      } else {
        try {
          const scannedUrl = new URL(rawValue);
          const parts = scannedUrl.pathname.split("/").filter(Boolean);
          const playerMarkerIndex = parts.findIndex(
            (part) => part === "player" || part === "p" || part === "scan",
          );

          scannedUserId =
            playerMarkerIndex >= 0
              ? parts[parts.length - 1] || ""
              : "";
        } catch {
          scannedUserId = "";
        }
      }

      if (!scannedUserId) {
        setScanError("This is not a valid ShuttleTrack player QR code.");
        return;
      }

      if (currentUserId && scannedUserId === currentUserId) {
        setScanError("This is your own QR code. Scan another player's QR.");
        return;
      }

      const scannedPlayer = players.find(
        (player) =>
          String(player.userId || "") === scannedUserId ||
          String(player.id || "") === scannedUserId,
      );

      if (!scannedPlayer) {
        setScanError(
          "Player profile not found. The profile may be private or unavailable.",
        );
        return;
      }

      setScanError("");
      setScanSuccess(true);
      setTab("all");
      setSelected(scannedPlayer);
      setSelectedCoach(null);

      if (qrScannerRef.current?.isScanning) {
        try {
          await qrScannerRef.current.pause(true);
        } catch (error) {
          console.warn("Unable to pause scanner after success:", error);
        }
      }

      scanCloseTimerRef.current = window.setTimeout(async () => {
        await closeScanner();
      }, 900);
    },
    [closeScanner, currentUserId, players, scanSuccess],
  );

  const startQrScanner = useCallback(async () => {
    if (scannerStarting || cameraActive || scanSuccess) return;

    setScanError("");

    try {
      await stopQrScanner();
      setScannerStarting(true);

      const readerElement = document.getElementById("player-qr-reader");

      if (!readerElement) {
        throw new Error("Scanner area is not ready. Please reopen the scanner.");
      }

      const scanner = new Html5Qrcode("player-qr-reader", {
        verbose: false,
      });
      qrScannerRef.current = scanner;

      let cameraConfig = { facingMode: "environment" };

      try {
        const cameras = await Html5Qrcode.getCameras();

        if (cameras.length > 0) {
          const backCamera = cameras.find((camera) =>
            /back|rear|environment/i.test(camera.label || ""),
          );
          cameraConfig = backCamera?.id || cameras[0].id;
        }
      } catch (cameraListError) {
        console.warn("Unable to list cameras, using default camera:", cameraListError);
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(
              Math.min(viewfinderWidth, viewfinderHeight) * 0.72,
            );
            return { width: size, height: size };
          },
          aspectRatio: 1,
        },
        processScannedValue,
        () => {
          // Normal scan misses happen many times per second. Ignore them.
        },
      );

      setCameraActive(true);
    } catch (error) {
      console.error("Failed to start QR scanner:", error);
      setScanError(
        error?.message ||
          "Camera could not start. Allow camera permission and try again.",
      );
      await stopQrScanner();
    } finally {
      setScannerStarting(false);
    }
  }, [
    cameraActive,
    processScannedValue,
    scanSuccess,
    scannerStarting,
    stopQrScanner,
  ]);

  useEffect(() => {
    if (!showScanner) return undefined;

    const timer = window.setTimeout(() => {
      startQrScanner();
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showScanner, startQrScanner]);

  useEffect(() => {
    return () => {
      if (scanCloseTimerRef.current) {
        window.clearTimeout(scanCloseTimerRef.current);
      }

      const scanner = qrScannerRef.current;
      qrScannerRef.current = null;

      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

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

        <NotificationBell
          supabase={supabase}
          title="Notifications"
          mode="players"
          includePartnerRequests
          onPartnerChanged={fetchData}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          className={styles.tabs}
          style={{
            marginBottom: 0,
            width: "fit-content",
            flex: "0 1 auto",
            minWidth: 0,
          }}
        >
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
            className={`${styles.tab} ${tab === "fav" ? styles.tabActive : ""}`}
            onClick={() => switchTab("fav")}
          >
            My favourites
          </button>

          <button
            className={`${styles.tab} ${tab === "coach" ? styles.tabActive : ""}`}
            onClick={() => switchTab("coach")}
          >
            Find coach
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setShowMyQr(true)}
            style={{ whiteSpace: "nowrap" }}
          >
            My QR
          </button>

          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => {
              setScanError("");
              setScanSuccess(false);
              setShowScanner(true);
            }}
            style={{ whiteSpace: "nowrap" }}
          >
            Scan Player
          </button>
        </div>
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
                  {tab === "fav"
                    ? "You have not added any favourite players yet."
                    : "No players match your search."}
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
                        {player.isFavourite && (
                          <span className={styles.badgeBlue}>Favourite</span>
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
                key={`${selected.id}-${selected.isOpp}-${selected.isPartner}-${selected.isFavourite}`}
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
                onCancelPartnerRequest={cancelPartnerRequest}
                onRemovePartner={(player) =>
                  removeConnection(player, "partner")
                }
                onAddFavourite={(player) =>
                  addConnection(player, "favourite")
                }
                onRemoveFavourite={(player) =>
                  removeConnection(player, "favourite")
                }
                onReport={openPlayerReport}
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
                    <button
                      className={styles.btnOutline}
                      onClick={() => cancelPartnerRequest(player)}
                      style={{
                        color: "#DC2626",
                        borderColor: "#FECACA",
                        background: "#FEF2F2",
                      }}
                    >
                      Cancel
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
                    {coach.avatarUrl ? (
                      <img
                        src={coach.avatarUrl}
                        alt={`${coach.name} profile`}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div className={styles.av}>{coach.init}</div>
                    )}

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
                      </div>
                    </div>

                    {coach.requestStatus === "accepted" ? (
                      <span className={styles.badgeGreen}>My coach</span>
                    ) : coach.requestStatus === "pending" ? (
                      <span className={styles.badgeAmber}>Request pending</span>
                    ) : coach.isAccepting ? (
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
                onAcceptIncoming={acceptIncomingCoachRequest}
                onDeclineIncoming={declineIncomingCoachRequest}
                onReport={openCoachReport}
                onRequestClub={requestCoachClub}
                onCancelClubRequest={cancelCoachClubRequest}
              />
            )}
          </div>
        </div>
      )}

      {showMyQr && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowMyQr(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3200,
            background: "rgba(13, 27, 62, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(420px, 100%)",
              background: C.card,
              borderRadius: 20,
              padding: 24,
              textAlign: "center",
              boxShadow: "0 24px 60px rgba(13,27,62,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 18,
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                  My Player QR
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>
                  Let another ShuttleTrack player or coach scan this code.
                </div>
              </div>

              <button
                type="button"
                aria-label="Close QR"
                onClick={() => setShowMyQr(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: `1px solid ${C.line}`,
                  background: C.card,
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {!currentUserId ? (
              <div style={{ padding: 30, color: C.muted }}>
                Loading your QR code...
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "inline-block",
                    padding: 14,
                    background: "#FFFFFF",
                    border: `1px solid ${C.line}`,
                    borderRadius: 16,
                  }}
                >
                  <QRCodeCanvas
                    value={`SHUTTLETRACK_PLAYER:${currentUserId}`}
                    size={240}
                    level="H"
                    includeMargin
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: C.muted,
                  }}
                >
                  This QR contains only your ShuttleTrack player identifier, not
                  your password or private account information.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showScanner && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeScanner();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3200,
            background: "rgba(13, 27, 62, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              background: C.card,
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 24px 60px rgba(13,27,62,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                  Scan Player
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>
                  Point the camera at another ShuttleTrack player&apos;s QR code.
                </div>
              </div>

              <button
                type="button"
                aria-label="Close scanner"
                onClick={closeScanner}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: `1px solid ${C.line}`,
                  background: C.card,
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 18,
                border: scanSuccess
                  ? "4px solid #16A34A"
                  : scanError
                    ? "3px solid #EF4444"
                    : "3px solid #D9E2F2",
                background: scanSuccess ? "#F0FDF4" : "#0F172A",
                minHeight: 300,
                transition: "border-color 0.2s ease, background 0.2s ease",
                boxShadow: scanSuccess
                  ? "0 0 0 6px rgba(22,163,74,0.13)"
                  : "none",
              }}
            >
              <div
                id="player-qr-reader"
                style={{
                  width: "100%",
                  minHeight: 300,
                  background: "#0F172A",
                }}
              />

              {!cameraActive && !scannerStarting && !scanSuccess && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: 24,
                    textAlign: "center",
                    background: "linear-gradient(180deg,#172554,#0F172A)",
                    color: "#FFFFFF",
                  }}
                >
                  <div style={{ fontSize: 38 }}>📷</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
                    Camera did not start automatically. Press the button below
                    and allow camera permission.
                  </div>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={startQrScanner}
                  >
                    Start camera
                  </button>
                </div>
              )}

              {scannerStarting && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(15,23,42,0.8)",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Starting camera...
                </div>
              )}

              {scanSuccess && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    background: "rgba(240,253,244,0.94)",
                    color: "#166534",
                    fontWeight: 900,
                  }}
                >
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#16A34A",
                      color: "#FFFFFF",
                      fontSize: 38,
                    }}
                  >
                    ✓
                  </div>
                  Player found
                </div>
              )}
            </div>

            {scanError && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 11,
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#B91C1C",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {scanError}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 11,
                background: C.soft,
                color: C.muted,
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              Camera access works on localhost and normally requires HTTPS after
              deployment. Chrome must also have camera permission enabled.
            </div>
          </div>
        </div>
      )}

      <ReportModal
        target={reportTarget}
        submitting={submittingReport}
        onClose={() => {
          if (!submittingReport) {
            setReportTarget(null);
          }
        }}
        onSubmit={submitReport}
      />
    </div>
  );
}