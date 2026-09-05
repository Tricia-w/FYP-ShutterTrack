import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

const SKILLS = [
  { key: "smash", label: "Smash" },
  { key: "defense", label: "Defense" },
  { key: "footwork", label: "Footwork" },
  { key: "drop_shot", label: "Drop shot" },
  { key: "net_play", label: "Net play" },
  { key: "serve", label: "Serve" },
];

const clampScore = value =>
  Math.max(1, Math.min(100, Number(value ?? 50)));

function SkillAssessmentRow({
  label,
  playerValue,
  verifierValue,
  onChange,
  disabled = false,
}) {
  const playerScore = clampScore(playerValue);
  const reviewScore = clampScore(verifierValue);
  const difference = reviewScore - playerScore;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px minmax(0,1fr) 48px 54px",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${C.line}`,
        background: C.card,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.text,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <input
        type="range"
        min="1"
        max="100"
        value={reviewScore}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
        style={{
          width: "100%",
          accentColor: "#7C3AED",
          cursor: disabled ? "not-allowed" : "pointer",
          margin: 0,
        }}
      />

      <div
        style={{
          textAlign: "center",
          fontSize: 10,
          fontWeight: 700,
          color: "#1A5FFF",
          background: "#EEF4FF",
          borderRadius: 999,
          padding: "4px 5px",
          whiteSpace: "nowrap",
        }}
      >
        {playerScore}
      </div>

      <div
        style={{
          height: 30,
          borderRadius: 8,
          border: "1px solid #DDD6FE",
          background: "#F5F3FF",
          color: "#7C3AED",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
        }}
        title={
          difference === 0
            ? "Same as player rating"
            : `Difference: ${difference > 0 ? "+" : ""}${difference}`
        }
      >
        {reviewScore}
      </div>
    </div>
  );
}

export default function VerifySkill() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const showLoader = useLoadingDelay(loading, 350);

  const [request, setRequest] = useState(null);
  const [playerName, setPlayerName] = useState("Player");

  const [currentUserId, setCurrentUserId] = useState("");
  const [verifierRole, setVerifierRole] = useState("player");

  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [existingVerification, setExistingVerification] = useState(null);
  const [verifiedSuccessfully, setVerifiedSuccessfully] = useState(false);

  const [ratings, setRatings] = useState({
    smash: 50,
    defense: 50,
    footwork: 50,
    drop_shot: 50,
    net_play: 50,
    serve: 50,
  });
  const [feedback, setFeedback] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isOwner = useMemo(() => {
    return Boolean(
      currentUserId &&
      request?.player_user_id &&
      String(currentUserId) === String(request.player_user_id)
    );
  }, [currentUserId, request?.player_user_id]);

  const loadVerificationRequest = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!token) {
        throw new Error("Verification token is missing.");
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "Please log in to ShuttleTrack before reviewing this assessment."
        );
      }

      setCurrentUserId(user.id);

      const {
        data: requestRow,
        error: requestError,
      } = await supabase
        .from("skill_verification_requests")
        .select("*")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (requestError) {
        throw requestError;
      }

      if (!requestRow) {
        throw new Error(
          "This verification request is invalid, expired, or has been replaced by a newer assessment."
        );
      }

      setRequest(requestRow);

      const initialRatings = {};
      SKILLS.forEach(skill => {
        initialRatings[skill.key] = clampScore(requestRow[skill.key]);
      });
      setRatings(initialRatings);

      if (requestRow.player_profile_id) {
        const {
          data: profileRow,
          error: profileError,
        } = await supabase
          .from("player_profiles")
          .select("display_name")
          .eq("id", requestRow.player_profile_id)
          .maybeSingle();

        if (profileError) {
          console.warn(
            "Could not load player name for skill verification:",
            profileError
          );
        }

        if (profileRow?.display_name) {
          setPlayerName(profileRow.display_name);
        }
      }

      const {
        data: coachProfile,
        error: coachError,
      } = await supabase
        .from("coach_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (coachError) {
        console.warn(
          "Could not determine coach role for verification:",
          coachError
        );
      }

      setVerifierRole(coachProfile ? "coach" : "player");

      const {
        data: existingRow,
        error: existingError,
      } = await supabase
        .from("skill_verifications")
        .select(
          "id, verifier_role, verified_at, smash, defense, footwork, drop_shot, net_play, serve, feedback"
        )
        .eq("request_id", requestRow.id)
        .eq("verifier_user_id", user.id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRow) {
        setAlreadyVerified(true);
        setExistingVerification(existingRow);

        const savedRatings = {};
        SKILLS.forEach(skill => {
          savedRatings[skill.key] = clampScore(
            existingRow[skill.key] ?? requestRow[skill.key]
          );
        });
        setRatings(savedRatings);
        setFeedback(existingRow.feedback || "");
      } else {
        setAlreadyVerified(false);
        setExistingVerification(null);
      }
    } catch (loadError) {
      console.error("Verify skill load error:", loadError);
      setError(
        loadError?.message ||
          "Unable to load this skill verification request."
      );
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadVerificationRequest();
  }, [loadVerificationRequest]);

  const updateRating = (key, value) => {
    setRatings(prev => ({
      ...prev,
      [key]: clampScore(value),
    }));
  };

  const handleBackToSystem = () => {
    if (verifierRole === "coach") {
      navigate("/coach");
      return;
    }

    navigate("/performance");
  };

  const handleVerify = async () => {
    if (!request?.id || !currentUserId) {
      return;
    }

    if (isOwner) {
      setError("You cannot review your own skill assessment.");
      return;
    }

    if (alreadyVerified) {
      setError("You have already submitted your assessment for this request.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const {
        data: freshRequest,
        error: freshRequestError,
      } = await supabase
        .from("skill_verification_requests")
        .select("id, is_active, player_user_id")
        .eq("id", request.id)
        .maybeSingle();

      if (freshRequestError) {
        throw freshRequestError;
      }

      if (!freshRequest?.is_active) {
        throw new Error(
          "This assessment is no longer active. The player may have updated their skill ratings."
        );
      }

      if (
        String(freshRequest.player_user_id) ===
        String(currentUserId)
      ) {
        throw new Error("You cannot review your own skill assessment.");
      }

      const payload = {
        request_id: request.id,
        verifier_user_id: currentUserId,
        verifier_role: verifierRole,
        smash: clampScore(ratings.smash),
        defense: clampScore(ratings.defense),
        footwork: clampScore(ratings.footwork),
        drop_shot: clampScore(ratings.drop_shot),
        net_play: clampScore(ratings.net_play),
        serve: clampScore(ratings.serve),
        feedback: feedback.trim() || null,
        verified_at: new Date().toISOString(),
      };

      const {
        data: insertedRow,
        error: insertError,
      } = await supabase
        .from("skill_verifications")
        .insert(payload)
        .select(
          "id, verifier_role, verified_at, smash, defense, footwork, drop_shot, net_play, serve, feedback"
        )
        .single();

      if (insertError) {
        if (
          insertError.code === "23505" ||
          String(insertError.message || "")
            .toLowerCase()
            .includes("duplicate")
        ) {
          setAlreadyVerified(true);
          throw new Error(
            "You have already submitted an assessment for this request."
          );
        }

        throw insertError;
      }

      setExistingVerification(insertedRow);
      setAlreadyVerified(true);
      setVerifiedSuccessfully(true);
    } catch (verifyError) {
      console.error("Verify skill submit error:", verifyError);
      setError(
        verifyError?.message ||
          "Failed to submit your skill assessment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !showLoader) {
    return null;
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading skill assessment..." />
      </div>
    );
  }

  if (!request) {
    return (
      <div
        style={{
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          className={styles.card}
          style={{
            width: "min(560px, 100%)",
            textAlign: "center",
            padding: 28,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#FEF2F2",
              color: "#DC2626",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            !
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.text,
            }}
          >
            Assessment unavailable
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: 1.6,
              color: C.muted,
            }}
          >
            {error ||
              "This skill assessment request could not be loaded."}
          </div>

          <button
            className={styles.btnPrimary}
            style={{ marginTop: 18 }}
            onClick={handleBackToSystem}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.playerReadablePage}>
      <div className={styles.pageHead}>
        <div className={styles.pageTitle}>Verify Skill Assessment</div>
        <div className={styles.pageSub}>
          Give your own rating for each skill and submit it as verification
        </div>
      </div>

      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
        }}
      >
        <div className={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 12,
              borderBottom: `1px solid ${C.line}`,
              marginBottom: 12,
            }}
          >
            <div
              className={styles.av}
              style={{
                width: 48,
                height: 48,
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              {String(playerName || "P")
                .split(/\s+/)
                .filter(Boolean)
                .map(word => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.text,
                }}
              >
                {playerName}&apos;s Assessment
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: C.muted,
                }}
              >
                You are reviewing this as a{" "}
                <strong style={{ color: C.text }}>
                  {verifierRole === "coach" ? "coach" : "player"}
                </strong>
                .
              </div>
            </div>

            <span
              className={
                alreadyVerified
                  ? styles.badgeGreen
                  : styles.badgeBlue
              }
            >
              {alreadyVerified ? "Submitted" : "Pending"}
            </span>
          </div>

          {isOwner ? (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#FFF7ED",
                border: "1px solid #FED7AA",
                color: "#9A3412",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              This is your own skill assessment, so you cannot review it
              yourself. Share the verification link with another ShuttleTrack
              player or coach.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  background:
                    "color-mix(in srgb, #7C3AED 7%, var(--card, #FFFFFF))",
                  border:
                    "1px solid color-mix(in srgb, #7C3AED 16%, var(--line, #EEF1F8))",
                  color: C.muted,
                  fontSize: 11,
                  lineHeight: 1.6,
                  marginBottom: 12,
                }}
              >
                Blue shows the player&apos;s score. Drag each slider to give your own 1–100 rating. Your rating is stored separately.
              </div>

              <div className={styles.formLabel}>Your skill assessment</div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}
              >
                {SKILLS.map(skill => (
                  <SkillAssessmentRow
                    key={skill.key}
                    label={skill.label}
                    playerValue={request[skill.key]}
                    verifierValue={ratings[skill.key]}
                    disabled={alreadyVerified || submitting}
                    onChange={value => updateRating(skill.key, value)}
                  />
                ))}
              </div>

              <div
                className={styles.formRow}
                style={{ marginTop: 12 }}
              >
                <label className={styles.formLabel}>
                  Feedback <span style={{ color: C.muted }}>(optional)</span>
                </label>

                <textarea
                  className={styles.formTextarea}
                  value={feedback}
                  disabled={alreadyVerified || submitting}
                  placeholder="e.g. Strong smash power, but footwork and recovery positioning still need improvement."
                  onChange={event => setFeedback(event.target.value)}
                  style={{
                    minHeight: 64,
                    resize: "vertical",
                  }}
                />

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 10,
                    color: C.muted,
                    lineHeight: 1.45,
                  }}
                >
                  Give a short explanation if your ratings differ from the
                  player&apos;s self-assessment.
                </div>
              </div>
            </>
          )}

          {verifiedSuccessfully && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 12,
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                color: "#166534",
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              ✓ Your skill assessment was submitted successfully.
            </div>
          )}

          {!verifiedSuccessfully && alreadyVerified && !isOwner && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 12,
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                color: "#166534",
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              ✓ You already submitted your assessment for this player.
              {existingVerification?.verified_at
                ? ` Submitted on ${new Date(
                    existingVerification.verified_at
                  ).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}.`
                : ""}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#B91C1C",
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <button
              type="button"
              className={styles.btnOutline}
              onClick={handleBackToSystem}
              disabled={submitting}
            >
              Back
            </button>

            {!isOwner && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleVerify}
                disabled={
                  submitting ||
                  alreadyVerified
                }
                style={{
                  opacity:
                    submitting ||
                    alreadyVerified
                      ? 0.55
                      : 1,
                  cursor:
                    submitting ||
                    alreadyVerified
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submitting
                  ? "Submitting..."
                  : alreadyVerified
                    ? "Assessment submitted"
                    : "Submit assessment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
