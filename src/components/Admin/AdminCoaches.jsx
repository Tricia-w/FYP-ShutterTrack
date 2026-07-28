import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import {
  EmptyState,
  Modal,
  SectionHeader,
  TableCard,
  buttonBase,
  inputStyle,
} from "./AdminShared";

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Verified",
  "Rejected",
];

const normaliseStatus = (value) => {
  const status = String(value || "pending")
    .trim()
    .toLowerCase();

  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  return "Pending";
};

const normaliseSpecialties = (value) => {
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
};

const initials = (name = "") =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2) || "C";

const StatusBadge = ({ status }) => {
  const styles = {
    Pending: {
      background: "#FFF7ED",
      color: "#C2410C",
    },
    Verified: {
      background: "#DDF8F0",
      color: "#00976C",
    },
    Rejected: {
      background: "#FEE2E2",
      color: "#B91C1C",
    },
  };

  const current = styles[status] || styles.Pending;

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 10px",
        borderRadius: 999,
        background: current.background,
        color: current.color,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {status}
    </span>
  );
};

export default function AdminCoaches() {
  const [coaches, setCoaches] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const [decision, setDecision] = useState("");
  const [rejectionReason, setRejectionReason] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        publicCoachResult,
        profileResult,
        certificateResult,
        appUserResult,
      ] = await Promise.all([
        supabase.from("public_coaches").select("*"),
        supabase.from("coach_profiles").select("*"),
        supabase
          .from("coach_certifications")
          .select("*")
          .order("sort_order", {
            ascending: true,
          }),
        supabase
          .from("app_users")
          .select(
            "user_id, full_name, email, role, account_status"
          ),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (certificateResult.error) {
        console.error(
          "Unable to load additional certificates:",
          certificateResult.error
        );
      }

      if (appUserResult.error) {
        throw appUserResult.error;
      }

      if (publicCoachResult.error) {
        console.warn(
          "public_coaches view was not available. Falling back to coach_profiles:",
          publicCoachResult.error
        );
      }

      const publicRows =
        publicCoachResult.data || [];
      const profileRows = profileResult.data || [];
      const certificateRows =
        certificateResult.data || [];
      const appUsers = appUserResult.data || [];

      const publicByUser = new Map(
        publicRows
          .filter((row) => row.user_id)
          .map((row) => [
            String(row.user_id),
            row,
          ])
      );

      const profileByUser = new Map(
        profileRows
          .filter((row) => row.user_id)
          .map((row) => [
            String(row.user_id),
            row,
          ])
      );

      const appUserById = new Map(
        appUsers
          .filter((row) => row.user_id)
          .map((row) => [
            String(row.user_id),
            row,
          ])
      );

      const certificatesByCoach = new Map();

      certificateRows.forEach((certificate) => {
        const key = String(
          certificate.coach_user_id || ""
        );

        if (!key) return;

        const current =
          certificatesByCoach.get(key) || [];

        current.push(certificate);
        certificatesByCoach.set(key, current);
      });

      const userIds = new Set([
        ...profileRows
          .map((row) => row.user_id)
          .filter(Boolean)
          .map(String),
        ...publicRows
          .map((row) => row.user_id)
          .filter(Boolean)
          .map(String),
        ...appUsers
          .filter(
            (row) =>
              String(row.role || "")
                .toLowerCase() === "coach"
          )
          .map((row) => String(row.user_id)),
      ]);

      const formatted = [...userIds]
        .map((userId) => {
          const publicCoach =
            publicByUser.get(userId) || {};
          const profile =
            profileByUser.get(userId) || {};
          const appUser =
            appUserById.get(userId) || {};

          const source = {
            ...appUser,
            ...profile,
            ...publicCoach,
          };

          const extraCertificates =
            certificatesByCoach.get(userId) ||
            [];

          const mainCertificate =
            source.certification_file_url
              ? {
                  id: "main",
                  name:
                    source.certification ||
                    "Main coaching certificate",
                  issuer:
                    source.certification_issuer ||
                    "",
                  fileUrl:
                    source.certification_file_url,
                }
              : null;

          const certificates = [
            ...(mainCertificate
              ? [mainCertificate]
              : []),
            ...extraCertificates
              .filter(
                (certificate) =>
                  certificate.file_url
              )
              .map((certificate) => ({
                id: certificate.id,
                name:
                  certificate.certificate_name ||
                  "Coaching certificate",
                issuer: certificate.issuer || "",
                fileUrl: certificate.file_url,
              })),
          ];

          return {
            id:
              profile.id ||
              publicCoach.id ||
              userId,
            userId,
            name:
              source.display_name ||
              appUser.full_name ||
              appUser.email ||
              "Unknown coach",
            email: appUser.email || "—",
            avatarUrl:
              source.avatar_url || null,
            club: source.club || "—",
            state:
              source.state ||
              source.location ||
              "—",
            coachingLevel:
              source.coaching_level ||
              "Community Coach",
            specialties:
              normaliseSpecialties(
                source.specialties
              ),
            experienceYears: Number(
              source.experience_years ??
                source.years_experience ??
                0
            ),
            status: normaliseStatus(
              profile.verification_status ||
                source.verification_status
            ),
            verifiedAt:
              profile.verified_at || null,
            rejectionReason:
              profile.rejection_reason || "",
            certificates,
            accountStatus:
              appUser.account_status ||
              "active",
          };
        })
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        );

      setCoaches(formatted);

      setSelected((current) =>
        current
          ? formatted.find(
              (coach) =>
                coach.userId === current.userId
            ) || null
          : null
      );
    } catch (error) {
      console.error(
        "Unable to load coaches:",
        error
      );
      setErrorMessage(
        error.message ||
          "Unable to load coach verification records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  useEffect(() => {
    const channel = supabase
      .channel(
        `admin-coach-verification-${Date.now()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coach_profiles",
        },
        loadCoaches
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coach_certifications",
        },
        loadCoaches
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCoaches]);

  const counts = useMemo(
    () => ({
      All: coaches.length,
      Pending: coaches.filter(
        (coach) =>
          coach.status === "Pending"
      ).length,
      Verified: coaches.filter(
        (coach) =>
          coach.status === "Verified"
      ).length,
      Rejected: coaches.filter(
        (coach) =>
          coach.status === "Rejected"
      ).length,
    }),
    [coaches]
  );

  const visibleCoaches = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return coaches.filter((coach) => {
      const matchesStatus =
        filter === "All" ||
        coach.status === filter;

      const matchesSearch =
        !query ||
        [
          coach.name,
          coach.email,
          coach.club,
          coach.state,
          coach.coachingLevel,
          ...coach.specialties,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      return matchesStatus && matchesSearch;
    });
  }, [coaches, filter, search]);

  const beginDecision = (nextDecision) => {
    if (!selected) return;

    setDecision(nextDecision);
    setRejectionReason(
      nextDecision === "Rejected"
        ? selected.rejectionReason || ""
        : ""
    );
    setErrorMessage("");
  };

  const saveDecision = async () => {
    if (!selected || !decision) return;

    if (
      decision === "Rejected" &&
      !rejectionReason.trim()
    ) {
      setErrorMessage(
        "Please enter a rejection reason."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user: adminUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!adminUser?.id) {
        throw new Error(
          "Please log in as an administrator again."
        );
      }

      const payload =
        decision === "Verified"
          ? {
              verification_status: "verified",
              verified_at:
                new Date().toISOString(),
              verified_by: adminUser.id,
              rejection_reason: null,
            }
          : {
              verification_status: "rejected",
              verified_at: null,
              verified_by: adminUser.id,
              rejection_reason:
                rejectionReason.trim(),
            };

      const { error } = await supabase
        .from("coach_profiles")
        .update(payload)
        .eq("user_id", selected.userId);

      if (error) throw error;

      const coachName = selected.name;
      const savedDecision = decision;

      setSelected(null);
      setDecision("");
      setRejectionReason("");

      await loadCoaches();

      setSuccessMessage(
        `${coachName} was marked as ${savedDecision}. The action was added to Activity Logs automatically.`
      );
    } catch (error) {
      console.error(
        "Unable to update coach verification:",
        error
      );
      setErrorMessage(
        error.message ||
          "Unable to update coach verification."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Coach Verification"
        subtitle="Review coach profiles and uploaded coaching certifications"
        action={
          <button
            type="button"
            onClick={loadCoaches}
            disabled={loading}
            style={{
              ...buttonBase,
              padding: "10px 16px",
              background: "#1A5FFF",
              color: "#FFFFFF",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh coaches"}
          </button>
        }
      />

      {errorMessage && !decision && (
        <div
          style={{
            marginBottom: 14,
            padding: 13,
            borderRadius: 11,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            fontSize: 12,
          }}
        >
          {errorMessage}
        </div>
      )}

      <TableCard>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "18px 20px",
            borderBottom:
              "1px solid #EEF1F8",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  setFilter(status)
                }
                style={{
                  ...buttonBase,
                  padding: "9px 15px",
                  border:
                    filter === status
                      ? "1.5px solid #0D1B3E"
                      : "1.5px solid #DDE3EF",
                  background:
                    filter === status
                      ? "#0D1B3E"
                      : "#FFFFFF",
                  color:
                    filter === status
                      ? "#FFFFFF"
                      : "#6B7280",
                }}
              >
                {status} · {counts[status]}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search coach, email, club..."
            style={{
              ...inputStyle,
              width: 330,
              maxWidth: "100%",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
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
                  borderBottom:
                    "2px solid #EEF1F8",
                  background: "#F8FAFF",
                }}
              >
                {[
                  "Coach",
                  "Club / State",
                  "Level",
                  "Specialisation",
                  "Experience",
                  "Certificates",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      color: "#71809A",
                      textTransform:
                        "uppercase",
                      letterSpacing: 0.3,
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: 38,
                      textAlign: "center",
                      color: "#8892A4",
                    }}
                  >
                    Loading coaches...
                  </td>
                </tr>
              ) : visibleCoaches.length ===
                0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState text="No coaches found." />
                  </td>
                </tr>
              ) : (
                visibleCoaches.map(
                  (coach, index) => (
                    <tr
                      key={coach.userId}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelected(coach);
                        setDecision("");
                        setRejectionReason("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(coach);
                          setDecision("");
                          setRejectionReason("");
                        }
                      }}
                      title={`Review ${coach.name}`}
                      style={{
                        borderBottom:
                          index <
                          visibleCoaches.length -
                            1
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
                          padding:
                            "15px 16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: 11,
                          }}
                        >
                          {coach.avatarUrl ? (
                            <img
                              src={
                                coach.avatarUrl
                              }
                              alt=""
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius:
                                  "50%",
                                objectFit:
                                  "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius:
                                  "50%",
                                background:
                                  "#E0F2FE",
                                color:
                                  "#0891B2",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                fontWeight:
                                  900,
                                fontSize: 12,
                              }}
                            >
                              {initials(
                                coach.name
                              )}
                            </div>
                          )}

                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight:
                                  800,
                                color:
                                  "#0D1B3E",
                              }}
                            >
                              {coach.name}
                            </div>
                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 11,
                                color:
                                  "#8892A4",
                              }}
                            >
                              {coach.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          padding:
                            "15px 16px",
                          fontSize: 12,
                        }}
                      >
                        {coach.club} ·{" "}
                        {coach.state}
                      </td>

                      <td
                        style={{
                          padding:
                            "15px 16px",
                          fontSize: 12,
                        }}
                      >
                        {
                          coach.coachingLevel
                        }
                      </td>

                      <td
                        style={{
                          padding:
                            "15px 16px",
                          fontSize: 12,
                          maxWidth: 300,
                        }}
                      >
                        {coach.specialties
                          .length
                          ? coach.specialties.join(
                              ", "
                            )
                          : "—"}
                      </td>

                      <td
                        style={{
                          padding:
                            "15px 16px",
                          fontSize: 12,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          coach.experienceYears
                        }{" "}
                        year
                        {coach.experienceYears ===
                        1
                          ? ""
                          : "s"}
                      </td>

                      <td
                        style={{
                          padding:
                            "15px 16px",
                          fontSize: 12,
                          textAlign:
                            "center",
                        }}
                      >
                        {
                          coach.certificates
                            .length
                        }
                      </td>

                      <td
                        style={{
                          padding:
                            "15px 16px",
                        }}
                      >
                        <StatusBadge
                          status={
                            coach.status
                          }
                        />
                      </td>

                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </TableCard>

      {selected && !decision && (
        <Modal
          title="Review coach verification"
          onClose={() =>
            setSelected(null)
          }
          maxWidth={700}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {[
              ["Coach", selected.name],
              ["Email", selected.email],
              [
                "Club / State",
                `${selected.club} · ${selected.state}`,
              ],
              [
                "Coaching level",
                selected.coachingLevel,
              ],
              [
                "Experience",
                `${selected.experienceYears} year${
                  selected.experienceYears ===
                  1
                    ? ""
                    : "s"
                }`,
              ],
              [
                "Account status",
                selected.accountStatus,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 13,
                  borderRadius: 11,
                  border:
                    "1px solid #E5EAF3",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#8892A4",
                    fontWeight: 800,
                    textTransform:
                      "uppercase",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 13,
                    color: "#0D1B3E",
                    fontWeight: 700,
                  }}
                >
                  {value || "—"}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 12,
              background: "#F8FAFF",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#6B7280",
                textTransform:
                  "uppercase",
              }}
            >
              Specialisation
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {selected.specialties.length
                ? selected.specialties.join(
                    ", "
                  )
                : "No specialisation provided."}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 9,
              }}
            >
              Certificates (
              {selected.certificates.length})
            </div>

            {selected.certificates.length ===
            0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 11,
                  background: "#FFF7ED",
                  color: "#9A3412",
                  fontSize: 12,
                }}
              >
                No certificate file was uploaded.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {selected.certificates.map(
                  (certificate) => (
                    <a
                      key={certificate.id}
                      href={
                        certificate.fileUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 12,
                        padding: 12,
                        borderRadius: 11,
                        border:
                          "1px solid #DDE3EF",
                        color: "#1A5FFF",
                        textDecoration:
                          "none",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <span>
                        {certificate.name}
                        {certificate.issuer
                          ? ` · ${certificate.issuer}`
                          : ""}
                      </span>
                      <span>Open ↗</span>
                    </a>
                  )
                )}
              </div>
            )}
          </div>

          {selected.status ===
            "Rejected" &&
            selected.rejectionReason && (
              <div
                style={{
                  marginTop: 14,
                  padding: 13,
                  borderRadius: 11,
                  background: "#FEF2F2",
                  color: "#B91C1C",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                Previous rejection reason:{" "}
                {selected.rejectionReason}
              </div>
            )}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              gap: 8,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={() =>
                beginDecision("Rejected")
              }
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background: "#FEE2E2",
                color: "#B91C1C",
              }}
            >
              Reject
            </button>

            <button
              type="button"
              onClick={() =>
                beginDecision("Verified")
              }
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background: "#00976C",
                color: "#FFFFFF",
              }}
            >
              Verify coach
            </button>
          </div>
        </Modal>
      )}

      {selected && decision && (
        <Modal
          title={`Confirm ${decision.toLowerCase()}`}
          onClose={() => {
            if (!saving) {
              setDecision("");
              setErrorMessage("");
            }
          }}
          maxWidth={500}
        >
          <p
            style={{
              marginTop: 0,
              color: "#6B7280",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {decision === "Verified"
              ? `${selected.name} will be shown as a verified coach.`
              : `${selected.name} will be marked as rejected.`}
          </p>

          {decision === "Rejected" && (
            <textarea
              rows={4}
              maxLength={1000}
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(
                  event.target.value
                )
              }
              placeholder="Enter the rejection reason..."
              style={{
                ...inputStyle,
                width: "100%",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          )}

          {errorMessage && (
            <div
              style={{
                marginTop: 10,
                padding: 11,
                borderRadius: 10,
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
              display: "flex",
              justifyContent:
                "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDecision("");
                setErrorMessage("");
              }}
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background: "#F3F4F6",
                color: "#6B7280",
              }}
            >
              Go back
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={saveDecision}
              style={{
                ...buttonBase,
                padding: "10px 15px",
                background:
                  decision === "Verified"
                    ? "#00976C"
                    : "#DC2626",
                color: "#FFFFFF",
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : `Confirm ${decision.toLowerCase()}`}
            </button>
          </div>
        </Modal>
      )}

      {successMessage && (
        <Modal
          title="Coach updated"
          onClose={() =>
            setSuccessMessage("")
          }
          maxWidth={450}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 11,
              background: "#ECFDF5",
              color: "#047857",
              lineHeight: 1.55,
              fontSize: 13,
            }}
          >
            {successMessage}
          </div>
        </Modal>
      )}
    </>
  );
}