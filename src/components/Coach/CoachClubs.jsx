import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
//import { useNavigate } from "react-router-dom";
import CoachNotificationBell from "../Notifications/CoachNotificationBell";
import { supabase } from "../../lib/supabase";
import styles from "../Layout/Pages.module.css";
import Loader from "../Loader/Loader";
import useLoadingDelay from "../Loader/LoadingDelay";



// Local development continues to run on localhost.
// Only links that are copied/shared with other people use the public Vercel app.
const PUBLIC_APP_URL = "https://fyp-shutter-track.vercel.app";

const C = {
  text: "var(--text, #0D1B3E)",
  muted: "var(--text-muted, #8892A4)",
  card: "var(--card, #FFFFFF)",
  soft: "var(--soft, #F6F8FF)",
  line: "var(--line, #EEF1F8)",
};

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

function calculateExperienceYears(
  dateOfBirth,
  startedPlayingAge,
  fallback = 0,
) {
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



function getVenueMapEmbedUrl(venue, club) {
  const address = String(venue?.address || "").trim();

  if (!address) return "";

  const locationText = [
    address,
    club?.location,
    club?.state,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps?q=${encodeURIComponent(
    locationText,
  )}&output=embed`;
}

function getVenueGoogleMapsUrl(venue, club) {
  const savedUrl = String(venue?.mapUrl || "").trim();

  if (savedUrl) return savedUrl;

  const locationText = [
    venue?.address,
    club?.location,
    club?.state,
  ]
    .filter(Boolean)
    .join(", ");

  if (!locationText) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    locationText,
  )}`;
}

function createEmptyVenue(isPrimary = false) {
  return {
    id: null,
    venueName: "",
    address: "",
    mapUrl: "",
    trainingDetails: "",
    isPrimary,
  };
}

function SmallInfo({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
        {value || "—"}
      </div>
    </div>
  );
}

function getClubRoleLabel(member) {
  if (!member) return "Club member";

  if (member.isOwner) {
    return member.isClubCoach
      ? "Club owner · Club coach"
      : "Club owner";
  }

  if (member.memberRole === "manager") {
    return member.isClubCoach
      ? "Club manager · Club coach"
      : "Club manager";
  }

  if (member.isClubCoach) {
    return "Club coach";
  }

  return "Club member";
}

function StatusBadge({ status, requestType }) {
  if (status === "accepted") {
    return <span className={styles.badgeGreen}>Joined</span>;
  }

  if (status === "pending" && requestType === "invite") {
    return <span className={styles.badgeBlue}>Club invitation</span>;
  }

  if (status === "pending") {
    return <span className={styles.badgeAmber}>Request pending</span>;
  }

  if (status === "rejected") {
    return (
      <span
        style={{
          display: "inline-flex",
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

function CreateClubForm({ submitting, onCreate }) {
  const [form, setForm] = useState({
    shortName: "",
    name: "",
    state: "",
    location: "",
    locations: [createEmptyVenue(true)],
    description: "",
    relatedUrl: "",
    logoFile: null,
  });
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVenue(index, field, value) {
    setForm((current) => ({
      ...current,
      locations: current.locations.map((venue, venueIndex) =>
        venueIndex === index
          ? { ...venue, [field]: value }
          : venue,
      ),
    }));
  }

  function addVenue() {
    setForm((current) => ({
      ...current,
      locations: [
        ...current.locations,
        createEmptyVenue(false),
      ],
    }));
  }

  function setPrimaryVenue(index) {
    setForm((current) => {
      const selectedVenue = current.locations[index];

      if (!selectedVenue || index === 0) {
        return current;
      }

      const otherVenues = current.locations.filter(
        (_, venueIndex) => venueIndex !== index,
      );

      return {
        ...current,
        locations: [
          {
            ...selectedVenue,
            isPrimary: true,
          },
          ...otherVenues.map((venue) => ({
            ...venue,
            isPrimary: false,
          })),
        ],
      };
    });
  }

  function removeVenue(index) {
    setForm((current) => {
      const nextLocations = current.locations.filter(
        (_, venueIndex) => venueIndex !== index,
      );

      return {
        ...current,
        locations:
          nextLocations.length > 0
            ? nextLocations.map((venue, venueIndex) => ({
                ...venue,
                isPrimary: venueIndex === 0,
              }))
            : [createEmptyVenue(true)],
      };
    });
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      updateField("logoFile", null);
      setLogoPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Club logo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (logoPreview) URL.revokeObjectURL(logoPreview);

    updateField("logoFile", file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.shortName.trim()) {
      alert("Please enter the club short name.");
      return;
    }

    if (!form.name.trim()) {
      alert("Please enter the full club name.");
      return;
    }

    if (!form.state.trim()) {
      alert("Please select the state.");
      return;
    }

    if (!form.location.trim()) {
      alert("Please enter the club's main area.");
      return;
    }

    const incompleteVenue = form.locations.find((venue) => {
      const hasAnyValue =
        venue.venueName.trim() ||
        venue.address.trim() ||
        venue.mapUrl.trim() ||
        venue.trainingDetails.trim();

      return (
        hasAnyValue &&
        (!venue.venueName.trim() || !venue.address.trim())
      );
    });

    if (incompleteVenue) {
      alert(
        "Each added venue needs both a venue name and an exact address.",
      );
      return;
    }

    await onCreate(form);
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.cardTitle}>Create a badminton club</div>

      <label style={labelStyle}>Club logo</label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <label
          htmlFor="club-logo-upload"
          title="Upload club logo"
          style={{
            position: "relative",
            width: 84,
            height: 84,
            borderRadius: "50%",
            border: "3px solid #1A5FFF",
            background: C.soft,
            overflow: "visible",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: submitting ? "wait" : "pointer",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(26,95,255,0.16)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#EAF0FF",
              color: "#1A5FFF",
              fontSize: form.shortName.length > 4 ? 14 : 22,
              fontWeight: 900,
              padding: 6,
            }}
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Club logo preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              form.shortName || "C"
            )}
          </div>

          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: -3,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#1A5FFF",
              border: "3px solid #FFFFFF",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 3px 8px rgba(13,27,62,0.22)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8.5 6.5 10 4h4l1.5 2.5H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h2.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="12.5"
                r="3.2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </span>
        </label>

        <input
          id="club-logo-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoChange}
          disabled={submitting}
          style={{ display: "none" }}
        />

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.text,
              marginBottom: 4,
            }}
          >
            Upload club logo
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            Click the photo or camera icon.
            <br />
            PNG, JPG or WebP · Maximum 5 MB
          </div>

          {logoPreview && (
            <button
              type="button"
              onClick={() => {
                updateField("logoFile", null);
                setLogoPreview("");
                const input = document.getElementById("club-logo-upload");
                if (input) input.value = "";
              }}
              disabled={submitting}
              style={{
                marginTop: 7,
                border: "none",
                background: "transparent",
                color: "#DC2626",
                fontSize: 11,
                fontWeight: 700,
                padding: 0,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              Remove logo
            </button>
          )}
        </div>
      </div>

      <div style={twoColumnStyle}>
        <div>
          <label style={labelStyle}>Club short name *</label>
          <input
            className={styles.formInput}
            value={form.shortName}
            onChange={(event) =>
              updateField(
                "shortName",
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 10),
              )
            }
            placeholder="Example: KBA"
            maxLength={10}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Full club name *</label>
          <input
            className={styles.formInput}
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Example: Kuan Badminton Club"
            maxLength={100}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={twoColumnStyle}>
        <div>
          <label style={labelStyle}>State *</label>
          <select
            className={styles.formSelect}
            value={form.state}
            onChange={(event) => updateField("state", event.target.value)}
            style={inputStyle}
          >
            <option value="">Select state</option>
            <option>Johor</option>
            <option>Kedah</option>
            <option>Kelantan</option>
            <option>Kuala Lumpur</option>
            <option>Melaka</option>
            <option>Negeri Sembilan</option>
            <option>Pahang</option>
            <option>Penang</option>
            <option>Perak</option>
            <option>Perlis</option>
            <option>Sabah</option>
            <option>Sarawak</option>
            <option>Selangor</option>
            <option>Terengganu</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Main area *</label>
          <input
            className={styles.formInput}
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="Example: George Town"
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 4,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          Training venues optional
        </label>

        <button
          type="button"
          className={styles.btnOutline}
          onClick={addVenue}
          disabled={submitting}
          style={{ padding: "7px 11px", fontSize: 11 }}
        >
          + Add venue
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {form.locations.map((venue, index) => (
          <div
            key={index}
            style={{
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${C.line}`,
              background: C.soft,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: C.text,
                  }}
                >
                  Venue {index + 1}
                </div>

                {index === 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: C.muted,
                    }}
                  >
                    This venue appears first on the club profile.
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 7,
                  flexWrap: "wrap",
                }}
              >
                {index === 0 ? (
                  <span className={styles.badgeBlue}>
                    Primary
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPrimaryVenue(index)}
                    disabled={submitting}
                    className={styles.btnOutline}
                    style={{
                      padding: "5px 9px",
                      fontSize: 11,
                    }}
                  >
                    Set as primary
                  </button>
                )}

                {form.locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVenue(index)}
                    disabled={submitting}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: submitting ? "wait" : "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <input
              className={styles.formInput}
              value={venue.venueName}
              onChange={(event) =>
                updateVenue(index, "venueName", event.target.value)
              }
              placeholder="Venue name, example: KamFook Badminton Court"
              style={inputStyle}
            />

            <input
              className={styles.formInput}
              value={venue.address}
              onChange={(event) =>
                updateVenue(index, "address", event.target.value)
              }
              placeholder="Exact address used to display the map"
              style={inputStyle}
            />

            <input
              className={styles.formInput}
              type="url"
              value={venue.mapUrl}
              onChange={(event) =>
                updateVenue(index, "mapUrl", event.target.value)
              }
              placeholder="Google Maps share link optional"
              style={inputStyle}
            />

            <textarea
              className={styles.formInput}
              rows={2}
              value={venue.trainingDetails}
              onChange={(event) =>
                updateVenue(
                  index,
                  "trainingDetails",
                  event.target.value,
                )
              }
              placeholder="Training details optional, example: Sunday 2 PM–4 PM"
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            {venue.address.trim() && (
              <iframe
                title={`Venue ${index + 1} map preview`}
                src={getVenueMapEmbedUrl(venue, form)}
                width="100%"
                height="190"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{
                  display: "block",
                  border: 0,
                  borderRadius: 12,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <label style={labelStyle}>Related link optional</label>
      <input
        className={styles.formInput}
        type="url"
        value={form.relatedUrl}
        onChange={(event) =>
          updateField("relatedUrl", event.target.value)
        }
        placeholder="Google Form, Instagram, Facebook or website URL"
        style={inputStyle}
      />

      <label style={labelStyle}>Description</label>
      <textarea
        className={styles.formInput}
        rows={5}
        value={form.description}
        onChange={(event) => updateField("description", event.target.value)}
        placeholder="Tell players what the club is about and who can join."
        maxLength={1000}
        style={{
          ...inputStyle,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      <button
        type="submit"
        className={styles.btnPrimary}
        disabled={submitting}
        style={{ width: "100%", opacity: submitting ? 0.65 : 1 }}
      >
        {submitting ? "Creating club..." : "Create club"}
      </button>
    </form>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  marginBottom: 14,
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

function ClubDetail({
  club,
  actionId,
  acceptedClub,
  readOnly = false,
  onJoin,
  onCancel,
  onLeave,
  onAcceptInvite,
  onDeclineInvite,
  onAcceptInviteLink,
  onViewMember,
}) {
  const busy = actionId === club.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={styles.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 18,
          }}
        >
          {club.logoUrl ? (
            <img
              src={club.logoUrl}
              alt={`${club.name} logo`}
              style={{
                width: 58,
                height: 58,
                borderRadius: 15,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              className={styles.av}
              style={{ width: 58, height: 58, fontSize: 19 }}
            >
              {club.init}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
              {club.shortName
                ? `${club.shortName} · ${club.name}`
                : club.name}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              {club.location} · {club.state}
            </div>

            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <span className={styles.badgeBlue}>
                {club.memberCount} member{club.memberCount === 1 ? "" : "s"}
              </span>

              {club.acceptingMembers ? (
                <span className={styles.badgeGreen}>Accepting members</span>
              ) : (
                <span className={styles.badgeGray}>Membership closed</span>
              )}

              {club.isOwner && (
                <span className={styles.badgeAmber}>Club owner</span>
              )}

              <StatusBadge
                status={club.membershipStatus}
                requestType={club.membershipRequestType}
              />
            </div>
          </div>
        </div>

        <div className={styles.cardTitle}>About club</div>
        <div
          style={{
            fontSize: 13,
            color: C.text,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {club.description || "This club has not added a description yet."}
        </div>

        {club.locations?.length > 0 && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <div className={styles.cardTitle}>
              Training venues
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              {club.locations.map((venue, index) => (
                <div
                  key={venue.id || `${club.id}-${index}`}
                  style={{
                    overflow: "hidden",
                    borderRadius: 14,
                    border: `1px solid ${C.line}`,
                    background: C.soft,
                  }}
                >
                  <iframe
                    title={`${venue.venueName || `Venue ${index + 1}`} map`}
                    src={getVenueMapEmbedUrl(venue, club)}
                    width="100%"
                    height="220"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    style={{
                      display: "block",
                      border: 0,
                    }}
                  />

                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: C.text,
                      }}
                    >
                      {venue.venueName || `Venue ${index + 1}`}
                      {venue.isPrimary && (
                        <span
                          className={styles.badgeBlue}
                          style={{ marginLeft: 7 }}
                        >
                          Main
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: C.muted,
                        fontSize: 12,
                        lineHeight: 1.55,
                      }}
                    >
                      {venue.address}
                    </div>

                    {venue.trainingDetails && (
                      <div
                        style={{
                          marginTop: 8,
                          color: C.text,
                          fontSize: 12,
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {venue.trainingDetails}
                      </div>
                    )}

                    <a
                      href={getVenueGoogleMapsUrl(venue, club)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        marginTop: 10,
                        color: "#1A5FFF",
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Open in Google Maps ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {club.relatedUrl && (
          <div style={{ marginTop: 12 }}>
            <a
              href={club.relatedUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.btnOutline}
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Open related link
            </a>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
            marginTop: 18,
            paddingTop: 18,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <SmallInfo label="State" value={club.state} />
          <SmallInfo label="Main area" value={club.location} />
          <SmallInfo label="Club manager" value={club.ownerName} />
          <SmallInfo
            label="Membership"
            value={club.acceptingMembers ? "Open" : "Closed"}
          />
        </div>
      </div>

      {club.membershipStatus === "accepted" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            Club members ({club.members?.length || 0})
          </div>

          {!club.members || club.members.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted }}>
              No members to display yet.
            </div>
          ) : (
            club.members.map((member) => (
              <div
                key={member.id}
                className={styles.listRow}
                role="button"
                tabIndex={0}
                onClick={() => onViewMember(member)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onViewMember(member);
                  }
                }}
                style={{ cursor: "pointer" }}
                title="View player profile"
              >
                {member.playerAvatarUrl ? (
                  <img
                    src={member.playerAvatarUrl}
                    alt={`${member.playerName || "Player"} profile`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div className={styles.av}>
                    {(member.playerName || "P").charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    {member.playerName}
                  </div>

                  <div style={{ fontSize: 11, color: C.muted }}>
                    {getClubRoleLabel(member)}
                    {member.playerState && member.playerState !== "—"
                      ? ` · ${member.playerState}`
                      : ""}
                  </div>
                </div>

                <span style={{ color: "#1A5FFF", fontSize: 18 }}>›</span>
              </div>
            ))
          )}
        </div>
      )}

      {!readOnly &&
        (club.isOwner ? (
          <div
            className={styles.card}
            style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}
          >
            <div className={styles.cardTitle}>You manage this club</div>
            Transfer ownership before leaving the club.
          </div>
        ) : club.membershipStatus === "pending" &&
          club.membershipRequestType === "invite" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <button
              className={styles.btnOutline}
              disabled={busy}
              onClick={() => onDeclineInvite(club)}
              style={{ color: "#DC2626", borderColor: "#FECACA" }}
            >
              {busy ? "Updating..." : "Decline invitation"}
            </button>

            <button
              className={styles.btnPrimary}
              disabled={busy}
              onClick={() => onAcceptInvite(club)}
            >
              {busy ? "Joining..." : "Accept invitation"}
            </button>
          </div>
        ) : club.membershipStatus === "pending" ? (
          <button
            className={styles.btnOutline}
            disabled={busy}
            onClick={() => onCancel(club)}
            style={{
              width: "100%",
              color: "#DC2626",
              borderColor: "#FECACA",
              background: "#FEF2F2",
            }}
          >
            {busy ? "Cancelling..." : "Cancel join request"}
          </button>
        ) : club.isInviteLink ? (
          <button
            className={styles.btnPrimary}
            disabled={busy}
            onClick={() => onAcceptInviteLink(club)}
            style={{ width: "100%" }}
          >
            {busy ? "Joining..." : "Accept club invitation"}
          </button>
        ) : club.membershipStatus === "accepted" ? null
        : acceptedClub && acceptedClub.id !== club.id ? (
          <div
            style={{
              width: "100%",
              padding: "11px 13px",
              borderRadius: 12,
              background: C.soft,
              border: `1px solid ${C.line}`,
              color: C.muted,
              fontSize: 12,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            You are already a member of{" "}
            <strong style={{ color: C.text }}>
              {acceptedClub.shortName || acceptedClub.name}
            </strong>
            . Leave that club before joining another club.
          </div>
        ) : (
          <button
            className={styles.btnPrimary}
            disabled={!club.acceptingMembers || busy}
            onClick={() => onJoin(club)}
            style={{
              width: "100%",
              opacity: club.acceptingMembers && !busy ? 1 : 0.55,
            }}
          >
            {busy
              ? "Sending..."
              : club.acceptingMembers
                ? club.membershipStatus === "rejected"
                  ? "Request to join again"
                  : "Request to join"
                : "Club is not accepting members"}
          </button>
        ))}
    </div>
  );
}


function ClubPlayerProfileModal({ member, onClose }) {
  const safeMember = member || {};

  const [profileTab, setProfileTab] = useState(
    safeMember.playerProfile ? "player" : "coach",
  );
  const [showMore, setShowMore] = useState(false);
  const [showVideos, setShowVideos] = useState(false);
  const [coachRequestBusy, setCoachRequestBusy] = useState(false);
  const [coachRequestStatus, setCoachRequestStatus] = useState(null);

  const playerProfile = safeMember.playerProfile || null;
  const coachProfile = safeMember.coachProfile || null;
  const playerSetup = safeMember.playerSetup || null;
  const publicPlayerProfile = safeMember.publicPlayerProfile || null;
  const memberUserId = safeMember.user_id || safeMember.userId || "";
  const playerDetailData = safeMember.playerDetailData || {};
  const playerMatches = Array.isArray(playerDetailData.matches)
    ? playerDetailData.matches
    : [];
  const playerEquipment = playerDetailData.equipment || null;
  const playerSkills = playerDetailData.skills || null;
  const playerMedia = Array.isArray(playerDetailData.media)
    ? playerDetailData.media
    : [];
  const coachDetailData = safeMember.coachDetailData || {};
  const coachVenues = Array.isArray(coachDetailData.venues)
    ? coachDetailData.venues
    : [];
  const coachCertificates = Array.isArray(coachDetailData.certificates)
    ? coachDetailData.certificates
    : [];
  const coachReviews = Array.isArray(coachDetailData.reviews)
    ? coachDetailData.reviews
    : [];

  const hasPlayerProfile = Boolean(playerProfile);
  const hasCoachProfile = Boolean(coachProfile);

  useEffect(() => {
    if (hasPlayerProfile && !hasCoachProfile) {
      setProfileTab("player");
    } else if (hasCoachProfile && !hasPlayerProfile) {
      setProfileTab("coach");
    } else if (hasPlayerProfile && hasCoachProfile) {
      setProfileTab("player");
    }

    setShowMore(false);
    setShowVideos(false);
    setCoachRequestStatus(null);
  }, [
    safeMember.user_id,
    safeMember.userId,
    hasPlayerProfile,
    hasCoachProfile,
  ]);

  if (!member) return null;

  const displayName =
    playerProfile?.display_name ||
    coachProfile?.display_name ||
    member.playerName ||
    member.member_name ||
    "Member";

  const clubRole = getClubRoleLabel({
    ...member,
    isClubCoach:
      member.isClubCoach === true ||
      member.is_club_coach === true,
  });

  const activeProfile =
    profileTab === "coach" && hasCoachProfile
      ? coachProfile
      : playerProfile || coachProfile || {};

  const avatarUrl =
    activeProfile.profile_photo_url ||
    activeProfile.avatar_url ||
    activeProfile.photo_url ||
    member.playerAvatarUrl ||
    null;

  const formatList = (value) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(", ");
    }

    if (value === null || value === undefined || value === "") {
      return "Not set";
    }

    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");
  };

  const getValue = (...values) => {
    const found = values.find(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "",
    );
    return found === undefined ? "Not set" : found;
  };

  const playerRows = playerProfile
    ? [
        ["Playing level", getValue(
          playerProfile.level,
          playerProfile.skill_level,
          playerSetup?.playing_level,
          publicPlayerProfile?.level,
          publicPlayerProfile?.skill_level,
        )],
        ["Preferred event", getValue(
          playerSetup?.preferred_event,
          playerProfile.preferred_event,
          playerProfile.player_category,
          playerProfile.category,
          publicPlayerProfile?.preferred_event,
          publicPlayerProfile?.player_category,
        )],
        ["Style", getValue(
          playerSetup?.play_style,
          playerSetup?.playing_style,
          publicPlayerProfile?.play_style,
          publicPlayerProfile?.playing_style,
          publicPlayerProfile?.style,
          playerProfile.playing_style,
          playerProfile.play_style,
          playerProfile.style,
        )],
        ["Strength", getValue(
          playerSetup?.biggest_strength,
          playerSetup?.strength,
          publicPlayerProfile?.biggest_strength,
          publicPlayerProfile?.strength,
          playerProfile.biggest_strength,
          playerProfile.strength,
        )],
        ["What player are you?", (() => {
          const value = getValue(
            playerSetup?.pressure_reaction,
            playerSetup?.player_type,
            publicPlayerProfile?.pressure_reaction,
            publicPlayerProfile?.player_type,
            playerProfile.pressure_reaction,
            playerProfile.player_type,
          );

          if (value === "Not set") return value;

          return String(value).toLowerCase().includes("player")
            ? String(value)
            : `${value} Player`;
        })()],
        ["Club", getValue(
          playerProfile.club,
          publicPlayerProfile?.club,
        )],
        ["Hand", getValue(
          playerProfile.dominant_hand,
          playerProfile.playing_hand,
          playerProfile.hand,
          publicPlayerProfile?.dominant_hand,
          publicPlayerProfile?.playing_hand,
          publicPlayerProfile?.hand,
        )],
        ["Experience", (() => {
          const years = calculateExperienceYears(
            playerProfile.date_of_birth ||
              publicPlayerProfile?.date_of_birth,
            playerProfile.started_playing_age ??
              publicPlayerProfile?.started_playing_age,
            playerProfile.experience_years ??
              playerProfile.years_experience ??
              publicPlayerProfile?.experience_years ??
              publicPlayerProfile?.years_experience ??
              0,
          );

          return years > 0 ? `${years} year(s)` : "Not set";
        })()],
        ["Partner state", getValue(
          playerProfile.state,
          playerProfile.location,
          publicPlayerProfile?.state,
          publicPlayerProfile?.location,
        )],
      ]
    : [];

  const coachRows = coachProfile
    ? [
        ["Coaching level", getValue(
          coachProfile.coaching_level,
          coachProfile.level,
          coachProfile.certification,
        )],
        ["State", getValue(
          coachProfile.state,
          coachProfile.location,
          coachProfile.coaching_state,
        )],
        ["Club", getValue(coachProfile.club)],
        ["Experience", getValue(
          coachProfile.experience_years,
          coachProfile.years_experience,
        ) === "Not set"
          ? "Not set"
          : `${getValue(
              coachProfile.experience_years,
              coachProfile.years_experience,
            )} year(s)`],
        ["Specialty", getValue(
          coachProfile.specialty,
          coachProfile.specialties,
          coachProfile.focus_area,
        )],
        ["Qualification", getValue(
          coachProfile.qualification,
          coachProfile.certification,
        )],
        ["Accepting players", coachProfile.accepting_players === true
          ? "Yes"
          : coachProfile.accepting_players === false
            ? "No"
            : "Not set"],
      ]
    : [];

  const rows = profileTab === "coach" ? coachRows : playerRows;


  const about =
    profileTab === "coach"
      ? getValue(
          coachProfile?.bio,
          coachProfile?.about,
          coachProfile?.description,
        )
      : getValue(
          playerProfile?.bio,
          playerProfile?.about,
          playerProfile?.description,
        );


  const sendCoachRequestToPlayer = async () => {
    if (!memberUserId || coachRequestBusy) return;

    setCoachRequestBusy(true);

    try {
      const { error } = await supabase.rpc(
        "coach_request_player_with_notification",
        {
          target_player_user_id: memberUserId,
          request_message: null,
        },
      );

      if (error) throw error;

      setCoachRequestStatus("pending");
      alert(`Coaching request sent to ${displayName}.`);
    } catch (error) {
      console.error("Failed to request player:", error);
      alert(error.message || "Failed to send coaching request.");
    } finally {
      setCoachRequestBusy(false);
    }
  };

  const relationshipStatus =
    coachRequestStatus ||
    coachDetailData.relationship?.status ||
    null;

  const playerInstagram = getValue(
    playerProfile?.instagram,
    publicPlayerProfile?.instagram,
  );

  const coachInstagram = getValue(
    coachProfile?.instagram,
    coachProfile?.instagram_url,
  );

  const latestMatches = playerMatches.slice(0, 3);
  const totalMatches = playerMatches.length;
  const wins = playerMatches.filter(
    (match) => String(match.result || "").toLowerCase() === "win",
  ).length;
  const winRate =
    totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const streak = (() => {
    if (playerMatches.length === 0) return "—";

    const firstResult = String(playerMatches[0]?.result || "")
      .trim()
      .toLowerCase();
    if (!firstResult) return "—";

    const isWin = firstResult === "win";
    let count = 0;

    for (const match of playerMatches) {
      const result = String(match.result || "").trim().toLowerCase();

      if ((result === "win") === isWin) {
        count += 1;
      } else {
        break;
      }
    }

    return `${isWin ? "W" : "L"}${count}`;
  })();

  const getOpponentName = (match) =>
    [
      match?.opponent_name,
      match?.opponent_name2,
    ]
      .filter(Boolean)
      .join(" & ") || "Opponent";

  const getMatchScore = (match) =>
    [match?.score1, match?.score2, match?.score3]
      .filter(
        (score) =>
          score !== null &&
          score !== undefined &&
          String(score).trim() !== "",
      )
      .join(", ");

  const getSkillValue = (...keys) => {
    for (const key of keys) {
      const raw =
        playerSkills?.[key] ??
        playerProfile?.[key] ??
        publicPlayerProfile?.[key];

      if (
        raw !== null &&
        raw !== undefined &&
        raw !== "" &&
        Number.isFinite(Number(raw))
      ) {
        return Number(raw);
      }
    }

    return 0;
  };

  const playingVideos = playerMedia
    .filter((media) => {
      const url = media.media_url || media.file_url || "";
      const type = String(
        media.file_type || media.mime_type || "",
      ).toLowerCase();

      return (
        Boolean(url) &&
        (
          type.startsWith("video/") ||
          /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url)
        )
      );
    })
    .slice(0, 3);

  const racket =
    playerEquipment?.racket ||
    playerEquipment?.rackets?.[0]?.racket ||
    "Not set";

  const stringName =
    playerEquipment?.string ||
    playerEquipment?.rackets?.[0]?.string ||
    "Not set";

  const stringTension =
    playerEquipment?.tension_lbs ??
    playerEquipment?.rackets?.[0]?.tension_lbs ??
    null;

  const shoes = playerEquipment?.shoes || "Not set";

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(13,27,62,0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} profile`}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: 22,
          boxShadow: "0 24px 65px rgba(13,27,62,0.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${displayName} profile`}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                className={styles.av}
                style={{ width: 72, height: 72, fontSize: 22 }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>
                {displayName}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>
                {clubRole}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: `1px solid ${C.line}`,
              background: C.card,
              color: C.muted,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              borderRadius: 12,
              background: C.soft,
              gap: 4,
            }}
          >
            {hasPlayerProfile && (
              <button
                type="button"
                className={
                  profileTab === "player"
                    ? styles.btnPrimary
                    : styles.btnOutline
                }
                onClick={() => setProfileTab("player")}
              >
                Player profile
              </button>
            )}

            {hasCoachProfile && (
              <button
                type="button"
                className={
                  profileTab === "coach"
                    ? styles.btnPrimary
                    : styles.btnOutline
                }
                onClick={() => setProfileTab("coach")}
              >
                Coach profile
              </button>
            )}
          </div>

          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Show less" : "View more"}
          </button>
        </div>

        {profileTab === "player" && playerInstagram !== "Not set" && (
          <a
            href={`https://instagram.com/${String(playerInstagram).replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              marginTop: 12,
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid #FBC8DC",
              background: "#FFF0F6",
              color: "#B5305A",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {String(playerInstagram).startsWith("@")
              ? playerInstagram
              : `@${playerInstagram}`}
          </a>
        )}

        {profileTab === "coach" && coachInstagram !== "Not set" && (
          <a
            href={`https://instagram.com/${String(coachInstagram).replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              marginTop: 12,
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid #FBC8DC",
              background: "#FFF0F6",
              color: "#B5305A",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {String(coachInstagram).startsWith("@")
              ? coachInstagram
              : `@${coachInstagram}`}
          </a>
        )}

        {(!showMore || profileTab === "player") && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
            }}
          >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: C.text,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {profileTab === "coach"
              ? "Coach information"
              : "Player information"}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "14px 26px",
            }}
          >
            {rows.map(([label, value]) => (
              <SmallInfo key={label} label={label} value={String(value)} />
            ))}
          </div>
        </div>
        )}

        {(!showMore || profileTab === "player") && (
        <div
          style={{
            marginTop: 20,
            paddingTop: 18,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: C.text,
              marginBottom: 9,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            About {profileTab === "coach" ? "Coach" : "Player"}
          </div>

          <div
            style={{
              fontSize: 13,
              color: C.text,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {about === "Not set"
              ? `This ${profileTab} has not added a biography yet.`
              : String(about)}
          </div>
        </div>
        )}

        {showMore && profileTab === "player" && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div>
              <div className={styles.cardTitle} style={{ marginBottom: 10 }}>
                Match performance
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                  gap: 8,
                }}
              >
                {[
                  ["Matches", totalMatches],
                  ["Win rate", `${winRate}%`],
                  ["Streak", streak],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background: C.soft,
                      borderRadius: 10,
                      padding: 10,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.muted }}>
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: C.text,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className={styles.cardTitle} style={{ marginBottom: 10 }}>
                Latest matches
              </div>

              {latestMatches.length > 0 ? (
                <div
                  style={{
                    borderRadius: 12,
                    background: C.soft,
                    border: `1px solid ${C.line}`,
                    overflow: "hidden",
                  }}
                >
                  {latestMatches.map((match, index) => (
                    <div
                      key={match.id || index}
                      style={{
                        padding: "11px 13px",
                        borderBottom:
                          index !== latestMatches.length - 1
                            ? `1px solid ${C.line}`
                            : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: C.text,
                          }}
                        >
                          vs {getOpponentName(match)}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 10,
                            color: C.muted,
                          }}
                        >
                          {match.match_type || "Match"}
                          {match.match_date
                            ? ` · ${new Date(
                                match.match_date,
                              ).toLocaleDateString("en-MY", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        {getMatchScore(match) && (
                          <strong>{getMatchScore(match)}</strong>
                        )}
                        <span
                          className={
                            String(match.result || "")
                              .toLowerCase() === "win"
                              ? styles.badgeGreen
                              : styles.badgeAmber
                          }
                        >
                          {String(match.result || "—").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: C.soft,
                    color: C.muted,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No match records yet.
                </div>
              )}
            </div>

            <div>
              <div className={styles.cardTitle} style={{ marginBottom: 10 }}>
                Skill profile
              </div>

              {[
                ["Smash", getSkillValue("smash")],
                ["Footwork", getSkillValue("footwork")],
                ["Defense", getSkillValue("defense")],
                ["Net play", getSkillValue("net_play", "net")],
                ["Drop shot", getSkillValue("drop_shot", "dropShot")],
                ["Serve", getSkillValue("serve")],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr 34px",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 9,
                  }}
                >
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {label}
                  </div>
                  <div
                    style={{
                      height: 7,
                      borderRadius: 999,
                      background: "#E8EDF7",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, Number(value) || 0),
                        )}%`,
                        height: "100%",
                        background: "#1A5FFF",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textAlign: "right",
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className={styles.cardTitle} style={{ marginBottom: 10 }}>
                Equipment
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px 24px",
                }}
              >
                <SmallInfo label="Racket" value={racket} />
                <SmallInfo label="String" value={stringName} />
                <SmallInfo
                  label="String tension"
                  value={
                    stringTension !== null &&
                    stringTension !== undefined &&
                    stringTension !== ""
                      ? `${stringTension} lbs`
                      : "Not set"
                  }
                />
                <SmallInfo label="Shoes" value={shoes} />
                <div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Playing videos
                  </div>

                  {playingVideos.length > 0 ? (
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => setShowVideos(true)}
                      style={{
                        marginTop: 5,
                        width: "100%",
                        color: "#1A5FFF",
                        borderColor: "#BFDBFE",
                        background: "#EFF6FF",
                      }}
                    >
                      ▶ View Playing Videos ({playingVideos.length})
                    </button>
                  ) : (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.text,
                      }}
                    >
                      No playing videos shared
                    </div>
                  )}
                </div>
              </div>
            </div>

            {relationshipStatus === "accepted" ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#ECFDF5",
                  color: "#047857",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                This player is already connected to you.
              </div>
            ) : relationshipStatus === "pending" ? (
              <button
                type="button"
                className={styles.btnOutline}
                disabled
                style={{ width: "100%" }}
              >
                Coaching request pending
              </button>
            ) : (
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={coachRequestBusy}
                onClick={sendCoachRequestToPlayer}
                style={{ width: "100%" }}
              >
                {coachRequestBusy
                  ? "Sending request..."
                  : "Request to coach this player"}
              </button>
            )}
          </div>
        )}

        {showMore && profileTab === "coach" && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <div className={styles.cardTitle}>Coach overview</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 10,
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
                  <div style={{ fontSize: 10, color: C.muted }}>
                    Experience
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#1A5FFF",
                    }}
                  >
                    {getValue(
                      coachProfile?.experience_years,
                      coachProfile?.years_experience,
                    )} year(s)
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
                  <div style={{ fontSize: 10, color: C.muted }}>
                    Player capacity
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: C.text,
                    }}
                  >
                    Up to {getValue(
                      coachProfile?.player_capacity,
                      coachProfile?.max_players,
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className={styles.cardTitle}>Coaching specialties</div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {String(
                    getValue(
                      coachProfile?.specialties,
                      coachProfile?.specialty,
                    ),
                  )
                    .split(",")
                    .map((item) => item.trim())
                    .filter(
                      (item) => item && item !== "Not set",
                    )
                    .map((item) => (
                      <span key={item} className={styles.badgeBlue}>
                        {item}
                      </span>
                    ))}
                </div>
              </div>
            </div>

            <div>
              <div className={styles.cardTitle}>About coach</div>
              <div
                style={{
                  fontSize: 13,
                  color: C.text,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  marginTop: 8,
                }}
              >
                {getValue(
                  coachProfile?.bio,
                  coachProfile?.about,
                  coachProfile?.description,
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "12px 24px",
                  marginTop: 16,
                }}
              >
                <SmallInfo
                  label="Club"
                  value={getValue(coachProfile?.club)}
                />
                <SmallInfo
                  label="State"
                  value={getValue(
                    coachProfile?.state,
                    coachProfile?.location,
                  )}
                />
                <SmallInfo
                  label="Coaching level"
                  value={getValue(
                    coachProfile?.coaching_level,
                    coachProfile?.level,
                  )}
                />
                <SmallInfo
                  label="Primary training venue"
                  value={getValue(
                    coachVenues.find((venue) => venue.is_primary)
                      ?.venue_name,
                    coachVenues[0]?.venue_name,
                    coachProfile?.training_venue,
                  )}
                />
                <SmallInfo
                  label="Availability"
                  value={getValue(coachProfile?.availability)}
                />
                <SmallInfo
                  label="Player levels"
                  value={formatList(
                    coachProfile?.player_levels ||
                      coachProfile?.levels_coached,
                  )}
                />
                <SmallInfo
                  label="Session types"
                  value={formatList(
                    coachProfile?.session_types ||
                      coachProfile?.coaching_types,
                  )}
                />
              </div>
            </div>

            {coachVenues.length > 0 && (
              <div>
                <div className={styles.cardTitle}>Training venues</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {coachVenues.map((venue) => (
                    <div
                      key={venue.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: venue.is_primary
                          ? "1.5px solid #1A5FFF"
                          : `1px solid ${C.line}`,
                        background: C.soft,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                            }}
                          >
                            {venue.venue_name || "Training venue"}
                          </div>
                          {venue.venue_address && (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 11,
                                color: C.muted,
                                lineHeight: 1.5,
                              }}
                            >
                              {venue.venue_address}
                            </div>
                          )}
                        </div>
                        {venue.is_primary && (
                          <span className={styles.badgeBlue}>Primary</span>
                        )}
                      </div>

                      {(() => {
                        const locationText = [
                          venue.venue_name,
                          venue.venue_address,
                          coachProfile?.state,
                        ]
                          .filter(Boolean)
                          .join(", ");

                        if (!locationText) return null;

                        return (
                          <iframe
                            title={`${venue.venue_name || "Training venue"} map`}
                            src={`https://www.google.com/maps?q=${encodeURIComponent(
                              locationText,
                            )}&output=embed`}
                            width="100%"
                            height="220"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            style={{
                              display: "block",
                              border: 0,
                              borderRadius: 10,
                              marginTop: 10,
                            }}
                          />
                        );
                      })()}

                      {venue.location_url && (
                        <a
                          href={venue.location_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            marginTop: 8,
                            color: "#1A5FFF",
                            fontSize: 11,
                            fontWeight: 800,
                            textDecoration: "none",
                          }}
                        >
                          Open in Google Maps ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coachCertificates.length > 0 && (
              <div>
                <div className={styles.cardTitle}>Certificates</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {coachCertificates.map((certificate, index) => (
                    <div
                      key={certificate.id || index}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${C.line}`,
                        background: C.soft,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: C.text,
                        }}
                      >
                        {certificate.certificate_name ||
                          certificate.name ||
                          certificate.title ||
                          "Certificate"}
                      </div>
                      {(certificate.issuer ||
                        certificate.issued_by) && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: C.muted,
                          }}
                        >
                          Issued by{" "}
                          {certificate.issuer ||
                            certificate.issued_by}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coachProfile?.coaching_philosophy && (
              <div>
                <div className={styles.cardTitle}>
                  Coaching philosophy
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {coachProfile.coaching_philosophy}
                </div>
              </div>
            )}

            {coachProfile?.achievements && (
              <div>
                <div className={styles.cardTitle}>Achievements</div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {coachProfile.achievements}
                </div>
              </div>
            )}

            <div>
              <div className={styles.cardTitle}>Player reviews</div>
              {coachReviews.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {coachReviews.map((review) => (
                    <div
                      key={review.id}
                      style={{
                        padding: 11,
                        borderRadius: 11,
                        background: C.soft,
                        border: `1px solid ${C.line}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <strong>
                          {review.player_name || "ShuttleTrack player"}
                        </strong>
                        <span style={{ color: "#F59E0B" }}>
                          {"★".repeat(Number(review.rating || 0))}
                        </span>
                      </div>
                      {review.review_text && (
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 12,
                            lineHeight: 1.55,
                          }}
                        >
                          {review.review_text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: C.muted,
                  }}
                >
                  No player reviews yet.
                </div>
              )}
            </div>
          </div>
        )}


      </div>

      {showVideos && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowVideos(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3600,
            background: "rgba(13,27,62,0.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(820px, 100%)",
              maxHeight: "88vh",
              overflowY: "auto",
              borderRadius: 18,
              background: C.card,
              padding: 18,
              boxShadow: "0 24px 65px rgba(13,27,62,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                }}
              >
                Playing Videos
              </div>

              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setShowVideos(false)}
              >
                Close
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
              }}
            >
              {playingVideos.map((video, index) => (
                <div
                  key={video.id || index}
                  style={{
                    overflow: "hidden",
                    borderRadius: 12,
                    border: `1px solid ${C.line}`,
                    background: C.soft,
                  }}
                >
                  <video
                    src={video.media_url || video.file_url}
                    controls
                    preload="metadata"
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      display: "block",
                      background: "#0F172A",
                    }}
                  />
                  <div
                    style={{
                      padding: "9px 11px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {video.title ||
                      video.file_name ||
                      `Playing video ${index + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditClubModal({
  club,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    shortName: club?.shortName || "",
    name: club?.name || "",
    state: club?.state || "",
    location: club?.location || "",
    locations:
      club?.locations?.length > 0
        ? club.locations.map((venue) => ({ ...venue }))
        : [createEmptyVenue(true)],
    description: club?.description || "",
    relatedUrl: club?.relatedUrl || "",
    logoFile: null,
    removeLogo: false,
  });
  const [logoPreview, setLogoPreview] = useState(club?.logoUrl || "");



  useEffect(() => {
    setForm({
      shortName: club?.shortName || "",
      name: club?.name || "",
      state: club?.state || "",
      location: club?.location || "",
      locations:
        club?.locations?.length > 0
          ? club.locations.map((venue) => ({ ...venue }))
          : [createEmptyVenue(true)],
      description: club?.description || "",
      relatedUrl: club?.relatedUrl || "",
      logoFile: null,
      removeLogo: false,
    });
    setLogoPreview(club?.logoUrl || "");
  }, [club]);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  if (!club) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateVenue = (index, field, value) => {
    setForm((current) => ({
      ...current,
      locations: current.locations.map((venue, venueIndex) =>
        venueIndex === index
          ? { ...venue, [field]: value }
          : venue,
      ),
    }));
  };

  const addVenue = () => {
    setForm((current) => ({
      ...current,
      locations: [
        ...current.locations,
        createEmptyVenue(false),
      ],
    }));
  };

  const setPrimaryVenue = (index) => {
    setForm((current) => {
      const selectedVenue = current.locations[index];

      if (!selectedVenue || index === 0) {
        return current;
      }

      const otherVenues = current.locations.filter(
        (_, venueIndex) => venueIndex !== index,
      );

      return {
        ...current,
        locations: [
          {
            ...selectedVenue,
            isPrimary: true,
          },
          ...otherVenues.map((venue) => ({
            ...venue,
            isPrimary: false,
          })),
        ],
      };
    });
  };

  const removeVenue = (index) => {
    setForm((current) => {
      const nextLocations = current.locations.filter(
        (_, venueIndex) => venueIndex !== index,
      );

      return {
        ...current,
        locations:
          nextLocations.length > 0
            ? nextLocations.map((venue, venueIndex) => ({
                ...venue,
                isPrimary: venueIndex === 0,
              }))
            : [createEmptyVenue(true)],
      };
    });
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Club logo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }

    setForm((current) => ({
      ...current,
      logoFile: file,
      removeLogo: false,
    }));
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.shortName.trim()) {
      alert("Please enter the club short name.");
      return;
    }

    if (!form.name.trim()) {
      alert("Please enter the full club name.");
      return;
    }

    if (!form.state.trim()) {
      alert("Please select the state.");
      return;
    }

    if (!form.location.trim()) {
      alert("Please enter the main area.");
      return;
    }

    const incompleteVenue = form.locations.find((venue) => {
      const hasAnyValue =
        venue.venueName.trim() ||
        venue.address.trim() ||
        venue.mapUrl.trim() ||
        venue.trainingDetails.trim();

      return (
        hasAnyValue &&
        (!venue.venueName.trim() || !venue.address.trim())
      );
    });

    if (incompleteVenue) {
      alert(
        "Each added venue needs both a venue name and an exact address.",
      );
      return;
    }

    await onSave(form);
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3100,
        background: "rgba(13,27,62,0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(680px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: 22,
          boxShadow: "0 24px 65px rgba(13,27,62,0.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>
            Edit club
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit club form"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: `1px solid ${C.line}`,
              background: C.card,
              color: C.muted,
              cursor: saving ? "wait" : "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <label style={labelStyle}>Club profile photo</label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <label
            htmlFor="edit-club-logo-upload"
            title="Change club profile photo"
            style={{
              position: "relative",
              width: 84,
              height: 84,
              borderRadius: "50%",
              border: "3px solid #1A5FFF",
              background: C.soft,
              overflow: "visible",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: saving ? "wait" : "pointer",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(26,95,255,0.16)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#EAF0FF",
                color: "#1A5FFF",
                fontSize: form.shortName.length > 4 ? 14 : 22,
                fontWeight: 900,
                padding: 6,
              }}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Club profile preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                form.shortName || "C"
              )}
            </div>

            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: -3,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#1A5FFF",
                border: "3px solid #FFFFFF",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8.5 6.5 10 4h4l1.5 2.5H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12.5"
                  r="3.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
          </label>

          <input
            id="edit-club-logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            disabled={saving}
            style={{ display: "none" }}
          />

          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
                marginBottom: 4,
              }}
            >
              Change club profile photo
            </div>

            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              Click the photo or camera icon.
              <br />
              PNG, JPG or WebP · Maximum 5 MB
            </div>

            {logoPreview && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (logoPreview.startsWith("blob:")) {
                    URL.revokeObjectURL(logoPreview);
                  }

                  setLogoPreview("");
                  setForm((current) => ({
                    ...current,
                    logoFile: null,
                    removeLogo: true,
                  }));

                  const input = document.getElementById(
                    "edit-club-logo-upload",
                  );
                  if (input) input.value = "";
                }}
                style={{
                  marginTop: 7,
                  border: "none",
                  background: "transparent",
                  color: "#DC2626",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: 0,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                Remove club photo
              </button>
            )}
          </div>
        </div>

        <div style={twoColumnStyle}>
          <div>
            <label style={labelStyle}>Club short name *</label>
            <input
              className={styles.formInput}
              value={form.shortName}
              onChange={(event) =>
                updateField(
                  "shortName",
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 10),
                )
              }
              maxLength={10}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Full club name *</label>
            <input
              className={styles.formInput}
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              maxLength={100}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={twoColumnStyle}>
          <div>
            <label style={labelStyle}>State *</label>
            <select
              className={styles.formSelect}
              value={form.state}
              onChange={(event) =>
                updateField("state", event.target.value)
              }
              style={inputStyle}
            >
              <option value="">Select state</option>
              <option>Johor</option>
              <option>Kedah</option>
              <option>Kelantan</option>
              <option>Kuala Lumpur</option>
              <option>Melaka</option>
              <option>Negeri Sembilan</option>
              <option>Pahang</option>
              <option>Penang</option>
              <option>Perak</option>
              <option>Perlis</option>
              <option>Sabah</option>
              <option>Sarawak</option>
              <option>Selangor</option>
              <option>Terengganu</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Main area *</label>
            <input
              className={styles.formInput}
              value={form.location}
              onChange={(event) =>
                updateField("location", event.target.value)
              }
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 4,
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            Training venues optional
          </label>

          <button
            type="button"
            className={styles.btnOutline}
            onClick={addVenue}
            disabled={saving}
            style={{ padding: "7px 11px", fontSize: 11 }}
          >
            + Add venue
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {form.locations.map((venue, index) => (
            <div
              key={venue.id || index}
              style={{
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${C.line}`,
                background: C.soft,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: C.text,
                    }}
                  >
                    Venue {index + 1}
                  </div>

                  {index === 0 && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: C.muted,
                      }}
                    >
                      This venue appears first on the club profile.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 7,
                    flexWrap: "wrap",
                  }}
                >
                  {index === 0 ? (
                    <span className={styles.badgeBlue}>
                      Primary
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimaryVenue(index)}
                      disabled={saving}
                      className={styles.btnOutline}
                      style={{
                        padding: "5px 9px",
                        fontSize: 11,
                      }}
                    >
                      Set as primary
                    </button>
                  )}

                  {form.locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVenue(index)}
                      disabled={saving}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#DC2626",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: saving ? "wait" : "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <input
                className={styles.formInput}
                value={venue.venueName}
                onChange={(event) =>
                  updateVenue(index, "venueName", event.target.value)
                }
                placeholder="Venue name"
                style={inputStyle}
              />

              <input
                className={styles.formInput}
                value={venue.address}
                onChange={(event) =>
                  updateVenue(index, "address", event.target.value)
                }
                placeholder="Exact address used to display the map"
                style={inputStyle}
              />

              <input
                className={styles.formInput}
                type="url"
                value={venue.mapUrl}
                onChange={(event) =>
                  updateVenue(index, "mapUrl", event.target.value)
                }
                placeholder="Google Maps share link optional"
                style={inputStyle}
              />

              <textarea
                className={styles.formInput}
                rows={2}
                value={venue.trainingDetails}
                onChange={(event) =>
                  updateVenue(
                    index,
                    "trainingDetails",
                    event.target.value,
                  )
                }
                placeholder="Training details optional"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              {venue.address.trim() && (
                <iframe
                  title={`Venue ${index + 1} map preview`}
                  src={getVenueMapEmbedUrl(venue, form)}
                  width="100%"
                  height="190"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  style={{
                    display: "block",
                    border: 0,
                    borderRadius: 12,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <label style={labelStyle}>Related link optional</label>
        <input
          className={styles.formInput}
          type="url"
          value={form.relatedUrl}
          onChange={(event) =>
            updateField("relatedUrl", event.target.value)
          }
          placeholder="Google Form, Instagram, Facebook or website URL"
          style={inputStyle}
        />

        <label style={labelStyle}>Description</label>
        <textarea
          className={styles.formInput}
          rows={5}
          value={form.description}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          maxLength={1000}
          style={{
            ...inputStyle,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

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
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ManageClub({
  club,
  requests,
  members,
  invitations,
  clubCoachRequests,
  invitePlayers,
  inviteBusyId,
  busyId,
  onRespond,
  onRespondClubCoachRequest,
  onSetClubCoachRole,
  onRemoveMember,
  onToggleMembership,
  onInvitePlayer,
  onCancelInvitation,
  onCopyInviteLink,
  onViewPlayer,
  onEditClub,
  onSetManagerRole,
  onTransferOwnership,
  onDeleteClub,
  onLeaveClub,
  leaveBusyId,
}) {
  if (!club) {
    return (
      <div className={styles.card} style={{ textAlign: "center", padding: 40 }}>
        <div className={styles.cardTitle}>No club to manage</div>
        <div style={{ fontSize: 13, color: C.muted }}>
          Create a club first to access club management.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className={styles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div className={styles.cardTitle}>{club.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {club.memberCount} accepted member
              {club.memberCount === 1 ? "" : "s"}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {(club.isOwner || club.isManager) && (
                <>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => onEditClub(club)}
                  >
                    Edit club
                  </button>

                  <button
                    type="button"
                    className={
                      club.acceptingMembers
                        ? styles.btnOutline
                        : styles.btnPrimary
                    }
                    onClick={() => onToggleMembership(club)}
                  >
                    {club.acceptingMembers
                      ? "Pause join requests"
                      : "Allow join requests"}
                  </button>
                </>
              )}

              {club.isOwner && (
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => onDeleteClub(club)}
                  style={{
                    color: "#DC2626",
                    borderColor: "#FECACA",
                    background: "#FEF2F2",
                  }}
                >
                  Delete club
                </button>
              )}

              {!club.isOwner && (
                <button
                  type="button"
                  className={styles.btnOutline}
                  disabled={leaveBusyId === club.id}
                  onClick={() => onLeaveClub(club)}
                  style={{
                    color: "#DC2626",
                    borderColor: "#FECACA",
                    background: "#FEF2F2",
                  }}
                >
                  {leaveBusyId === club.id ? "Leaving..." : "Leave club"}
                </button>
              )}
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: C.muted,
                maxWidth: 190,
                lineHeight: 1.4,
              }}
            >
              {club.isOwner
                ? club.acceptingMembers
                  ? "Stops new requests. Existing members stay in the club."
                  : "Players can request to join again."
                : "Managers can handle members, invitations and join requests."}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div className={styles.cardTitle} style={{ marginBottom: 3 }}>Invite players</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              Invite an existing ShuttleTrack player or share a club invitation link.
            </div>
          </div>
          <button type="button" className={styles.btnOutline} onClick={() => onCopyInviteLink(club)}>
            Copy invite link
          </button>
        </div>

        {invitePlayers.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>
            No available players to invite.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {invitePlayers.slice(0, 12).map((player) => (
              <div key={player.user_id} className={styles.listRow} style={{ alignItems: "center" }}>
                {player.profile_photo_url ? (
                  <img src={player.profile_photo_url} alt={`${player.display_name || "Player"} profile`} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div className={styles.av}>{(player.display_name || "P").charAt(0).toUpperCase()}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{player.display_name || "Player"}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{player.state || "State not set"}</div>
                </div>
                <button type="button" className={styles.btnPrimary} disabled={inviteBusyId === player.user_id} onClick={() => onInvitePlayer(player)}>
                  {inviteBusyId === player.user_id ? "Inviting..." : "Invite"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Sent invitations ({invitations.length})</div>
        {invitations.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>No pending invitations.</div>
        ) : (
          invitations.map((invite) => (
            <div key={invite.id} className={styles.listRow} style={{ alignItems: "center" }}>
              <div className={styles.av}>{(invite.playerName || "P").charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{invite.playerName}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Invitation pending</div>
              </div>
              <button type="button" className={styles.btnOutline} disabled={busyId === invite.id} onClick={() => onCancelInvitation(invite)} style={{ color: "#DC2626", borderColor: "#FECACA" }}>
                Cancel
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          Join requests ({requests.length})
        </div>

        {requests.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>
            No pending join requests.
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className={styles.listRow}
              role="button"
              tabIndex={0}
              onClick={() => onViewPlayer(request)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onViewPlayer(request);
                }
              }}
              style={{
                alignItems: "center",
                cursor: "pointer",
              }}
              title="View player profile"
            >
              {request.playerAvatarUrl ? (
                <img
                  src={request.playerAvatarUrl}
                  alt={`${request.playerName || "Player"} profile`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div className={styles.av}>
                  {(request.playerName || "P").charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {request.playerName}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  Requested to join your club
                </div>
              </div>

              <button
                className={styles.btnOutline}
                disabled={busyId === request.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onRespond(request, "rejected");
                }}
                style={{
                  color: "#DC2626",
                  borderColor: "#FECACA",
                  marginRight: 7,
                }}
              >
                Decline
              </button>

              <button
                className={styles.btnPrimary}
                disabled={busyId === request.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onRespond(request, "accepted");
                }}
              >
                Accept
              </button>
            </div>
          ))
        )}
      </div>

      {(club.isOwner || club.isManager) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            Club Coach applications ({clubCoachRequests.length})
          </div>

          {clubCoachRequests.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted }}>
              No pending Club Coach applications.
            </div>
          ) : (
            clubCoachRequests.map((request) => (
              <div
                key={request.id}
                className={styles.listRow}
                style={{ alignItems: "center" }}
              >
                {request.playerAvatarUrl ? (
                  <img
                    src={request.playerAvatarUrl}
                    alt={`${request.playerName || "Coach"} profile`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div className={styles.av}>
                    {(request.playerName || "C").charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    {request.playerName}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Applied to become Club Coach
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.btnOutline}
                  disabled={busyId === request.id}
                  onClick={() =>
                    onRespondClubCoachRequest(request, "rejected")
                  }
                  style={{
                    color: "#DC2626",
                    borderColor: "#FECACA",
                    marginRight: 7,
                  }}
                >
                  Decline
                </button>

                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={busyId === request.id}
                  onClick={() =>
                    onRespondClubCoachRequest(request, "accepted")
                  }
                >
                  Accept
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          Current members ({members.length})
        </div>

        {members.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>
            No accepted members yet.
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className={styles.listRow}
              role="button"
              tabIndex={0}
              onClick={() => onViewPlayer(member)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onViewPlayer(member);
                }
              }}
              style={{ cursor: "pointer" }}
              title="View player profile"
            >
              {member.playerAvatarUrl ? (
                <img
                  src={member.playerAvatarUrl}
                  alt={`${member.playerName || "Player"} profile`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div className={styles.av}>
                  {(member.playerName || "P").charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {member.playerName}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  <span>{getClubRoleLabel(member)}</span>
                </div>
              </div>

              {!member.isOwner && (
                <div
                  style={{
                    display: "flex",
                    gap: 7,
                    alignItems: "center",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {club.isOwner && (
                    <>
                      <button
                        type="button"
                        className={styles.btnOutline}
                        disabled={busyId === member.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSetManagerRole(
                            member,
                            member.memberRole !== "manager",
                          );
                        }}
                      >
                        {member.memberRole === "manager"
                          ? "Remove manager role"
                          : "Make manager"}
                      </button>

                      <button
                        type="button"
                        className={styles.btnOutline}
                        disabled={busyId === member.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTransferOwnership(member);
                        }}
                      >
                        Transfer ownership
                      </button>

                      {(club.isOwner || club.isManager) &&
                        member.hasCoachAccount && (
                          <button
                            type="button"
                            className={styles.btnOutline}
                            disabled={busyId === member.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSetClubCoachRole(
                                member,
                                !member.isClubCoach,
                              );
                            }}
                          >
                            {member.isClubCoach
                              ? "Remove Club Coach role"
                              : "Make Club Coach"}
                          </button>
                        )}
                    </>
                  )}

                  {!club.isOwner &&
                    club.isManager &&
                    member.hasCoachAccount && (
                      <button
                        type="button"
                        className={styles.btnOutline}
                        disabled={busyId === member.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSetClubCoachRole(
                            member,
                            !member.isClubCoach,
                          );
                        }}
                      >
                        {member.isClubCoach
                          ? "Remove Club Coach role"
                          : "Make Club Coach"}
                      </button>
                    )}

                  {(club.isOwner || member.memberRole !== "manager") && (
                    <button
                      type="button"
                      className={styles.btnOutline}
                      disabled={busyId === member.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveMember(member);
                      }}
                      style={{
                        color: "#DC2626",
                        borderColor: "#FECACA",
                        background: "#FEF2F2",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function CoachClubs() {
  const [clubSearchParams] = useSearchParams();

  const [tab, setTab] = useState("find");
  const [clubs, setClubs] = useState([]);
  const [selectedClub, setSelectedClub] = useState(null);
  const [ownedClub, setOwnedClub] = useState(null);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [clubCoachRequests, setClubCoachRequests] = useState([]);
  const [myClubCoachRequestStatus, setMyClubCoachRequestStatus] = useState(null);
  const [clubCoachBusy, setClubCoachBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [invitePlayers, setInvitePlayers] = useState([]);
  const [inviteBusyId, setInviteBusyId] = useState(null);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [loadingMemberProfile, setLoadingMemberProfile] = useState(false);
  const [editingClub, setEditingClub] = useState(null);
  const [savingClubEdit, setSavingClubEdit] = useState(false);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [manageBusyId, setManageBusyId] = useState(null);

  const showLoader = useLoadingDelay(loading, 350);

  // Read the shared invite directly from the URL. A copied invitation always
  // points to the public Vercel app, while normal development can stay on localhost.
  const inviteClubId = String(
    clubSearchParams.get("clubInvite") || "",
  ).trim();

  // Notifications can deep-link directly to the My club tab.
  useEffect(() => {
    if (inviteClubId) return;

    const requestedTab = String(
      clubSearchParams.get("tab") || "",
    ).trim().toLowerCase();

    if (requestedTab === "manage") {
      setTab("manage");
    }
  }, [clubSearchParams, inviteClubId]);

  const invitedClubFromUrl = useMemo(() => {
    if (!inviteClubId) return null;

    const match = clubs.find(
      (club) => String(club.id || "").trim() === inviteClubId,
    );

    if (!match) return null;

    return {
      ...match,
      isInviteLink: match.membershipStatus !== "accepted",
    };
  }, [clubs, inviteClubId]);

  // IMPORTANT: when ?clubInvite=... exists, that club is the actual active
  // selection. This makes the left card highlighted and renders ClubDetail on
  // the right even if a normal selectedClub state has not been set yet.
  const effectiveSelectedClub = invitedClubFromUrl || selectedClub;

  useEffect(() => {
    if (!inviteClubId || loading || clubs.length === 0) return;

    const invitedClub = clubs.find(
      (club) => String(club.id || "").trim() === inviteClubId,
    );

    if (!invitedClub) return;

    setTab("find");
    setSearch("");
    setStateFilter("");
    setSelectedClub({
      ...invitedClub,
      isInviteLink: invitedClub.membershipStatus !== "accepted",
    });
  }, [clubs, inviteClubId, loading]);

  const fetchClubs = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      setCurrentUserId(user?.id || "");

      const [
        clubResult,
        acceptedCountResult,
        acceptedMembersResult,
        clubLocationsResult,
      ] = await Promise.all([
        supabase
          .from("clubs")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("club_members")
          .select("club_id")
          .eq("status", "accepted"),
        supabase
          .from("club_members")
          .select("id, club_id, user_id, status, member_role, member_name, is_club_coach")
          .eq("status", "accepted"),
        supabase
          .from("club_locations")
          .select("*")
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
      ]);

      if (clubResult.error) throw clubResult.error;
      if (acceptedCountResult.error) {
        console.error(
          "Failed to load club member counts:",
          acceptedCountResult.error,
        );
      }

      let ownMemberships = [];

      if (user) {
        const { data, error } = await supabase
          .from("club_members")
          .select("*")
          .eq("user_id", user.id);

        if (error) throw error;
        ownMemberships = data || [];
      }

      if (acceptedMembersResult.error) {
        console.error(
          "Failed to load accepted club members:",
          acceptedMembersResult.error,
        );
      }

      const acceptedMemberRows = acceptedMembersResult.data || [];
      const acceptedMemberUserIds = [
        ...new Set(
          acceptedMemberRows
            .map((membership) => membership.user_id)
            .filter(Boolean),
        ),
      ];

      let publicPlayerProfilesByUserId = new Map();
      let publicCoachProfilesByUserId = new Map();

      if (acceptedMemberUserIds.length > 0) {
        const [playerProfilesResult, coachProfilesResult] =
          await Promise.all([
            supabase
              .from("player_profiles")
              .select(
                "user_id, display_name, state, player_category, profile_photo_url, playing_hand, experience_years, bio, instagram, profile_public",
              )
              .in("user_id", acceptedMemberUserIds),
            supabase
              .from("coach_profiles")
              .select("*")
              .in("user_id", acceptedMemberUserIds),
          ]);

        if (playerProfilesResult.error) {
          console.error(
            "Failed to load public player profiles:",
            playerProfilesResult.error,
          );
        } else {
          publicPlayerProfilesByUserId = new Map(
            (playerProfilesResult.data || []).map((profile) => [
              profile.user_id,
              profile,
            ]),
          );
        }

        if (coachProfilesResult.error) {
          console.error(
            "Failed to load public coach profiles:",
            coachProfilesResult.error,
          );
        } else {
          publicCoachProfilesByUserId = new Map(
            (coachProfilesResult.data || []).map((profile) => [
              profile.user_id,
              profile,
            ]),
          );
        }
      }

      const membersByClubId = new Map();

      acceptedMemberRows.forEach((membership) => {
        const playerProfile =
          publicPlayerProfilesByUserId.get(membership.user_id) || null;
        const coachProfile =
          publicCoachProfilesByUserId.get(membership.user_id) || null;

        const normalisedCoachProfile = coachProfile
          ? {
              ...coachProfile,
              display_name:
                coachProfile.display_name ||
                coachProfile.full_name ||
                coachProfile.name ||
                membership.member_name ||
                "Coach",
              state:
                coachProfile.state ||
                coachProfile.location ||
                coachProfile.coaching_state ||
                "—",
              coaching_level:
                coachProfile.coaching_level ||
                coachProfile.level ||
                coachProfile.certification ||
                "Coach",
              avatar_url:
                coachProfile.avatar_url ||
                coachProfile.profile_photo_url ||
                coachProfile.photo_url ||
                null,
              experience_years:
                coachProfile.experience_years ??
                coachProfile.years_experience ??
                0,
              bio:
                coachProfile.bio ||
                coachProfile.about ||
                coachProfile.description ||
                "",
              instagram:
                coachProfile.instagram ||
                coachProfile.instagram_url ||
                "",
            }
          : null;

        const normalisedPreferredProfile =
          playerProfile || normalisedCoachProfile;

        const isPrivatePlayer =
          playerProfile?.profile_public === false &&
          !normalisedCoachProfile;

        const member = {
          ...membership,
          playerName:
            (isPrivatePlayer
              ? membership.member_name
              : normalisedPreferredProfile?.display_name) ||
            membership.member_name ||
            "Member",
          playerState: isPrivatePlayer
            ? "—"
            : normalisedPreferredProfile?.state || "—",
          playerLevel: isPrivatePlayer
            ? "—"
            : playerProfile?.player_category ||
              normalisedCoachProfile?.coaching_level ||
              "—",
          playerAvatarUrl: isPrivatePlayer
            ? null
            : playerProfile?.profile_photo_url ||
              normalisedCoachProfile?.avatar_url ||
              normalisedCoachProfile?.profile_photo_url ||
              null,
          playerProfile: isPrivatePlayer ? null : playerProfile,
          coachProfile: normalisedCoachProfile,
          profilePrivate: isPrivatePlayer,
          memberRole: membership.member_role || "member",
          isClubCoach: membership.is_club_coach === true,
          hasCoachAccount: Boolean(normalisedCoachProfile),
        };

        const current = membersByClubId.get(membership.club_id) || [];
        current.push(member);
        membersByClubId.set(membership.club_id, current);
      });

      const countByClub = new Map();

      (acceptedCountResult.data || []).forEach((membership) => {
        countByClub.set(
          membership.club_id,
          (countByClub.get(membership.club_id) || 0) + 1,
        );
      });

      if (clubLocationsResult.error) {
        console.error(
          "Failed to load club locations:",
          clubLocationsResult.error,
        );
      }

      const locationsByClubId = new Map();

      (clubLocationsResult.data || []).forEach((venue) => {
        const current =
          locationsByClubId.get(venue.club_id) || [];

        current.push({
          id: venue.id,
          venueName: venue.venue_name || "",
          address: venue.address || "",
          mapUrl: venue.map_url || "",
          trainingDetails: venue.training_details || "",
          isPrimary: venue.is_primary === true,
        });

        locationsByClubId.set(venue.club_id, current);
      });

      const formatted = (clubResult.data || []).map((club) => {
        const membership = ownMemberships.find(
          (item) => item.club_id === club.id,
        );

        return {
          id: club.id,
          init:
            club.short_name?.trim()?.toUpperCase() ||
            club.name?.charAt(0)?.toUpperCase() ||
            "C",
          shortName: club.short_name?.trim()?.toUpperCase() || "",
          name: club.name || "Unnamed club",
          description: club.description || "",
          relatedUrl: club.related_url || "",
          locations:
            locationsByClubId.get(club.id) ||
            (club.exact_venue
              ? [
                  {
                    id: `legacy-${club.id}`,
                    venueName: club.exact_venue,
                    address: club.exact_venue,
                    mapUrl: club.location_url || "",
                    trainingDetails: "",
                    isPrimary: true,
                  },
                ]
              : []),
          state: club.state || "—",
          location: club.location || "—",
          logoUrl: club.logo_url || null,
          ownerId: club.owner_id,
          ownerName: club.owner_name || "Club manager",
          isOwner: Boolean(
            user &&
              String(club.owner_id || "").trim() ===
                String(user.id || "").trim(),
          ),
          isManager: Boolean(
            membership?.status === "accepted" &&
              membership?.member_role === "manager",
          ),
          acceptingMembers: club.accepting_members !== false,
          memberCount: countByClub.get(club.id) || 0,
          membershipId: membership?.id || null,
          membershipStatus: membership?.status || null,
          membershipRequestType: membership?.request_type || "request",
          members: (membersByClubId.get(club.id) || []).map(
            (member) => ({
              ...member,
              isOwner:
                String(member.user_id) === String(club.owner_id),
            }),
          ),
        };
      });

      if (inviteClubId) {
        formatted.forEach((club) => {
          club.isInviteLink =
            String(club.id || "").trim() === inviteClubId &&
            club.membershipStatus !== "accepted";
        });
      }

      const nextOwnedClub =
        formatted.find((club) => club.isOwner || club.isManager) || null;

      setClubs(formatted);
      setOwnedClub(nextOwnedClub);

      const { data: coachRequestRows, error: coachRequestError } =
        await supabase
          .from("club_coach_requests")
          .select("*")
          .order("created_at", { ascending: false });

      if (coachRequestError) {
        console.error(
          "Failed to load club coach requests:",
          coachRequestError,
        );
        setClubCoachRequests([]);
        setMyClubCoachRequestStatus(null);
      } else {
        const visibleCoachRequests = coachRequestRows || [];

        const acceptedClubForUser =
          formatted.find(
            (club) =>
              club.membershipStatus === "accepted" ||
              club.isOwner ||
              club.isManager,
          ) || null;

        const myCoachRequest =
          user && acceptedClubForUser
            ? visibleCoachRequests.find(
                (request) =>
                  String(request.club_id) ===
                    String(acceptedClubForUser.id) &&
                  String(request.requester_user_id) === String(user.id),
              )
            : null;

        setMyClubCoachRequestStatus(myCoachRequest?.status || null);

        const ownerClub =
          formatted.find((club) => club.isOwner) || null;

        const ownerRequests = ownerClub
          ? visibleCoachRequests
              .filter(
                (request) =>
                  String(request.club_id) === String(ownerClub.id) &&
                  request.status === "pending",
              )
              .map((request) => {
                const member =
                  (membersByClubId.get(ownerClub.id) || []).find(
                    (item) =>
                      String(item.user_id) ===
                      String(request.requester_user_id),
                  ) || null;

                return {
                  ...request,
                  playerName:
                    member?.playerName ||
                    request.requester_name ||
                    "Coach",
                  playerAvatarUrl:
                    member?.playerAvatarUrl || null,
                  member,
                };
              })
          : [];

        setClubCoachRequests(ownerRequests);
      }

      // If the page was opened from a shared invitation URL, select that
      // exact club immediately. Otherwise preserve the user's manual selection.
      const invitedClub = inviteClubId
        ? formatted.find(
            (club) => String(club.id || "").trim() === inviteClubId,
          ) || null
        : null;

      setSelectedClub((current) => {
        if (invitedClub) {
          return {
            ...invitedClub,
            isInviteLink: invitedClub.membershipStatus !== "accepted",
          };
        }

        return current
          ? formatted.find((club) => club.id === current.id) || null
          : null;
      });

      if (nextOwnedClub) {
        const membershipResult = await supabase
          .from("club_members")
          .select("*")
          .eq("club_id", nextOwnedClub.id)
          .in("status", ["pending", "accepted"])
          .order("requested_at", { ascending: true });

        if (membershipResult.error) throw membershipResult.error;

        const rows = membershipResult.data || [];
        const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

        let profilesByUserId = new Map();

        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from("player_profiles")
            .select("user_id, display_name, state, player_category, profile_photo_url, playing_hand, experience_years, bio, instagram, profile_public")
            .in("user_id", userIds);

          if (profileError) {
            console.error("Failed to load club member names:", profileError);
          } else {
            profilesByUserId = new Map(
              (profileRows || []).map((profile) => [
                profile.user_id,
                profile,
              ]),
            );
          }
        }

        const formattedMemberships = rows.map((row) => {
          const playerProfile =
            profilesByUserId.get(row.user_id) || null;
          const baseMember =
            (membersByClubId.get(nextOwnedClub.id) || []).find(
              (item) =>
                String(item.user_id) === String(row.user_id),
            ) || null;
          const isPrivatePlayer =
            !baseMember?.coachProfile &&
            row.member_role !== "manager" &&
            playerProfile?.profile_public === false;

          return {
            ...row,
            playerName:
              (isPrivatePlayer
                ? row.member_name
                : playerProfile?.display_name) ||
              row.member_name ||
              (row.user_id === user?.id
                ? nextOwnedClub.ownerName
                : "Player"),
            playerState: isPrivatePlayer
              ? "—"
              : playerProfile?.state || "—",
            playerLevel: isPrivatePlayer
              ? "—"
              : playerProfile?.player_category || "—",
            playerAvatarUrl: isPrivatePlayer
              ? null
              : playerProfile?.profile_photo_url || null,
            playerProfile: isPrivatePlayer ? null : playerProfile,
            coachProfile: baseMember?.coachProfile || null,
            profilePrivate: isPrivatePlayer,
            isOwner: row.user_id === nextOwnedClub.ownerId,
            memberRole: row.member_role || "member",
            isClubCoach:
              row.is_club_coach === true ||
              baseMember?.isClubCoach === true,
            hasCoachAccount: Boolean(baseMember?.coachProfile),
          };
        });

        setRequests(
          formattedMemberships.filter(
            (row) => row.status === "pending" && row.request_type !== "invite",
          ),
        );
        setInvitations(
          formattedMemberships.filter(
            (row) => row.status === "pending" && row.request_type === "invite",
          ),
        );
        setMembers(
          formattedMemberships.filter((row) => row.status === "accepted"),
        );

        const { data: inviteProfileRows, error: inviteProfileError } = await supabase
          .from("player_profiles")
          .select("user_id, display_name, state, player_category, profile_photo_url")
          .neq("user_id", user.id)
          .order("display_name", { ascending: true });

        if (inviteProfileError) {
          console.error("Failed to load players available for invitation:", inviteProfileError);
          setInvitePlayers([]);
        } else {
          const existingUserIds = new Set(rows.map((row) => row.user_id));
          const globallyAcceptedUserIds = new Set(
            acceptedMemberRows.map((row) => row.user_id).filter(Boolean),
          );

          setInvitePlayers(
            (inviteProfileRows || []).filter(
              (profile) =>
                profile.user_id &&
                !existingUserIds.has(profile.user_id) &&
                !globallyAcceptedUserIds.has(profile.user_id),
            ),
          );
        }
      } else {
        setRequests([]);
        setInvitations([]);
        setInvitePlayers([]);
        setMembers([]);
        setClubCoachRequests([]);
      }
    } catch (error) {
      console.error("Failed to load clubs:", error);
      alert(error.message || "Failed to load clubs.");
    } finally {
      setLoading(false);
    }
  }, [inviteClubId]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const states = useMemo(
    () =>
      [...new Set(clubs.map((club) => club.state).filter(Boolean))].sort(),
    [clubs],
  );

  const filteredClubs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clubs.filter((club) => {
      const matchesSearch =
        !query ||
        [
          club.name,
          club.description,
          club.state,
          club.location,
          ...(club.locations || []).flatMap((venue) => [
            venue.venueName,
            venue.address,
          ]),
        ].some((value) => String(value).toLowerCase().includes(query));

      const matchesState = !stateFilter || club.state === stateFilter;

      return matchesSearch && matchesState;
    });
  }, [clubs, search, stateFilter]);

  const acceptedClub = useMemo(
    () =>
      clubs.find(
        (club) =>
          club.membershipStatus === "accepted" ||
          club.isOwner ||
          club.isManager,
      ) || null,
    [clubs],
  );

  async function sendClubNotification({
    recipientUserId,
    type,
    title,
    message,
    actionUrl,
  }) {
    if (!recipientUserId) return;

    const { error } = await supabase.rpc("create_app_notification", {
      recipient_user_id: recipientUserId,
      notification_type: type,
      notification_title: title,
      notification_message: message,
      notification_action_url: actionUrl || null,
    });

    if (error) {
      console.error("Failed to create club notification:", error);
      throw error;
    }

    return true;
  }

  async function resolveClubMemberDisplayName(user) {
    if (!user?.id) return "Member";

    const [playerResult, coachResult, appUserResult] = await Promise.all([
      supabase
        .from("player_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("coach_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("app_users")
        .select("full_name, username")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (playerResult.error) {
      console.error(
        "Failed to resolve player display name:",
        playerResult.error,
      );
    }

    if (coachResult.error) {
      console.error(
        "Failed to resolve coach display name:",
        coachResult.error,
      );
    }

    if (appUserResult.error) {
      console.error(
        "Failed to resolve account display name:",
        appUserResult.error,
      );
    }

    return (
      playerResult.data?.display_name ||
      coachResult.data?.display_name ||
      appUserResult.data?.full_name ||
      appUserResult.data?.username ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Member"
    );
  }

  async function syncPlayerProfileClub(userId, shortName) {
    if (!userId) return

    const normalisedShortName = String(shortName || '').trim().toUpperCase()

    const { data: playerProfile, error: profileReadError } = await supabase
      .from('player_profiles')
      .select('id, club')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileReadError) {
      console.error('Failed to read player profile club:', profileReadError)
      return
    }

    if (!playerProfile) return

    const { error: updateError } = await supabase
      .from('player_profiles')
      .update({ club: normalisedShortName || null })
      .eq('id', playerProfile.id)

    if (updateError) {
      console.error('Failed to update player profile club:', updateError)
      throw updateError
    }

    window.dispatchEvent(
      new CustomEvent('club-membership-updated', {
        detail: {
          userId,
          club: normalisedShortName || '',
        },
      }),
    )

    if (userId === (await supabase.auth.getUser()).data.user?.id) {
      window.dispatchEvent(
        new CustomEvent('profile-updated', {
          detail: { club: normalisedShortName || '' },
        }),
      )
    }
  }

  async function clearPlayerProfileClubIfMatching(userId, shortName) {
    if (!userId) return

    const normalisedShortName = String(shortName || '').trim().toUpperCase()

    const { data: playerProfile, error: profileReadError } = await supabase
      .from('player_profiles')
      .select('id, club')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileReadError) {
      console.error('Failed to read player profile club:', profileReadError)
      return
    }

    if (!playerProfile) return

    if (
      String(playerProfile.club || '').trim().toUpperCase() !==
      normalisedShortName
    ) {
      return
    }

    const { error: updateError } = await supabase
      .from('player_profiles')
      .update({ club: null })
      .eq('id', playerProfile.id)

    if (updateError) {
      console.error('Failed to clear player profile club:', updateError)
      throw updateError
    }

    window.dispatchEvent(
      new CustomEvent('club-membership-updated', {
        detail: {
          userId,
          club: '',
        },
      }),
    )
  }

  async function openClubMemberProfile(member) {
    if (!member?.user_id) {
      setSelectedMemberProfile(member);
      return;
    }

    setLoadingMemberProfile(true);

    try {
      const [
        playerResult,
        coachResult,
        appUserResult,
        playerSetupResult,
        publicPlayerResult,
      ] = await Promise.all([
        supabase
          .from("player_profiles")
          .select("*")
          .eq("user_id", member.user_id)
          .maybeSingle(),
        supabase
          .from("coach_profiles")
          .select("*")
          .eq("user_id", member.user_id)
          .maybeSingle(),
        supabase
          .from("app_users")
          .select("user_id, full_name, username")
          .eq("user_id", member.user_id)
          .maybeSingle(),
        supabase.rpc("get_public_player_setup_directory"),
        supabase
          .from("public_players")
          .select("*")
          .eq("user_id", member.user_id)
          .maybeSingle(),
      ]);

      if (playerResult.error) {
        console.error(
          "Unable to load club member player profile:",
          playerResult.error,
        );
      }

      if (coachResult.error) {
        console.error(
          "Unable to load club member coach profile:",
          coachResult.error,
        );
      }

      if (appUserResult.error) {
        console.error(
          "Unable to load club member account name:",
          appUserResult.error,
        );
      }
      if (playerSetupResult.error) {
        console.error(
          "Unable to load club member player setup:",
          playerSetupResult.error,
        );
      }

      if (publicPlayerResult.error) {
        console.error(
          "Unable to load club member public player profile:",
          publicPlayerResult.error,
        );
      }


      const memberPlayerSetup =
        (playerSetupResult.data || []).find((setupRow) => {
          const setupUserId =
            setupRow?.user_id ||
            setupRow?.player_user_id ||
            null;

          return (
            setupUserId &&
            String(setupUserId) === String(member.user_id)
          );
        }) || null;

      let playerDetailData = {
        matches: [],
        equipment: null,
        skills: null,
        media: [],
      };

      let coachDetailData = {
        venues: [],
        certificates: [],
        reviews: [],
        relationship: null,
      };

      const playerProfileId = playerResult.data?.id || null;

      if (playerProfileId) {
        const [
          matchesResult,
          equipmentResult,
          skillsResult,
          mediaResult,
        ] = await Promise.all([
          supabase
            .from("player_matches")
            .select("*")
            .eq("player_id", playerProfileId)
            .order("match_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("player_equipment")
            .select("*")
            .eq("player_id", playerProfileId)
            .maybeSingle(),
          supabase
            .from("player_skill_ratings")
            .select("*"),
          supabase
            .from("player_profile_media")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (matchesResult.error) {
          console.error("Unable to load club member matches:", matchesResult.error);
        }

        if (equipmentResult.error) {
          console.error("Unable to load club member equipment:", equipmentResult.error);
        }

        if (skillsResult.error) {
          console.error("Unable to load club member skills:", skillsResult.error);
        }

        if (mediaResult.error) {
          console.error("Unable to load club member media:", mediaResult.error);
        }

        const matchingSkill =
          (skillsResult.data || []).find((rating) =>
            [
              rating?.player_id,
              rating?.user_id,
              rating?.profile_id,
              rating?.id,
            ]
              .filter(Boolean)
              .some(
                (key) =>
                  String(key) === String(playerProfileId) ||
                  String(key) === String(member.user_id),
              ),
          ) || null;

        const matchingMedia = (mediaResult.data || [])
          .filter((media) => {
            if (media?.is_featured !== true) return false;

            return (
              String(media?.player_id || "") === String(playerProfileId) ||
              String(media?.user_id || "") === String(member.user_id)
            );
          })
          .slice(0, 3);

        playerDetailData = {
          matches: matchesResult.data || [],
          equipment: equipmentResult.data || null,
          skills: matchingSkill,
          media: matchingMedia,
        };
      }

      if (coachResult.data?.user_id) {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        const [
          venueResult,
          certificateResult,
          reviewResult,
          relationshipResult,
        ] = await Promise.all([
          supabase
            .from("coach_training_venues")
            .select("*")
            .eq("coach_user_id", coachResult.data.user_id)
            .order("is_primary", { ascending: false })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("coach_certifications")
            .select("*")
            .eq("coach_user_id", coachResult.data.user_id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("coach_reviews")
            .select("*")
            .eq("coach_user_id", coachResult.data.user_id)
            .order("updated_at", { ascending: false }),
          currentUser
            ? supabase
                .from("coach_player_relationships")
                .select("*")
                .eq("coach_user_id", currentUser.id)
                .eq("player_user_id", member.user_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (venueResult.error) {
          console.error(
            "Unable to load club member coach venues:",
            venueResult.error,
          );
        }

        if (certificateResult.error) {
          console.error(
            "Unable to load club member coach certificates:",
            certificateResult.error,
          );
        }

        if (reviewResult.error) {
          console.error(
            "Unable to load club member coach reviews:",
            reviewResult.error,
          );
        }

        if (relationshipResult.error) {
          console.error(
            "Unable to load coach-player relationship:",
            relationshipResult.error,
          );
        }

        coachDetailData = {
          venues: venueResult.data || [],
          certificates: certificateResult.data || [],
          reviews: reviewResult.data || [],
          relationship: relationshipResult.data || null,
        };
      }

      const rawCoachProfile = coachResult.data || null;

      const coachProfile = rawCoachProfile
        ? {
            ...rawCoachProfile,
            display_name:
              rawCoachProfile.display_name ||
              rawCoachProfile.full_name ||
              rawCoachProfile.name ||
              appUserResult.data?.full_name ||
              appUserResult.data?.username ||
              member.member_name ||
              "Coach",
            state:
              rawCoachProfile.state ||
              rawCoachProfile.location ||
              rawCoachProfile.coaching_state ||
              "",
            coaching_level:
              rawCoachProfile.coaching_level ||
              rawCoachProfile.level ||
              rawCoachProfile.certification ||
              "",
            avatar_url:
              rawCoachProfile.avatar_url ||
              rawCoachProfile.profile_photo_url ||
              rawCoachProfile.photo_url ||
              "",
            experience_years:
              rawCoachProfile.experience_years ??
              rawCoachProfile.years_experience ??
              0,
            bio:
              rawCoachProfile.bio ||
              rawCoachProfile.about ||
              rawCoachProfile.description ||
              "",
            instagram:
              rawCoachProfile.instagram ||
              rawCoachProfile.instagram_url ||
              "",
          }
        : null;

      const rawPlayerProfile = playerResult.data || null;

      const isCoachMember =
        member.isClubCoach === true ||
        member.is_club_coach === true ||
        member.memberRole === "manager" ||
        member.member_role === "manager";

      const isPrivatePlayer =
        !isCoachMember &&
        rawPlayerProfile?.profile_public === false;

      const playerProfile = isPrivatePlayer
        ? null
        : rawPlayerProfile;

      const preferredProfile =
        isCoachMember
          ? coachProfile || playerProfile
          : playerProfile || coachProfile;

      setSelectedMemberProfile({
        ...member,
        playerName:
          (isPrivatePlayer
            ? member.playerName || member.member_name
            : preferredProfile?.display_name) ||
          appUserResult.data?.full_name ||
          appUserResult.data?.username ||
          member.playerName ||
          member.member_name ||
          "Member",
        playerState: isPrivatePlayer
          ? "—"
          : preferredProfile?.state ||
            member.playerState ||
            "—",
        playerLevel: isPrivatePlayer
          ? "—"
          : isCoachMember
            ? coachProfile?.coaching_level ||
              member.playerLevel ||
              "Coach"
            : playerProfile?.player_category ||
              member.playerLevel ||
              "—",
        playerAvatarUrl: isPrivatePlayer
          ? null
          : coachProfile?.avatar_url ||
            playerProfile?.profile_photo_url ||
            member.playerAvatarUrl ||
            null,
        playerProfile,
        coachProfile,
        playerSetup: memberPlayerSetup,
        publicPlayerProfile: publicPlayerResult.data || null,
        playerDetailData,
        coachDetailData,
        profilePrivate: isPrivatePlayer,
        memberRole:
          member.memberRole ||
          member.member_role ||
          "member",
        isClubCoach:
          member.isClubCoach === true ||
          member.is_club_coach === true,
        hasCoachAccount: Boolean(coachProfile),
      });
    } catch (error) {
      console.error("Unable to open club member profile:", error);
      setSelectedMemberProfile(member);
    } finally {
      setLoadingMemberProfile(false);
    }
  }

  async function createClub(form) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    if (acceptedClub) {
      alert(
        `You are already a member of ${acceptedClub.shortName || acceptedClub.name}. Leave your current club before creating another club.`,
      );
      setTab("manage");
      return;
    }

    if (ownedClub) {
      alert(`You already manage ${ownedClub.name}.`);
      setTab("manage");
      return;
    }

    setCreating(true);

    try {
      const { data: playerProfile } = await supabase
        .from("coach_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: coachProfile } = await supabase
        .from("coach_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const ownerName =
        playerProfile?.display_name ||
        coachProfile?.display_name ||
        user.user_metadata?.display_name ||
        user.email ||
        "Club manager";

      let logoUrl = null;
      let uploadedLogoPath = null;

      if (form.logoFile) {
        const extension =
          form.logoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        uploadedLogoPath = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("club-logos")
          .upload(uploadedLogoPath, form.logoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: form.logoFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("club-logos")
          .getPublicUrl(uploadedLogoPath);

        logoUrl = publicUrlData?.publicUrl || null;
      }

      const { data: created, error } = await supabase
        .from("clubs")
        .insert({
          owner_id: user.id,
          owner_name: ownerName,
          short_name: form.shortName.trim().toUpperCase(),
          name: form.name.trim(),
          state: form.state.trim(),
          location: form.location.trim(),
          description: form.description.trim() || null,
          related_url: form.relatedUrl.trim() || null,
          logo_url: logoUrl,
          accepting_members: true,
        })
        .select("*")
        .single();

      if (error) {
        if (uploadedLogoPath) {
          await supabase.storage
            .from("club-logos")
            .remove([uploadedLogoPath]);
        }

        throw error;
      }

      const locationRows = form.locations
        .map((venue, index) => ({
          club_id: created.id,
          venue_name: venue.venueName.trim(),
          address: venue.address.trim(),
          map_url: venue.mapUrl.trim() || null,
          training_details:
            venue.trainingDetails.trim() || null,
          is_primary: index === 0,
        }))
        .filter(
          (venue) => venue.venue_name && venue.address,
        );

      if (locationRows.length > 0) {
        const { error: locationError } = await supabase
          .from("club_locations")
          .insert(locationRows);

        if (locationError) throw locationError;
      }

      const { error: membershipError } = await supabase
        .from("club_members")
        .upsert(
          {
            club_id: created.id,
            user_id: user.id,
            status: "accepted",
            member_role: "manager",
            member_name: ownerName,
            responded_at: new Date().toISOString(),
          },
          { onConflict: "club_id,user_id" },
        );

      if (membershipError) throw membershipError;

      await syncPlayerProfileClub(
        user.id,
        form.shortName.trim().toUpperCase(),
      );

      await fetchClubs();
      setTab("manage");
      alert("Club created successfully.");
    } catch (error) {
      console.error("Failed to create club:", error);
      alert(error.message || "Failed to create club.");
    } finally {
      setCreating(false);
    }
  }

  async function requestJoin(club) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Please log in again.");
      return;
    }

    const currentAcceptedClub = clubs.find(
      (item) =>
        item.membershipStatus === "accepted" ||
        item.isOwner ||
        item.isManager,
    );

    if (currentAcceptedClub && currentAcceptedClub.id !== club.id) {
      alert(
        `You are already a member of ${currentAcceptedClub.shortName || currentAcceptedClub.name}. Leave your current club before joining another club.`,
      );
      return;
    }

    setActionId(club.id);

    try {
      const { data: ownProfile } = await supabase
        .from("coach_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const memberName =
        ownProfile?.display_name ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Coach";

      const { error } = await supabase.rpc(
        "request_club_membership",
        {
          p_club_id: club.id,
          p_member_name: memberName,
        },
      );

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: club.ownerId,
        type: "club_join_request",
        title: "New club join request",
        message: `${memberName} requested to join ${club.shortName || club.name}.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
      alert("Join request sent.");
    } catch (error) {
      console.error("Failed to request club membership:", error);
      alert(error.message || "Failed to send join request.");
    } finally {
      setActionId(null);
    }
  }

  async function cancelRequest(club) {
    if (!window.confirm(`Cancel your request to join ${club.name}?`)) return;

    setActionId(club.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please log in again.");

      const { data: ownProfile } = await supabase
        .from("coach_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const memberName =
        ownProfile?.display_name ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "A player";

      const { error } = await supabase
        .from("club_members")
        .update({
          status: "cancelled",
          responded_at: new Date().toISOString(),
        })
        .eq("club_id", club.id)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: club.ownerId,
        type: "club_request_cancelled",
        title: "Club request cancelled",
        message: `${memberName} cancelled the request to join ${club.shortName || club.name}.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
    } catch (error) {
      alert(error.message || "Failed to cancel request.");
    } finally {
      setActionId(null);
    }
  }

  async function leaveClub(club) {
    if (!window.confirm(`Leave ${club.name}?`)) return;

    setActionId(club.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please log in again.");

      const { error } = await supabase.rpc(
        "leave_club_membership",
        {
          p_club_id: club.id,
        },
      );

      if (error) throw error;

      await clearPlayerProfileClubIfMatching(
        user.id,
        club.shortName,
      );

      const { data: ownProfile } = await supabase
        .from("coach_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const memberName =
        ownProfile?.display_name ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "A member";

      await sendClubNotification({
        recipientUserId: club.ownerId,
        type: "club_member_left",
        title: "Club member left",
        message: `${memberName} left ${club.shortName || club.name}.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
      alert("You left the club.");
    } catch (error) {
      alert(error.message || "Failed to leave club.");
    } finally {
      setActionId(null);
    }
  }

  async function invitePlayerToClub(player) {
    if (!ownedClub?.id || !player?.user_id) return;

    setInviteBusyId(player.user_id);

    try {
      const { error } = await supabase.rpc("invite_player_to_club", {
        p_club_id: ownedClub.id,
        p_player_user_id: player.user_id,
      });

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: player.user_id,
        type: "club_invitation",
        title: "Club invitation",
        message: `${ownedClub.shortName || ownedClub.name} invited you to join the club.`,
        actionUrl: `/clubs?clubInvite=${encodeURIComponent(ownedClub.id)}&notice=${Date.now()}`,
      });

      await fetchClubs();
      alert(`Invitation sent to ${player.display_name || "player"}.`);
    } catch (error) {
      console.error("Failed to invite player:", error);
      alert(error.message || "Failed to send club invitation.");
    } finally {
      setInviteBusyId(null);
    }
  }

  async function cancelClubInvitation(invitation) {
    if (!window.confirm(`Cancel the invitation for ${invitation.playerName}?`)) return;
    setManageBusyId(invitation.id);
    try {
      const { error } = await supabase
        .from("club_members")
        .delete()
        .eq("id", invitation.id)
        .eq("status", "pending")
        .eq("request_type", "invite");
      if (error) throw error;
      await fetchClubs();
    } catch (error) {
      alert(error.message || "Failed to cancel invitation.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function copyClubInviteLink(club) {
    const link = `${PUBLIC_APP_URL}/clubs?clubInvite=${encodeURIComponent(club.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      alert("Club invitation link copied.");
    } catch (error) {
      window.prompt("Copy this club invitation link:", link);
    }
  }

  async function respondToClubInvitation(club, status) {
    if (!club?.membershipId) return;

    if (status === "accepted") {
      const currentAcceptedClub = clubs.find(
        (item) =>
          item.membershipStatus === "accepted" ||
          item.isOwner ||
          item.isManager,
      );

      if (currentAcceptedClub && currentAcceptedClub.id !== club.id) {
        alert(
          `You are already a member of ${currentAcceptedClub.shortName || currentAcceptedClub.name}. Leave your current club before accepting another invitation.`,
        );
        return;
      }
    }

    setActionId(club.id);
    try {
      const nextStatus = status === "accepted" ? "accepted" : "rejected";
      const { error } = await supabase
        .from("club_members")
        .update({ status: nextStatus, responded_at: new Date().toISOString() })
        .eq("id", club.membershipId)
        .eq("status", "pending")
        .eq("request_type", "invite");
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();

      const memberName = await resolveClubMemberDisplayName(user);

      if (status === "accepted" && user) {
        await syncPlayerProfileClub(user.id, club.shortName);
      }

      await sendClubNotification({
        recipientUserId: club.ownerId,
        type: status === "accepted" ? "club_invitation_accepted" : "club_invitation_declined",
        title: status === "accepted" ? "Club invitation accepted" : "Club invitation declined",
        message: `${memberName} ${status === "accepted" ? "accepted" : "declined"} the invitation to ${club.shortName || club.name}.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
    } catch (error) {
      alert(error.message || "Failed to update club invitation.");
    } finally {
      setActionId(null);
    }
  }

  async function acceptClubInviteLink(club) {
    setActionId(club.id);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please log in to accept this club invitation.");

      const memberName = await resolveClubMemberDisplayName(user);

      const { error } = await supabase
        .from("club_members")
        .upsert({
          club_id: club.id,
          user_id: user.id,
          member_name: memberName,
          status: "accepted",
          request_type: "invite_link",
          member_role: "member",
          requested_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
          invited_by: club.ownerId,
        }, { onConflict: "club_id,user_id" });
      if (error) throw error;

      await syncPlayerProfileClub(user.id, club.shortName);
      await sendClubNotification({
        recipientUserId: club.ownerId,
        type: "club_invitation_accepted",
        title: "Club invitation accepted",
        message: `${memberName} joined ${club.shortName || club.name} using your invitation link.`,
        actionUrl: "/clubs",
      });
      window.history.replaceState({}, "", window.location.pathname);
      await fetchClubs();
      alert(`You joined ${club.shortName || club.name}.`);
    } catch (error) {
      alert(error.message || "Failed to accept club invitation.");
    } finally {
      setActionId(null);
    }
  }

  async function respondToRequest(request, status) {
    setManageBusyId(request.id);

    try {
      const { error } = await supabase.rpc(
        "respond_to_club_join_request",
        {
          p_membership_id: request.id,
          p_status: status,
        },
      );

      if (error) throw error;

      if (status === "accepted") {
        await syncPlayerProfileClub(
          request.user_id,
          ownedClub?.shortName,
        );

        await sendClubNotification({
          recipientUserId: request.user_id,
          type: "club_request_accepted",
          title: "Club request accepted",
          message: `Your request to join ${ownedClub?.shortName || ownedClub?.name || "the club"} was accepted.`,
          actionUrl: "/clubs",
        });
      } else {
        await sendClubNotification({
          recipientUserId: request.user_id,
          type: "club_request_declined",
          title: "Club request declined",
          message: `Your request to join ${ownedClub?.shortName || ownedClub?.name || "the club"} was declined.`,
          actionUrl: "/clubs",
        });
      }

      await fetchClubs();
    } catch (error) {
      alert(error.message || "Failed to update join request.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function applyForClubCoach() {
    if (!acceptedClub?.id || clubCoachBusy) return;

    setClubCoachBusy(true);

    try {
      const { error } = await supabase.rpc("apply_for_club_coach", {
        p_club_id: acceptedClub.id,
      });

      if (error) throw error;

      await fetchClubs();
      alert("Club Coach application sent to the club owner.");
    } catch (error) {
      console.error("Failed to apply for Club Coach:", error);
      alert(error.message || "Failed to apply for Club Coach.");
    } finally {
      setClubCoachBusy(false);
    }
  }

  async function respondToClubCoachRequest(request, status) {
    if (!request?.id) return;

    setManageBusyId(request.id);

    try {
      const { error } = await supabase.rpc(
        "respond_to_club_coach_request",
        {
          p_request_id: request.id,
          p_status: status,
        },
      );

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: request.requester_user_id,
        type:
          status === "accepted"
            ? "club_coach_request_accepted"
            : "club_coach_request_declined",
        title:
          status === "accepted"
            ? "Club Coach application accepted"
            : "Club Coach application declined",
        message:
          status === "accepted"
            ? `Your Club Coach application for ${ownedClub?.shortName || ownedClub?.name || "the club"} was accepted.`
            : `Your Club Coach application for ${ownedClub?.shortName || ownedClub?.name || "the club"} was declined.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
    } catch (error) {
      console.error("Failed to respond to Club Coach request:", error);
      alert(error.message || "Failed to update Club Coach application.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function setClubCoachRole(member, makeClubCoach) {
    if (!ownedClub?.id || !member?.user_id) return;

    const confirmed = window.confirm(
      makeClubCoach
        ? `Make ${member.playerName || "this member"} a Club Coach?`
        : `Remove the Club Coach role from ${member.playerName || "this member"}?`,
    );

    if (!confirmed) return;

    setManageBusyId(member.id);

    try {
      const { error } = await supabase.rpc("set_club_coach_role", {
        p_club_id: ownedClub.id,
        p_user_id: member.user_id,
        p_make_club_coach: makeClubCoach,
      });

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: member.user_id,
        type: makeClubCoach
          ? "club_coach_role_added"
          : "club_coach_role_removed",
        title: makeClubCoach
          ? "Club Coach role added"
          : "Club Coach role removed",
        message: makeClubCoach
          ? `You are now a Club Coach in ${ownedClub.shortName || ownedClub.name}.`
          : `Your Club Coach role in ${ownedClub.shortName || ownedClub.name} was removed. Your other club roles are unchanged.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
    } catch (error) {
      console.error("Failed to update Club Coach role:", error);
      alert(error.message || "Failed to update Club Coach role.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function setManagerRole(member, makeManager) {
    if (!ownedClub?.id || !member?.user_id || !ownedClub?.isOwner) return;

    const actionLabel = makeManager ? "make" : "remove";
    const confirmed = window.confirm(
      makeManager
        ? `Make ${member.playerName || "this member"} a club manager?`
        : `Remove the manager role from ${member.playerName || "this member"}?`,
    );

    if (!confirmed) return;

    setManageBusyId(member.id);

    try {
      const { error } = await supabase.rpc(
        "set_club_manager_role",
        {
          p_club_id: ownedClub.id,
          p_member_user_id: member.user_id,
          p_make_manager: makeManager,
        },
      );

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: member.user_id,
        type: makeManager
          ? "club_manager_added"
          : "club_manager_removed",
        title: makeManager
          ? "Club manager role added"
          : "Club manager role removed",
        message: makeManager
          ? `You are now a manager of ${ownedClub.shortName || ownedClub.name}.`
          : `Your manager role for ${ownedClub.shortName || ownedClub.name} was removed.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
      alert(
        makeManager
          ? "Manager role added successfully."
          : "Manager role removed successfully.",
      );
    } catch (error) {
      console.error(`Failed to ${actionLabel} manager role:`, error);
      alert(error.message || "Failed to update manager role.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function transferClubOwnership(member) {
    if (!ownedClub?.id || !member?.user_id) return;

    const confirmed = window.confirm(
      `Transfer club ownership to ${member.playerName || "this member"}? You will remain a club manager after the transfer.`,
    );

    if (!confirmed) return;

    setManageBusyId(member.id);

    try {
      const { error } = await supabase.rpc(
        "transfer_club_owner",
        {
          p_club_id: ownedClub.id,
          p_new_owner_user_id: member.user_id,
        },
      );

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: member.user_id,
        type: "club_owner_transferred",
        title: "Club ownership transferred",
        message: `You are now the owner of ${ownedClub.shortName || ownedClub.name}.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
      alert(
        "Club ownership transferred successfully. You remain a club manager.",
      );
    } catch (error) {
      console.error("Failed to transfer club ownership:", error);
      alert(error.message || "Failed to transfer club ownership.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.playerName} from this club?`)) return;

    setManageBusyId(member.id);

    try {
      const { error } = await supabase.rpc(
        "remove_club_member",
        {
          p_membership_id: member.id,
        },
      );

      if (error) throw error;

      await clearPlayerProfileClubIfMatching(
        member.user_id,
        ownedClub?.shortName,
      );

      await sendClubNotification({
        recipientUserId: member.user_id,
        type: "club_member_removed",
        title: "Removed from club",
        message: `You were removed from ${ownedClub?.shortName || ownedClub?.name || "the club"}.`,
        actionUrl: "/clubs",
      });

      await fetchClubs();
    } catch (error) {
      alert(error.message || "Failed to remove member.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function updateClubDetails(form) {
    if (!editingClub) return;

    setSavingClubEdit(true);

    try {
      const shortName = form.shortName.trim().toUpperCase();
      let nextLogoUrl = editingClub.logoUrl || null;
      let uploadedLogoPath = null;

      if (form.removeLogo) {
        nextLogoUrl = null;
      }

      if (form.logoFile) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Please log in again.");
        }

        const extension =
          form.logoFile.name.split(".").pop()?.toLowerCase() || "jpg";

        uploadedLogoPath = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("club-logos")
          .upload(uploadedLogoPath, form.logoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: form.logoFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("club-logos")
          .getPublicUrl(uploadedLogoPath);

        nextLogoUrl = publicUrlData?.publicUrl || null;
      }

      const { error } = await supabase.rpc(
        "update_managed_club",
        {
          p_club_id: editingClub.id,
          p_short_name: shortName,
          p_name: form.name.trim(),
          p_state: form.state.trim(),
          p_location: form.location.trim(),
          p_description: form.description.trim() || null,
          p_related_url: form.relatedUrl.trim() || null,
          p_logo_url: nextLogoUrl,
        },
      );

      if (error && uploadedLogoPath) {
        await supabase.storage
          .from("club-logos")
          .remove([uploadedLogoPath]);
      }

      if (error) throw error;

      const { error: deleteLocationsError } = await supabase
        .from("club_locations")
        .delete()
        .eq("club_id", editingClub.id);

      if (deleteLocationsError) {
        throw deleteLocationsError;
      }

      const locationRows = form.locations
        .map((venue, index) => ({
          club_id: editingClub.id,
          venue_name: venue.venueName.trim(),
          address: venue.address.trim(),
          map_url: venue.mapUrl.trim() || null,
          training_details:
            venue.trainingDetails.trim() || null,
          is_primary: index === 0,
        }))
        .filter(
          (venue) => venue.venue_name && venue.address,
        );

      if (locationRows.length > 0) {
        const { error: insertLocationsError } = await supabase
          .from("club_locations")
          .insert(locationRows);

        if (insertLocationsError) {
          throw insertLocationsError;
        }
      }

      const { error: playerProfileError } = await supabase
        .from("player_profiles")
        .update({ club: shortName })
        .eq("club", editingClub.shortName);

      if (playerProfileError) {
        console.warn(
          "Club updated, but some player profile club labels could not be refreshed:",
          playerProfileError,
        );
      }

      window.dispatchEvent(
        new CustomEvent("club-membership-updated"),
      );
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: { club: shortName },
        }),
      );

      setEditingClub(null);
      await fetchClubs();
      alert("Club details updated.");
    } catch (error) {
      console.error("Failed to update club:", error);
      alert(error.message || "Failed to update club.");
    } finally {
      setSavingClubEdit(false);
    }
  }

  async function deleteClub(club) {
    if (!club?.id || !club?.isOwner) {
      alert("Only the club owner can delete this club.");
      return;
    }

    const firstConfirm = window.confirm(
      `Delete ${club.shortName || club.name}? This will permanently remove the club, all memberships, join requests, invitations and club locations.`,
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "This action cannot be undone. Are you sure you want to permanently delete this club?",
    );

    if (!secondConfirm) return;

    setManageBusyId(`delete-${club.id}`);

    try {
      const { error } = await supabase.rpc(
        "delete_owned_club",
        {
          p_club_id: club.id,
        },
      );

      if (error) throw error;

      window.dispatchEvent(
        new CustomEvent("club-membership-updated"),
      );
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: { club: "" },
        }),
      );

      setOwnedClub(null);
      setSelectedClub(null);
      setRequests([]);
      setMembers([]);
      setInvitations([]);
      setInvitePlayers([]);
      setTab("find");

      await fetchClubs();
      alert("Club deleted successfully.");
    } catch (error) {
      console.error("Failed to delete club:", error);
      alert(error.message || "Failed to delete club.");
    } finally {
      setManageBusyId(null);
    }
  }

  async function toggleMembership(club) {
    try {
      const { error } = await supabase.rpc(
        "set_club_accepting_members",
        {
          p_club_id: club.id,
          p_accepting_members: !club.acceptingMembers,
        },
      );

      if (error) throw error;
      await fetchClubs();
    } catch (error) {
      alert(error.message || "Failed to update membership setting.");
    }
  }

  if (loading && !showLoader) return null;

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading clubs..." />
      </div>
    );
  }

  return (
    <div className={styles.playerReadablePage}>
      <div className={styles.pageHead} style={{ overflow: "visible" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <div className={styles.pageTitle}>Coach Clubs</div>
            <div className={styles.pageSub}>
              Join a club as a coach, or create and manage your own club
            </div>
          </div>

          <CoachNotificationBell
            supabase={supabase}
            mode="clubs"
            title="Club notifications"
          />
        </div>
      </div>

      <div className={styles.tabs} style={{ marginBottom: 16 }}>
        <button
          className={`${styles.tab} ${tab === "find" ? styles.tabActive : ""}`}
          onClick={() => setTab("find")}
        >
          Find clubs
        </button>


        <button
          className={`${styles.tab} ${
            tab === "manage" ? styles.tabActive : ""
          }`}
          onClick={() => setTab("manage")}
        >
          {acceptedClub ? "My club" : "Create club"}
        </button>
      </div>

      {tab === "find" && (
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search club, state or main area..."
                style={{ flex: 1, minWidth: 190 }}
              />

              <select
                className={styles.formSelect}
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                style={{ width: 150 }}
              >
                <option value="">All states</option>
                {states.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              {filteredClubs.length} club
              {filteredClubs.length === 1 ? "" : "s"} found
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredClubs.length === 0 ? (
                <div
                  className={styles.card}
                  style={{ textAlign: "center", padding: 40, color: C.muted }}
                >
                  No clubs match your search.
                </div>
              ) : (
                filteredClubs.map((club) => {
                  const isSelected = String(effectiveSelectedClub?.id || "").trim() === String(club.id || "").trim();

                  return (
                    <div
                      key={club.id}
                      onClick={() => setSelectedClub({ ...club, isInviteLink: false })}
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
                      {club.logoUrl ? (
                        <img
                          src={club.logoUrl}
                          alt=""
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div className={styles.av}>{club.init}</div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: C.text,
                          }}
                        >
                          {club.shortName
                            ? `${club.shortName} · ${club.name}`
                            : club.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: C.muted,
                            marginTop: 2,
                          }}
                        >
                          {club.location} · {club.state}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap",
                            marginTop: 6,
                          }}
                        >
                          <span className={styles.badgeBlue}>
                            {club.memberCount} member
                            {club.memberCount === 1 ? "" : "s"}
                          </span>
                          <StatusBadge
                status={club.membershipStatus}
                requestType={club.membershipRequestType}
              />
                          {club.isOwner && (
                            <span className={styles.badgeAmber}>Owner</span>
                          )}
                        </div>
                      </div>

                      {club.acceptingMembers ? (
                        <span className={styles.badgeGreen}>Open</span>
                      ) : (
                        <span className={styles.badgeGray}>Closed</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            {effectiveSelectedClub ? (
              <ClubDetail
                club={effectiveSelectedClub}
                actionId={actionId}
                acceptedClub={acceptedClub}
                onJoin={requestJoin}
                onCancel={cancelRequest}
                onLeave={leaveClub}
                onAcceptInvite={(club) =>
                  respondToClubInvitation(club, "accepted")
                }
                onDeclineInvite={(club) =>
                  respondToClubInvitation(club, "rejected")
                }
                onAcceptInviteLink={acceptClubInviteLink}
                onViewMember={openClubMemberProfile}
              />
            ) : (
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
                Select a club
              </div>
            )}
          </div>
        </div>
      )}


      {tab === "manage" &&
        (ownedClub ? (
          <ManageClub
            club={ownedClub}
            requests={requests}
            members={members}
            invitations={invitations}
            clubCoachRequests={clubCoachRequests}
            invitePlayers={invitePlayers}
            inviteBusyId={inviteBusyId}
            busyId={manageBusyId}
            onRespond={respondToRequest}
            onRespondClubCoachRequest={respondToClubCoachRequest}
            onSetClubCoachRole={setClubCoachRole}
            onRemoveMember={removeMember}
            onToggleMembership={toggleMembership}
            onInvitePlayer={invitePlayerToClub}
            onCancelInvitation={cancelClubInvitation}
            onCopyInviteLink={copyClubInviteLink}
            onViewPlayer={openClubMemberProfile}
            onEditClub={setEditingClub}
            onSetManagerRole={setManagerRole}
            onTransferOwnership={transferClubOwnership}
            onDeleteClub={deleteClub}
            onLeaveClub={leaveClub}
            leaveBusyId={actionId}
          />
        ) : acceptedClub ? (
          <>
          <ClubDetail
            club={acceptedClub}
            actionId={actionId}
            acceptedClub={acceptedClub}
            readOnly
            onJoin={requestJoin}
            onCancel={cancelRequest}
            onLeave={leaveClub}
            onAcceptInvite={(club) =>
              respondToClubInvitation(club, "accepted")
            }
            onDeclineInvite={(club) =>
              respondToClubInvitation(club, "rejected")
            }
            onAcceptInviteLink={acceptClubInviteLink}
            onViewMember={openClubMemberProfile}
          />

          {!acceptedClub.isOwner &&
            !acceptedClub.isManager && (
              <button
                type="button"
                className={styles.btnOutline}
                disabled={actionId === acceptedClub.id}
                onClick={() => leaveClub(acceptedClub)}
                style={{
                  width: "100%",
                  marginTop: 12,
                  color: "#DC2626",
                  borderColor: "#FECACA",
                  background: "#FEF2F2",
                }}
              >
                {actionId === acceptedClub.id
                  ? "Leaving..."
                  : "Leave club"}
              </button>
            )}

          {(() => {
            const ownMembership =
              acceptedClub?.members?.find(
                (member) =>
                  String(member.user_id) === String(currentUserId),
              ) || null;

            const hasCoachAccountRole = Boolean(
              ownMembership?.coachProfile,
            );

            if (
              !hasCoachAccountRole ||
              ownMembership?.isClubCoach ||
              ownMembership?.isOwner
            ) {
              return null;
            }

            return (
              <div className={styles.card}>
                <div className={styles.cardTitle}>Club Coach</div>

                {myClubCoachRequestStatus === "pending" ? (
                  <div style={{ fontSize: 13, color: C.muted }}>
                    Your Club Coach application is waiting for the club owner
                    to review it.
                  </div>
                ) : myClubCoachRequestStatus === "rejected" ? (
                  <>
                    <div
                      style={{
                        fontSize: 13,
                        color: C.muted,
                        marginBottom: 10,
                      }}
                    >
                      Your previous application was declined. You may apply
                      again if needed.
                    </div>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={clubCoachBusy}
                      onClick={applyForClubCoach}
                    >
                      {clubCoachBusy
                        ? "Applying..."
                        : "Apply for Club Coach"}
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 13,
                        color: C.muted,
                        marginBottom: 10,
                      }}
                    >
                      Only members with a ShuttleTrack Coach role can apply.
                      Approval is given by the club owner.
                    </div>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={clubCoachBusy}
                      onClick={applyForClubCoach}
                    >
                      {clubCoachBusy
                        ? "Applying..."
                        : "Apply for Club Coach"}
                    </button>
                  </>
                )}
              </div>
            );
          })()}
          </>
        ) : (
          <CreateClubForm submitting={creating} onCreate={createClub} />
        ))}

      {loadingMemberProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2999,
            background: "rgba(13,27,62,0.30)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className={styles.card} style={{ minWidth: 220 }}>
            <Loader text="Loading member profile..." />
          </div>
        </div>
      )}

      <ClubPlayerProfileModal
        member={selectedMemberProfile}
        onClose={() => setSelectedMemberProfile(null)}
      />

      <EditClubModal
        club={editingClub}
        saving={savingClubEdit}
        onClose={() => {
          if (!savingClubEdit) setEditingClub(null);
        }}
        onSave={updateClubDetails}
      />
    </div>
  );
}