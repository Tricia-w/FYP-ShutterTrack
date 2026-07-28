import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import styles from "../Layout/Pages.module.css";
import Loader from "../Loader/Loader";
import useLoadingDelay from "../Loader/LoadingDelay";

const CLUB_NOTIFICATION_TYPES = [
  "club_join_request",
  "club_request_cancelled",
  "club_request_accepted",
  "club_request_declined",
  "club_member_left",
  "club_member_removed",
];

const C = {
  text: "var(--text, #0D1B3E)",
  muted: "var(--text-muted, #8892A4)",
  card: "var(--card, #FFFFFF)",
  soft: "var(--soft, #F6F8FF)",
  line: "var(--line, #EEF1F8)",
};


const formatClubNotificationTime = value => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function ClubNotificationBell() {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return;

    setLoadingNotifications(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .in("type", CLUB_NOTIFICATION_TYPES)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Club notification load error:", error);
      setNotifications([]);
    } else {
      setNotifications(data || []);
    }

    setLoadingNotifications(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || cancelled) return;

      const channelName = `clubs-notifications-${user.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const nextChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => loadNotifications(),
        );

      channel = nextChannel;
      nextChannel.subscribe();
    };

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const closeOutside = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const unreadCount = notifications.filter(item => !item.is_read).length;

  const openNotification = async notification => {
    if (!notification.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      setNotifications(current =>
        current.map(item =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item,
        ),
      );
    }

    setOpen(false);

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const markAllRead = async event => {
    event.stopPropagation();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("type", CLUB_NOTIFICATION_TYPES)
      .eq("is_read", false);

    setNotifications(current =>
      current.map(item => ({ ...item, is_read: true })),
    );
  };

  const deleteNotification = async (event, id) => {
    event.stopPropagation();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      setNotifications(current =>
        current.filter(item => item.id !== id),
      );
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen(value => !value);
          loadNotifications();
        }}
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          border: `1px solid ${C.line}`,
          background: C.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          cursor: "pointer",
          position: "relative",
          boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 19,
              height: 19,
              padding: "0 5px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
            top: 54,
            right: 0,
            zIndex: 2000,
            width: "min(390px, calc(100vw - 28px))",
            maxHeight: 500,
            overflow: "hidden",
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 18,
            boxShadow: "0 22px 55px rgba(13,27,62,0.18)",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${C.line}`,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>
                Notifications
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {unreadCount} unread
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1A5FFF",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 430, overflowY: "auto" }}>
            {loadingNotifications ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: C.muted,
                  fontSize: 12,
                }}
              >
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: C.muted,
                  fontSize: 12,
                }}
              >
                No club notifications yet.
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNotification(notification)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openNotification(notification);
                    }
                  }}
                  style={{
                    position: "relative",
                    padding: "13px 44px 13px 16px",
                    borderBottom: `1px solid ${C.line}`,
                    background: notification.is_read
                      ? C.card
                      : "#F2F6FF",
                    cursor: "pointer",
                  }}
                >
                  <button
                    type="button"
                    onClick={event =>
                      deleteNotification(event, notification.id)
                    }
                    title="Delete notification"
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "#EF4444",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🔔</span>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: C.text,
                      }}
                    >
                      {notification.title || "Notification"}
                    </div>

                    {!notification.is_read && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#1A5FFF",
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: C.muted,
                      lineHeight: 1.5,
                    }}
                  >
                    {notification.message || ""}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: C.muted,
                    }}
                  >
                    {formatClubNotificationTime(notification.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
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

function StatusBadge({ status }) {
  if (status === "accepted") {
    return <span className={styles.badgeGreen}>Joined</span>;
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
          fontWeight: 800,
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
              fontWeight: 800,
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
                fontWeight: 800,
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
                      fontWeight: 800,
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
  fontWeight: 800,
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
  onJoin,
  onCancel,
  onLeave,
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

              <StatusBadge status={club.membershipStatus} />
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
                        fontWeight: 800,
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
                      fontWeight: 800,
                      color: C.text,
                    }}
                  >
                    {member.playerName}
                  </div>

                  <div style={{ fontSize: 11, color: C.muted }}>
                    {member.memberRole === "manager"
                      ? "Club manager"
                      : member.memberRole === "coach"
                        ? "Club coach"
                        : "Club player"}
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

      {club.isOwner ? (
        <div
          className={styles.card}
          style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}
        >
          <div className={styles.cardTitle}>You manage this club</div>
          Open the <strong>My club</strong> tab to review member requests
          and current members.
        </div>
      ) : club.membershipStatus === "accepted" ? (
        <button
          className={styles.btnOutline}
          disabled={busy}
          onClick={() => onLeave(club)}
          style={{
            width: "100%",
            color: "#DC2626",
            borderColor: "#FECACA",
            background: "#FEF2F2",
          }}
        >
          {busy ? "Leaving..." : "Leave club"}
        </button>
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
      )}
    </div>
  );
}


function ClubPlayerProfileModal({ member, onClose }) {
  if (!member) return null;

  const playerProfile = member.playerProfile || null;
  const coachProfile = member.coachProfile || null;

  const isCoachProfile =
    member.memberRole === "coach" ||
    member.memberRole === "manager";

  const activeProfile =
    isCoachProfile && coachProfile
      ? coachProfile
      : playerProfile || coachProfile || {};

  const displayName =
    activeProfile.display_name ||
    activeProfile.full_name ||
    activeProfile.name ||
    member.playerName ||
    member.member_name ||
    "Member";

  const state =
    activeProfile.state ||
    activeProfile.location ||
    activeProfile.coaching_state ||
    member.playerState ||
    "Not set";

  const clubRole =
    member.memberRole === "manager"
      ? "Club manager"
      : member.memberRole === "coach"
        ? "Club coach"
        : "Club player";

  const profileLabel = isCoachProfile
    ? "Coach profile"
    : "Player profile";

  const categoryLabel = isCoachProfile
    ? "Coaching level"
    : "Player category";

  const categoryValue = isCoachProfile
    ? coachProfile?.coaching_level ||
      coachProfile?.level ||
      coachProfile?.certification ||
      "Not set"
    : playerProfile?.player_category || "Not set";

  const avatarUrl =
    coachProfile?.avatar_url ||
    coachProfile?.profile_photo_url ||
    coachProfile?.photo_url ||
    playerProfile?.profile_photo_url ||
    member.playerAvatarUrl ||
    null;

  const experienceYears = Number(
    activeProfile.experience_years ??
    activeProfile.years_experience ??
    0,
  );

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
          width: "min(620px, 100%)",
          maxHeight: "86vh",
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
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${displayName} profile`}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                className={styles.av}
                style={{ width: 62, height: 62, fontSize: 18 }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>
                {displayName}
              </div>

              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {categoryValue}
                {isCoachProfile ? " Coach" : " Player"} · {state}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 5,
                  flexWrap: "wrap",
                  marginTop: 7,
                }}
              >
                <span className={styles.badgeBlue}>
                  {profileLabel}
                </span>

                <span className={styles.badgeGray}>
                  {clubRole}
                </span>
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
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
            paddingTop: 16,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <SmallInfo label={categoryLabel} value={categoryValue} />
          <SmallInfo label="State" value={state} />
          <SmallInfo label="Club role" value={clubRole} />

          {!isCoachProfile && (
            <SmallInfo
              label="Playing hand"
              value={playerProfile?.playing_hand || "Not set"}
            />
          )}

          <SmallInfo
            label="Experience"
            value={
              experienceYears > 0
                ? `${experienceYears} ${
                    experienceYears === 1 ? "year" : "years"
                  }`
                : "Not set"
            }
          />
        </div>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div className={styles.cardTitle}>
            {isCoachProfile ? "About coach" : "About player"}
          </div>

          <div
            style={{
              fontSize: 13,
              color: C.text,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {activeProfile.bio ||
              activeProfile.about ||
              activeProfile.description ||
              `This ${isCoachProfile ? "coach" : "player"} has not added a biography yet.`}
          </div>
        </div>

        {activeProfile.instagram && (
          <a
            href={`https://instagram.com/${String(
              activeProfile.instagram,
            ).replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              marginTop: 16,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#FFF0F6",
              border: "1px solid #FBC8DC",
              color: "#B5305A",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {activeProfile.instagram}
          </a>
        )}
      </div>
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
                fontWeight: 800,
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
                  fontWeight: 800,
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
                        fontWeight: 800,
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
  busyId,
  onRespond,
  onRemoveMember,
  onToggleMembership,
  onViewPlayer,
  onEditClub,
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
              {club.acceptingMembers
                ? "Stops new requests. Existing members stay in the club."
                : "Players can request to join again."}
            </div>
          </div>
        </div>
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
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
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
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                  {member.playerName}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {member.memberRole === "manager"
                    ? "Club manager"
                    : member.memberRole === "coach"
                      ? "Club coach"
                      : "Club member"}
                </div>
              </div>

              {!member.isOwner && (
                <button
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
          ))
        )}
      </div>
    </div>
  );
}

export default function Clubs() {
  const [tab, setTab] = useState("find");
  const [clubs, setClubs] = useState([]);
  const [selectedClub, setSelectedClub] = useState(null);
  const [ownedClub, setOwnedClub] = useState(null);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
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

  const fetchClubs = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

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
          .select("id, club_id, user_id, status, member_role, member_name")
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
                "user_id, display_name, state, player_category, profile_photo_url, playing_hand, experience_years, bio, instagram",
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

        const isCoachMember =
          membership.member_role === "coach" ||
          membership.member_role === "manager";

        const preferredProfile =
          isCoachMember && coachProfile
            ? coachProfile
            : playerProfile || coachProfile;

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
          isCoachMember && normalisedCoachProfile
            ? normalisedCoachProfile
            : playerProfile || normalisedCoachProfile;

        const member = {
          ...membership,
          playerName:
            normalisedPreferredProfile?.display_name ||
            membership.member_name ||
            "Member",
          playerState:
            normalisedPreferredProfile?.state ||
            "—",
          playerLevel:
            isCoachMember
              ? normalisedCoachProfile?.coaching_level || "Coach"
              : playerProfile?.player_category || "—",
          playerAvatarUrl:
            normalisedCoachProfile?.avatar_url ||
            playerProfile?.profile_photo_url ||
            null,
          playerProfile,
          coachProfile: normalisedCoachProfile,
          memberRole: membership.member_role || "player",
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
          isOwner: Boolean(user && club.owner_id === user.id),
          acceptingMembers: club.accepting_members !== false,
          memberCount: countByClub.get(club.id) || 0,
          membershipId: membership?.id || null,
          membershipStatus: membership?.status || null,
          members: membersByClubId.get(club.id) || [],
        };
      });

      const nextOwnedClub =
        formatted.find((club) => club.isOwner) || null;

      setClubs(formatted);
      setOwnedClub(nextOwnedClub);

      setSelectedClub((current) =>
        current
          ? formatted.find((club) => club.id === current.id) || null
          : null,
      );

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
            .select("user_id, display_name, state, player_category, profile_photo_url, playing_hand, experience_years, bio, instagram")
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
          const playerProfile = profilesByUserId.get(row.user_id) || null

          return {
            ...row,
            playerName:
              playerProfile?.display_name ||
              row.member_name ||
              (row.user_id === user?.id
                ? nextOwnedClub.ownerName
                : "Player"),
            playerState: playerProfile?.state || "—",
            playerLevel:
              playerProfile?.player_category ||
              "—",
            playerAvatarUrl: playerProfile?.profile_photo_url || null,
            playerProfile,
            isOwner: row.user_id === nextOwnedClub.ownerId,
            memberRole: row.member_role || "player",
          }
        });

        setRequests(
          formattedMemberships.filter((row) => row.status === "pending"),
        );
        setMembers(
          formattedMemberships.filter((row) => row.status === "accepted"),
        );
      } else {
        setRequests([]);
        setMembers([]);
      }
    } catch (error) {
      console.error("Failed to load clubs:", error);
      alert(error.message || "Failed to load clubs.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    }
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
      const [playerResult, coachResult, appUserResult] =
        await Promise.all([
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

      const playerProfile = playerResult.data || null;

      const isCoachMember =
        member.memberRole === "coach" ||
        member.memberRole === "manager" ||
        member.member_role === "coach" ||
        member.member_role === "manager";

      const preferredProfile =
        isCoachMember
          ? coachProfile || playerProfile
          : playerProfile || coachProfile;

      setSelectedMemberProfile({
        ...member,
        playerName:
          preferredProfile?.display_name ||
          appUserResult.data?.full_name ||
          appUserResult.data?.username ||
          member.playerName ||
          member.member_name ||
          "Member",
        playerState:
          preferredProfile?.state ||
          member.playerState ||
          "—",
        playerLevel:
          isCoachMember
            ? coachProfile?.coaching_level ||
              member.playerLevel ||
              "Coach"
            : playerProfile?.player_category ||
              member.playerLevel ||
              "—",
        playerAvatarUrl:
          coachProfile?.avatar_url ||
          playerProfile?.profile_photo_url ||
          member.playerAvatarUrl ||
          null,
        playerProfile,
        coachProfile,
        memberRole:
          member.memberRole ||
          member.member_role ||
          "player",
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

    if (ownedClub) {
      alert(`You already manage ${ownedClub.name}.`);
      setTab("manage");
      return;
    }

    setCreating(true);

    try {
      const { data: playerProfile } = await supabase
        .from("player_profiles")
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

    setActionId(club.id);

    try {
      const { data: ownProfile } = await supabase
        .from("player_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const memberName =
        ownProfile?.display_name ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Player";

      const { error } = await supabase
        .from("club_members")
        .upsert(
          {
            club_id: club.id,
            user_id: user.id,
            member_name: memberName,
            status: "pending",
            member_role: "player",
            requested_at: new Date().toISOString(),
            responded_at: null,
          },
          { onConflict: "club_id,user_id" },
        );

      if (error) throw error;

      await sendClubNotification({
        recipientUserId: club.ownerId,
        type: "club_join_request",
        title: "New club join request",
        message: `${memberName} requested to join ${club.shortName || club.name}.`,
        actionUrl: "/coach/clubs",
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
        .from("player_profiles")
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
        actionUrl: "/coach/clubs",
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

      const { error } = await supabase
        .from("club_members")
        .delete()
        .eq("club_id", club.id)
        .eq("user_id", user.id);

      if (error) throw error;

      await clearPlayerProfileClubIfMatching(
        user.id,
        club.shortName,
      );

      const { data: ownProfile } = await supabase
        .from("player_profiles")
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
        actionUrl: "/coach/clubs",
      });

      await fetchClubs();
      alert("You left the club.");
    } catch (error) {
      alert(error.message || "Failed to leave club.");
    } finally {
      setActionId(null);
    }
  }

  async function respondToRequest(request, status) {
    setManageBusyId(request.id);

    try {
      const { error } = await supabase
        .from("club_members")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", request.id)
        .eq("status", "pending");

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

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.playerName} from this club?`)) return;

    setManageBusyId(member.id);

    try {
      const { error } = await supabase
        .from("club_members")
        .delete()
        .eq("id", member.id);

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

      const { error } = await supabase
        .from("clubs")
        .update({
          short_name: shortName,
          name: form.name.trim(),
          state: form.state.trim(),
          location: form.location.trim(),
          description: form.description.trim() || null,
          related_url: form.relatedUrl.trim() || null,
          logo_url: nextLogoUrl,
        })
        .eq("id", editingClub.id);

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

  async function toggleMembership(club) {
    try {
      const { error } = await supabase
        .from("clubs")
        .update({ accepting_members: !club.acceptingMembers })
        .eq("id", club.id);

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
    <div>
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
            <div className={styles.pageTitle}>Clubs</div>
            <div className={styles.pageSub}>
              Discover, join, create and manage badminton clubs
            </div>
          </div>

          <ClubNotificationBell />
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
          {ownedClub ? "My club" : "Create club"}
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
                  const isSelected = selectedClub?.id === club.id;

                  return (
                    <div
                      key={club.id}
                      onClick={() => setSelectedClub(club)}
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
                            fontWeight: 800,
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
                          <StatusBadge status={club.membershipStatus} />
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
            {selectedClub ? (
              <ClubDetail
                club={selectedClub}
                actionId={actionId}
                onJoin={requestJoin}
                onCancel={cancelRequest}
                onLeave={leaveClub}
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
            busyId={manageBusyId}
            onRespond={respondToRequest}
            onRemoveMember={removeMember}
            onToggleMembership={toggleMembership}
            onViewPlayer={openClubMemberProfile}
            onEditClub={setEditingClub}
          />
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