import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AtSign,
  Ban,
  BarChart3,
  DoorOpen,
  Flag,
  Gavel,
  HeartHandshake,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  UserPlus,
  UserRound,
  Users
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import {
  chatProfileSchema,
  genders,
  vietnamLocations,
  type AdminOverview,
  type AdminReportSummary,
  type AdminUserSummary,
  type ChatProfile,
  type ModerationAction,
  type PublicParticipant,
  type ReportReason
} from "@chatandanh/shared";
import {
  apiBaseUrl,
  blockParticipant,
  cancelMatching,
  createAnonymousSession,
  createModerationAction,
  getAdminOverview,
  getAdminReports,
  getAdminUsers,
  getMessages,
  getProfile,
  loginWithEmail,
  logoutSession,
  reportConversation,
  registerWithEmail,
  startMatching,
  updateProfile
} from "../lib/api";
import { useSessionStore } from "./session-store";

const genderLabels: Record<ChatProfile["gender"], string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác"
};

const locations = ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Cần Thơ", "Hải Phòng", "Đà Lạt", "Khu vực khác"];
type AuthMode = "login" | "register";

export function App() {
  const {
    accessToken,
    displayAlias,
    role,
    profile,
    conversationId,
    participant,
    messages,
    milestone,
    setSession,
    setProfile,
    setConversation,
    addMessage,
    setMessages,
    setMilestone,
    resetConversation,
    clearSession
  } = useSessionStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Sẵn sàng bắt đầu một phiên chat ẩn danh.");
  const [matching, setMatching] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  // Advanced filters state for matching
  const [matchingRequestId, setMatchingRequestId] = useState<string | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [enableAgeFilter, setEnableAgeFilter] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(30);

  const [enableGenderFilter, setEnableGenderFilter] = useState(false);
  const [filterGenders, setFilterGenders] = useState<ChatProfile["gender"][]>(["male", "female", "other"]);

  const [enableLocationFilter, setEnableLocationFilter] = useState(false);
  const [filterLocations, setFilterLocations] = useState<string[]>([]);
  const [locInput, setLocInput] = useState("");
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);
  const [composer, setComposer] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("Mây");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminReports, setAdminReports] = useState<AdminReportSummary[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // States for editing profile in the unified Settings Dialog
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState(20);
  const [editGender, setEditGender] = useState<ChatProfile["gender"]>("other");
  const [editLocation, setEditLocation] = useState("Khu vực khác");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"profile" | "filter">("profile");
  const [infoOpen, setInfoOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const nextSocket = io(apiBaseUrl(), {
      auth: { token: accessToken },
      transports: ["websocket"]
    });

    nextSocket.on("socket:ready", () => setStatus("Đã kết nối realtime."));
    nextSocket.on("matching:paired", async (payload: { conversationId: string; participant: PublicParticipant }) => {
      setMatching(false);
      setMatchingRequestId(null);
      setConversation(payload.conversationId, payload.participant);
      nextSocket.emit("conversation:join", { conversationId: payload.conversationId });
      const history = await getMessages(accessToken, payload.conversationId);
      setMessages(history.items);
      setStatus(`Đã ghép với ${payload.participant.alias}.`);
    });
    nextSocket.on("message:new", addMessage);
    nextSocket.on("engagement:milestone", setMilestone);
    nextSocket.on("conversation:ended", () => {
      resetConversation();
      setMatching(false);
      setStatus("Cuộc trò chuyện đã kết thúc. Bạn có thể tìm người mới.");
    });
    nextSocket.on("moderation:warning", (payload: { message: string }) => setStatus(payload.message));
    nextSocket.on("stats:online", (payload: { count: number }) => setOnlineCount(payload.count));
    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [accessToken, addMessage, resetConversation, setConversation, setMessages, setMilestone]);

  useEffect(() => {
    if (!accessToken || profile) {
      return;
    }

    let active = true;
    void getProfile(accessToken)
      .then((result) => {
        if (active && result.profile) {
          setProfile(result.profile);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [accessToken, profile, setProfile]);

  useEffect(() => {
    if (!accessToken || (role !== "admin" && role !== "moderator")) {
      return;
    }
    setAdminOpen(true);
    void loadAdminDashboard(accessToken);
  }, [accessToken, role]);

  async function handleStartGuest() {
    setStatus("Đang tạo phiên ẩn danh...");
    const defaultProfile: ChatProfile = {
      displayName: "Người lạ",
      age: 20,
      location: "Khu vực khác",
      gender: "other",
      desiredGenders: ["male", "female", "other"]
    };
    const session = await createAnonymousSession(defaultProfile);
    setSession({
      accessToken: session.accessToken,
      displayAlias: session.displayAlias,
      avatarKey: session.avatarKey,
      role: "user",
      profile: defaultProfile
    });
    setProfile(defaultProfile);
    setStatus("Đã kết nối ẩn danh.");
  }

  async function handleProfileSubmit(nextProfile: ChatProfile) {
    const parsed = chatProfileSchema.parse(nextProfile);
    if (!accessToken) {
      const session = await createAnonymousSession(parsed);
      setSession({
        accessToken: session.accessToken,
        displayAlias: session.displayAlias,
        avatarKey: session.avatarKey,
        role: "user",
        profile: parsed
      });
      setStatus("Hồ sơ đã sẵn sàng. Bạn có thể tìm người lạ.");
      return;
    }
    await updateProfile(accessToken, parsed);
    setProfile(parsed);
    setStatus("Đã lưu hồ sơ. Tìm người lạ thôi.");
  }

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName);
      setEditAge(profile.age);
      setEditGender(profile.gender);
      setEditLocation(profile.location);
    }
  }, [profile, filterModalOpen]);

  async function handleSaveSettings() {
    try {
      const updatedProfile: ChatProfile = {
        displayName: editName.trim() || "Người lạ",
        age: editAge,
        gender: editGender,
        location: editLocation,
        desiredGenders: profile?.desiredGenders ?? ["male", "female", "other"]
      };
      await handleProfileSubmit(updatedProfile);
      setFilterModalOpen(false);
      setStatus("Đã lưu thông tin cài đặt.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Không lưu được cài đặt.");
    }
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const email = authEmail.trim();
      const password = authPassword;
      const response =
        authMode === "register"
          ? await registerWithEmail({
              email,
              password,
              displayName: authDisplayName.trim() || email.split("@")[0] || "Bạn mới"
            })
          : await loginWithEmail({ email, password });

      setSession({
        accessToken: response.accessToken,
        displayAlias: response.account.displayName,
        avatarKey: "avatar_registered",
        role: response.account.role
      });
      const profileResult = await getProfile(response.accessToken);
      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setStatus(response.account.role === "admin" || response.account.role === "moderator" ? "Đã đăng nhập khu vực quản trị." : "Đã đăng nhập. Bạn có thể tìm người lạ.");
      } else {
        setStatus(response.account.role === "admin" || response.account.role === "moderator" ? "Đã đăng nhập khu vực quản trị." : "Đã đăng nhập. Hoàn tất hồ sơ nhanh để bắt đầu.");
      }
      if (response.account.role === "admin" || response.account.role === "moderator") {
        setAdminOpen(true);
        void loadAdminDashboard(response.accessToken);
      }
      setAuthOpen(false);
      setAuthPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Không đăng nhập được.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutSession();
    } catch {
      // Local logout still clears the current browser session.
    }
    socket?.disconnect();
    clearSession();
    setAdminOpen(false);
    setAdminOverview(null);
    setAdminReports([]);
    setAdminUsers([]);
    setAuthPassword("");
    setStatus("Đã đăng xuất. Vui lòng đăng nhập để tiếp tục.");
  }

  async function handleDesiredGendersChange(nextDesiredGenders: ChatProfile["desiredGenders"]) {
    if (!profile || !accessToken) {
      return;
    }
    const nextProfile = { ...profile, desiredGenders: nextDesiredGenders };
    setProfile(nextProfile);
    setSavingPreference(true);
    try {
      await updateProfile(accessToken, nextProfile);
      setStatus("Đã cập nhật giới tính muốn gặp.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không lưu được lựa chọn giới tính.");
    } finally {
      setSavingPreference(false);
    }
  }

  async function handleMatch() {
    if (!accessToken || !profile) {
      setStatus("Vui lòng tạo phiên và hoàn tất hồ sơ trước khi tìm người lạ.");
      return;
    }
    setMatching(true);
    setStatus("Đang tìm người phù hợp...");
    try {
      const preferences = {
        desiredGenders: enableGenderFilter ? filterGenders : profile.desiredGenders,
        strictGenderMatch: true,
        enableAgeFilter,
        ageRange: enableAgeFilter ? { min: Number(ageMin), max: Number(ageMax) } : undefined,
        enableGenderFilter,
        enableLocationFilter,
        desiredLocations: enableLocationFilter ? filterLocations : undefined
      };
      const result = await startMatching(accessToken, preferences);
      setMatchingRequestId(result.requestId);
      if (result.status === "queued") {
        setStatus("Đang tìm bạn chat...");
      } else if (result.status === "paired") {
        setMatching(false);
        setStatus("Đã ghép đôi!");
      }
    } catch (error) {
      setMatching(false);
      setStatus(error instanceof Error ? error.message : "Không thể bắt đầu tìm kiếm.");
    }
  }

  async function handleCancelMatch() {
    if (!accessToken) return;
    setStatus("Đang dừng tìm...");
    try {
      if (matchingRequestId) {
        await cancelMatching(accessToken, matchingRequestId);
      }
      setMatching(false);
      setMatchingRequestId(null);
      setStatus("Đã dừng tìm bạn. Bạn có thể tìm lại bất kỳ lúc nào.");
    } catch (error) {
      setMatching(false);
      setMatchingRequestId(null);
      setStatus("Đã dừng tìm bạn.");
    }
  }

  function sendMessage() {
    if (!socket || !conversationId || !composer.trim()) {
      return;
    }
    socket.emit("message:send", {
      conversationId,
      clientMessageId: createClientId(),
      body: composer
    });
    setComposer("");
  }

  function endConversation(next = false) {
    if (socket && conversationId) {
      socket.emit("conversation:end", { conversationId, reason: next ? "next_partner" : "user_left" });
    }
    if (next) {
      window.setTimeout(() => void handleMatch(), 300);
    }
  }

  async function handleReport(reason: ReportReason) {
    if (!accessToken || !conversationId) {
      return;
    }
    await reportConversation(accessToken, {
      conversationId,
      targetParticipantId: participant?.participantId,
      reason,
      note: "Báo cáo từ giao diện MVP"
    });
    setReportOpen(false);
    setStatus("Đã gửi báo cáo. Cảm ơn bạn đã giúp giữ cộng đồng an toàn.");
  }

  async function handleBlock() {
    if (!accessToken || !conversationId || !participant) {
      return;
    }
    await blockParticipant(accessToken, {
      conversationId,
      targetParticipantId: participant.participantId,
      reason: "user_blocked"
    });
    endConversation(false);
    setStatus("Đã chặn người này. Hai bạn sẽ không được ghép lại.");
  }

  async function loadAdminDashboard(token = accessToken) {
    if (!token) {
      setStatus("Cần đăng nhập bằng tài khoản admin để xem dashboard.");
      return;
    }
    try {
      setAdminLoading(true);
      const [overview, reports, users] = await Promise.all([
        getAdminOverview(token),
        getAdminReports(token),
        getAdminUsers(token)
      ]);
      setAdminOverview(overview);
      setAdminReports(reports.items);
      setAdminUsers(users.items);
      setStatus("Đã tải dashboard quản trị.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không tải được dashboard quản trị.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleModerationAction(
    action: ModerationAction,
    payload: { reportId?: string; targetSessionId?: string; durationMinutes?: number; note?: string }
  ) {
    if (!accessToken) {
      return;
    }
    try {
      await createModerationAction(accessToken, { action, ...payload });
      setStatus("Đã ghi nhận thao tác quản trị.");
      await loadAdminDashboard(accessToken);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không xử lý được report.");
    }
  }

  const isStaff = role === "admin" || role === "moderator";

  const currentStep = useMemo(() => {
    if (!accessToken) return "guest";
    if (isStaff && (adminOpen || !profile)) return "admin";
    if (!profile) return "profile";
    if (conversationId) return "chat";
    return "match";
  }, [accessToken, adminOpen, conversationId, isStaff, profile]);

  if (currentStep === "guest") {
    return (
      <div className="landing-container">
        <div className="landing-center-box">
          <div className="landing-logo">
            <span className="logo-icon">🕵️</span>
            <h1 className="logo-text">ẨN DANH</h1>
          </div>
          <p className="landing-subtitle">Trò chuyện & kết bạn với người lạ</p>

          <p className="landing-warning">
            Bằng việc đăng ký tài khoản, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của chúng tôi.
          </p>

          <div className="landing-actions">
            <button className="btn-landing-start" onClick={() => { setAuthMode("register"); setAuthOpen(true); }}>
              Đăng ký tài khoản
            </button>
            <button className="btn-landing-login" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>
              Đăng nhập Email
            </button>
          </div>

          <footer className="landing-footer">
            <button className="btn-footer-link" onClick={() => setInfoOpen(true)}>
              Tìm hiểu thêm
            </button>
            <span className="footer-divider">•</span>
            <a href="https://cvnl.app/tos/" target="_blank" rel="noreferrer" className="btn-footer-link">
              Điều khoản dịch vụ
            </a>
          </footer>
        </div>

        {authOpen && (
          <div className="modal-backdrop">
            <div className="auth-dialog">
              <AuthPanel
                accessToken={accessToken}
                displayAlias={displayAlias}
                profile={profile}
                authMode={authMode}
                authEmail={authEmail}
                authPassword={authPassword}
                authDisplayName={authDisplayName}
                authBusy={authBusy}
                authError={authError}
                onAuthModeChange={setAuthMode}
                onEmailChange={setAuthEmail}
                onPasswordChange={setAuthPassword}
                onDisplayNameChange={setAuthDisplayName}
                onAuthSubmit={(event) => void handleAuthSubmit(event)}
                onLogout={() => void handleLogout()}
              />
              <button className="ghost-button full-width" onClick={() => setAuthOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        )}

        {infoOpen && (
          <div className="modal-backdrop">
            <div className="dialog cvnl-info-dialog">
              <h2>Chat Ẩn Danh bảo mật & tự do</h2>
              <div className="info-dialog-content">
                <ul>
                  <li><strong>KHÔNG</strong> cần đăng ký tài khoản ban đầu</li>
                  <li><strong>KHÔNG</strong> yêu cầu định danh thật</li>
                  <li><strong>KHÔNG</strong> lưu trữ vĩnh viễn nội dung tin nhắn</li>
                </ul>
                <p>Mọi dữ liệu trò chuyện đều tự động hủy ngay khi một trong hai người bấm kết thúc cuộc chat.</p>
              </div>
              <button className="primary-button full-width" onClick={() => setInfoOpen(false)}>
                Tôi đã hiểu
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="app-shell">
      <aside className="app-rail" aria-label="Điều hướng nhanh">
        <div className="rail-logo">ẩn<br />danh</div>
        <button className={`rail-button ${currentStep !== "admin" ? "active" : ""}`} title="Chat" onClick={() => setAdminOpen(false)}><MessageCircle size={20} /></button>
        <button className="rail-button" title="Ghép ngẫu nhiên"><Shuffle size={20} /></button>
        <button className="rail-button" title="An toàn"><ShieldAlert size={20} /></button>
        {isStaff && (
          <button
            className={`rail-button ${currentStep === "admin" ? "active" : ""}`}
            title="Quản trị"
            onClick={() => {
              setAdminOpen(true);
              void loadAdminDashboard();
            }}
          >
            <BarChart3 size={20} />
          </button>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="login-button"
              onClick={accessToken ? () => void handleLogout() : () => setAuthOpen(true)}
            >
              {accessToken ? <LogOut size={16} /> : <LogIn size={16} />}
              {accessToken ? "Đăng xuất" : "Đăng nhập"}
            </button>
          </div>
          <div className="brand-mark">
            <span>Chat Ẩn Danh</span>
            <small>{onlineCount} người đang online</small>
          </div>
          <div className="topbar-actions">
            {isStaff && (
              <button
                className="admin-button"
                onClick={() => {
                  setAdminOpen(true);
                  void loadAdminDashboard();
                }}
              >
                <ShieldCheck size={16} />
                Quản trị
              </button>
            )}
            <div className="session-pill" title={profile?.displayName ?? displayAlias ?? "Khách mới"}>
              <UserRound size={16} />
              <span>{profile?.displayName ?? displayAlias ?? "Khách mới"}</span>
            </div>
          </div>
        </header>

        <div className="status-line">{status}</div>

        <div className="main-grid">
          <section className="primary-panel">
            {currentStep === "profile" && <ProfileSetup onSubmit={handleProfileSubmit} />}

            {currentStep === "match" && (
              <MatchingPanel
                displayAlias={profile?.displayName ?? displayAlias}
                matching={matching}
                onMatch={handleMatch}
                onCancelMatch={handleCancelMatch}
                onOpenFilters={() => setFilterModalOpen(true)}
                enableAgeFilter={enableAgeFilter}
                ageMin={ageMin}
                ageMax={ageMax}
                enableGenderFilter={enableGenderFilter}
                filterGenders={filterGenders}
                enableLocationFilter={enableLocationFilter}
                filterLocations={filterLocations}
              />
            )}

            {currentStep === "admin" && (
              <AdminDashboard
                overview={adminOverview}
                reports={adminReports}
                users={adminUsers}
                loading={adminLoading}
                onRefresh={() => void loadAdminDashboard()}
                onAction={(action, payload) => void handleModerationAction(action, payload)}
              />
            )}

            {currentStep === "chat" && conversationId && participant && (
              <ChatPanel
                participant={participant}
                messages={messages}
                composer={composer}
                milestone={milestone}
                onComposerChange={setComposer}
                onSend={sendMessage}
                onEnd={() => endConversation(false)}
                onNext={() => endConversation(true)}
                onReport={() => setReportOpen(true)}
                onBlock={handleBlock}
                onDismissMilestone={() => setMilestone(null)}
              />
            )}
          </section>
        </div>
      </section>

      {authOpen && !accessToken && (
        <div className="modal-backdrop">
          <div className="auth-dialog">
            <AuthPanel
              accessToken={accessToken}
              displayAlias={displayAlias}
              profile={profile}
              authMode={authMode}
              authEmail={authEmail}
              authPassword={authPassword}
              authDisplayName={authDisplayName}
              authBusy={authBusy}
              authError={authError}
              onAuthModeChange={setAuthMode}
              onEmailChange={setAuthEmail}
              onPasswordChange={setAuthPassword}
              onDisplayNameChange={setAuthDisplayName}
              onAuthSubmit={(event) => void handleAuthSubmit(event)}
              onLogout={() => void handleLogout()}
            />
            <button className="ghost-button full-width" onClick={() => setAuthOpen(false)}>Đóng</button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="modal-backdrop">
          <div className="dialog">
            <h2>Báo cáo cuộc trò chuyện</h2>
            <p>Chọn lý do gần nhất. Bạn có thể chặn ngay sau khi báo cáo.</p>
            <div className="reason-grid">
              {(["spam", "harassment", "scam", "privacy", "violence", "other"] as ReportReason[]).map((reason) => (
                <button key={reason} className="secondary-button" onClick={() => void handleReport(reason)}>
                  {reportLabel(reason)}
                </button>
              ))}
            </div>
            <button className="ghost-button" onClick={() => setReportOpen(false)}>Đóng</button>
          </div>
        </div>
      )}

      {filterModalOpen && (
        <div className="modal-backdrop">
          <div className="dialog filter-dialog settings-modal-dialog">
            <header className="settings-modal-header">
              <h2>Cài đặt & Bộ lọc</h2>
              <div className="settings-tabs">
                <button
                  type="button"
                  className={activeSettingsTab === "profile" ? "active" : ""}
                  onClick={() => setActiveSettingsTab("profile")}
                >
                  Hồ sơ cá nhân
                </button>
                <button
                  type="button"
                  className={activeSettingsTab === "filter" ? "active" : ""}
                  onClick={() => setActiveSettingsTab("filter")}
                >
                  Bộ lọc đối phương
                </button>
              </div>
            </header>

            <div className="settings-modal-content">
              {activeSettingsTab === "profile" && (
                <div className="settings-profile-tab">
                  <label className="form-label">
                    Tên hiển thị
                    <input
                      type="text"
                      className="form-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={30}
                    />
                  </label>

                  <div className="two-cols-settings">
                    <label className="form-label">
                      Tuổi (*)
                      <input
                        type="number"
                        className="form-input"
                        value={editAge}
                        min={18}
                        max={99}
                        onChange={(e) => setEditAge(Number(e.target.value))}
                      />
                    </label>

                    <fieldset className="form-fieldset">
                      <legend>Giới tính (*)</legend>
                      <div className="segmented-settings">
                        {genders.map((g) => (
                          <button
                            key={g}
                            type="button"
                            className={editGender === g ? "active" : ""}
                            onClick={() => setEditGender(g)}
                          >
                            {genderLabels[g]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  <label className="form-label">
                    Tỉnh thành (*)
                    <select
                      className="form-select"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                    >
                      {vietnamLocations.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {activeSettingsTab === "filter" && (
                <div className="settings-filter-tab filter-options-stack">
                  <div className="filter-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableAgeFilter}
                        onChange={(e) => setEnableAgeFilter(e.target.checked)}
                      />
                      <span>Lọc theo Tuổi đối phương</span>
                    </label>
                    {enableAgeFilter && (
                      <div className="filter-inputs">
                        <label>
                          Từ
                          <input
                            type="number"
                            min={18}
                            max={99}
                            value={ageMin}
                            onChange={(e) => setAgeMin(Number(e.target.value))}
                          />
                        </label>
                        <label>
                          Đến
                          <input
                            type="number"
                            min={18}
                            max={99}
                            value={ageMax}
                            onChange={(e) => setAgeMax(Number(e.target.value))}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="filter-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableGenderFilter}
                        onChange={(e) => setEnableGenderFilter(e.target.checked)}
                      />
                      <span>Lọc theo Giới tính đối phương</span>
                    </label>
                    {enableGenderFilter && (
                      <div className="gender-choices">
                        {genders.map((g) => (
                          <label key={g} className="choice-item">
                            <input
                              type="checkbox"
                              checked={filterGenders.includes(g)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterGenders([...filterGenders, g]);
                                } else {
                                  setFilterGenders(filterGenders.filter((x) => x !== g));
                                }
                              }}
                            />
                            <span>{g === "male" ? "Nam" : g === "female" ? "Nữ" : "LGBT"}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="filter-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableLocationFilter}
                        onChange={(e) => setEnableLocationFilter(e.target.checked)}
                      />
                      <span>Lọc theo Tỉnh thành đối phương</span>
                    </label>
                    {enableLocationFilter && (
                      <div className="location-filter-box">
                        <div className="location-search-wrapper">
                          <input
                            type="text"
                            placeholder="Tìm tỉnh/thành..."
                            value={locInput}
                            onChange={(e) => {
                              setLocInput(e.target.value);
                              setShowLocSuggestions(true);
                            }}
                            onFocus={() => setShowLocSuggestions(true)}
                          />
                          {showLocSuggestions && locInput && (
                            <ul className="suggestions-list">
                              {vietnamLocations
                                .filter((loc) => loc.toLowerCase().includes(locInput.toLowerCase()))
                                .slice(0, 5)
                                .map((loc) => (
                                  <li
                                    key={loc}
                                    onClick={() => {
                                      if (!filterLocations.includes(loc)) {
                                        setFilterLocations([...filterLocations, loc]);
                                      }
                                      setLocInput("");
                                      setShowLocSuggestions(false);
                                    }}
                                  >
                                    {loc}
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>

                        <div className="selected-locations-tags">
                          {filterLocations.map((loc) => (
                            <span key={loc} className="loc-tag">
                              {loc}
                              <button
                                type="button"
                                onClick={() => setFilterLocations(filterLocations.filter((x) => x !== loc))}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="dialog-footer">
              <button className="primary-button btn-save-settings" onClick={handleSaveSettings}>
                Lưu cài đặt
              </button>
              <button className="ghost-button" onClick={() => setFilterModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Lobby({ onStart }: { onStart: () => void }) {
  return (
    <div className="setup-dialog">
      <section className="setup-section">
        <h2>Thông tin của bạn:</h2>
        <div className="preview-stack">
          <div className="fake-input">Tên mặc định: #ẨNDANH</div>
          <div className="two-cols">
            <div className="fake-input"><small>Tuổi (*)</small><span>20</span></div>
            <div className="fake-input"><small>Giới tính (*)</small><span>Nam</span></div>
          </div>
          <div className="fake-input"><small>Tỉnh thành (*)</small><span>Thành phố Hồ Chí Minh</span></div>
        </div>
      </section>

      <section className="setup-section">
        <h2>Bạn muốn gặp:</h2>
        <div className="preview-stack muted">
          <div className="fake-input"><small>Giới tính</small><span>Bất kỳ</span></div>
        </div>
      </section>

      <footer className="setup-footer">
        <p>*Các thông tin trên giúp hệ thống tìm người phù hợp với bạn</p>
        <button className="primary-button" onClick={onStart}>
          <LogIn size={18} />
          Bắt đầu ẩn danh
        </button>
      </footer>
    </div>
  );
}

function ProfileSetup({ onSubmit }: { onSubmit: (profile: ChatProfile) => Promise<void> }) {
  const [displayName, setDisplayName] = useState("Mây");
  const [age, setAge] = useState(22);
  const [location, setLocation] = useState("TP. Hồ Chí Minh");
  const [gender, setGender] = useState<ChatProfile["gender"]>("female");
  const [desiredGenders, setDesiredGenders] = useState<ChatProfile["desiredGenders"]>(["male", "female", "other"]);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ displayName, age, location, gender, desiredGenders });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hồ sơ chưa hợp lệ");
    }
  }

  return (
    <form className="setup-dialog" onSubmit={submit}>
      <section className="setup-section">
        <h2>Thông tin của bạn:</h2>
        <label>
          Tên hiển thị
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={30} />
        </label>
        <div className="two-cols">
          <label>
            Tuổi (*)
            <input type="number" value={age} min={18} max={99} onChange={(event) => setAge(Number(event.target.value))} />
          </label>
          <Segmented label="Giới tính (*)" value={gender} onChange={setGender} />
        </div>
        <label>
          Tỉnh thành (*)
          <select value={location} onChange={(event) => setLocation(event.target.value)}>
            {locations.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <section className="setup-section">
        <h2>Bạn muốn gặp:</h2>
        <GenderPreference
          label="Giới tính"
          value={desiredGenders}
          onChange={setDesiredGenders}
        />
      </section>

      {error && <p className="form-error">{error}</p>}
      <footer className="setup-footer">
        <p>*Các thông tin trên giúp hệ thống tìm người phù hợp với bạn</p>
        <button className="primary-button" type="submit">
          <UserRound size={18} />
          Cập nhật
        </button>
      </footer>
    </form>
  );
}

function MatchingPanel({
  displayAlias,
  matching,
  onMatch,
  onCancelMatch,
  onOpenFilters,
  enableAgeFilter,
  ageMin,
  ageMax,
  enableGenderFilter,
  filterGenders,
  enableLocationFilter,
  filterLocations
}: {
  displayAlias: string | null;
  matching: boolean;
  onMatch: () => void;
  onCancelMatch: () => void;
  onOpenFilters: () => void;
  enableAgeFilter: boolean;
  ageMin: number;
  ageMax: number;
  enableGenderFilter: boolean;
  filterGenders: ChatProfile["gender"][];
  enableLocationFilter: boolean;
  filterLocations: string[];
}) {
  return (
    <div className="matching-lobby-card">
      <header className="lobby-card-header">
        <span className="lobby-user-icon">🕵️</span>
        <span className="lobby-user-id">{displayAlias ?? "Ẩn danh"}</span>
      </header>

      <div className="lobby-status-banner">
        {matching ? "Đang tìm bạn chat..." : "Hãy tìm bạn thôi nào..."}
      </div>

      <div className="lobby-action-buttons">
        {matching ? (
          <button className="btn-stop-search" onClick={onCancelMatch}>
            <LoaderCircle className="spin" size={18} />
            Dừng tìm bạn
          </button>
        ) : (
          <>
            <button className="btn-update-filters" onClick={onOpenFilters}>
              Cập nhật thông tin
            </button>
            <button className="btn-start-search" onClick={onMatch}>
              Tìm bạn thôi
            </button>
          </>
        )}
      </div>

      <div className="lobby-filters-preview">
        <h4>Bộ lọc mong muốn hiện tại:</h4>
        <ul>
          <li>
            <strong>Tuổi:</strong> {enableAgeFilter ? `${ageMin} - ${ageMax} tuổi` : "Bất kỳ"}
          </li>
          <li>
            <strong>Giới tính:</strong>{" "}
            {enableGenderFilter
              ? filterGenders.map((g) => (g === "male" ? "Nam" : g === "female" ? "Nữ" : "LGBT")).join(", ")
              : "Bất kỳ"}
          </li>
          <li>
            <strong>Tỉnh thành:</strong>{" "}
            {enableLocationFilter && filterLocations.length > 0 ? filterLocations.join(", ") : "Bất kỳ"}
          </li>
        </ul>
      </div>
    </div>
  );
}

function AdminDashboard({
  overview,
  reports,
  users,
  loading,
  onRefresh,
  onAction
}: {
  overview: AdminOverview | null;
  reports: AdminReportSummary[];
  users: AdminUserSummary[];
  loading: boolean;
  onRefresh: () => void;
  onAction: (
    action: ModerationAction,
    payload: { reportId?: string; targetSessionId?: string; durationMinutes?: number; note?: string }
  ) => void;
}) {
  const metrics = overview?.metrics;
  const watchedUsers = overview?.watchedUsers.length ? overview.watchedUsers : users.filter((user) => user.reportCount > 0 || user.status !== "active");

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <h2>Quản trị hệ thống</h2>
          <p>Theo dõi truy cập, report và tự động hạn chế user vi phạm.</p>
        </div>
        <button className="secondary-button" onClick={onRefresh} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </header>

      <section className="admin-metrics">
        <MetricTile icon={<Users size={18} />} label="Tổng user" value={metrics?.totalUsers ?? 0} hint={`${metrics?.onlineUsers ?? 0} online`} />
        <MetricTile icon={<Activity size={18} />} label="Truy cập 24h" value={metrics?.activeUsersLast24h ?? 0} hint={`${metrics?.newUsersLast24h ?? 0} user mới`} />
        <MetricTile icon={<MessageCircle size={18} />} label="Tin nhắn" value={metrics?.totalMessages ?? 0} hint={`${metrics?.messagesLastHour ?? 0} trong 1 giờ`} />
        <MetricTile icon={<Flag size={18} />} label="Report" value={metrics?.totalReports ?? 0} hint={`${metrics?.openReports ?? 0} đang mở`} />
        <MetricTile icon={<Ban size={18} />} label="Bị ban" value={metrics?.bannedUsers ?? 0} hint={`${metrics?.mutedUsers ?? 0} bị mute`} />
        <MetricTile icon={<BarChart3 size={18} />} label="Report/1000 tin" value={metrics?.reportRatePer1000Messages ?? 0} hint={`${metrics?.activeConversations ?? 0} chat active`} />
      </section>

      <section className="admin-columns">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h3>Hành vi bị báo cáo</h3>
            <span>{overview?.metrics.totalReports ?? 0} report</span>
          </div>
          <div className="reason-list">
            {(overview?.reportsByReason ?? []).map((item) => (
              <div key={item.reason} className="reason-row">
                <span>{reportLabel(item.reason)}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h3>User cần theo dõi</h3>
            <span>{watchedUsers.length} user</span>
          </div>
          <div className="user-watch-list">
            {watchedUsers.length === 0 && <p className="admin-empty">Chưa có user bị report.</p>}
            {watchedUsers.map((user) => (
              <article key={user.sessionId} className="user-row">
                <div>
                  <strong>{user.alias}</strong>
                  <span>{statusLabel(user.status)} • {user.reportCount} report • {roleLabel(user.role)}</span>
                  {user.banUntil && <small>Ban đến {formatDateTime(user.banUntil)}</small>}
                </div>
                <div className="admin-row-actions">
                  <button className="ghost-button" onClick={() => onAction("mute", { targetSessionId: user.sessionId, durationMinutes: 60, note: "Mute nhanh từ dashboard" })}>
                    Mute 1h
                  </button>
                  <button className="secondary-button" onClick={() => onAction("ban", { targetSessionId: user.sessionId, note: "Ban theo rule từ dashboard" })}>
                    Ban theo rule
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-panel reports-panel">
        <div className="admin-panel-heading">
          <h3>Report gần đây</h3>
          <span>{reports.length} mục</span>
        </div>
        <div className="report-table">
          {reports.length === 0 && <p className="admin-empty">Chưa có report nào.</p>}
          {reports.map((report) => (
            <article key={report.id} className="report-row">
              <div className="report-main">
                <strong>{reportLabel(report.reason)}</strong>
                <span>{severityLabel(report.severity)} • {reportStatusLabel(report.status)} • {formatDateTime(report.createdAt)}</span>
                <small>
                  Người báo cáo: {report.reporterAlias}
                  {report.targetAlias ? ` • Bị báo cáo: ${report.targetAlias}` : ""}
                  {report.note ? ` • Ghi chú: ${report.note}` : ""}
                </small>
              </div>
              <div className="report-meta">
                <span>{report.targetReportCount} report</span>
                <span>{report.targetBanCount} lần ban</span>
                {report.targetBanUntil && <span>Ban đến {formatDateTime(report.targetBanUntil)}</span>}
              </div>
              <div className="admin-row-actions">
                <button className="ghost-button" onClick={() => onAction("ignore", { reportId: report.id, note: "Bỏ qua từ dashboard" })}>
                  Bỏ qua
                </button>
                {report.messageId && (
                  <button className="ghost-button" onClick={() => onAction("hide_message", { reportId: report.id, note: "Ẩn tin nhắn bị report" })}>
                    Ẩn tin
                  </button>
                )}
                <button
                  className="secondary-button"
                  disabled={!report.targetSessionId}
                  onClick={() => onAction("mute", { reportId: report.id, targetSessionId: report.targetSessionId, durationMinutes: 60, note: "Mute 1 giờ do report" })}
                >
                  Mute 1h
                </button>
                <button
                  className="primary-button"
                  disabled={!report.targetSessionId}
                  onClick={() => onAction("ban", { reportId: report.id, targetSessionId: report.targetSessionId, note: "Ban theo rule do report nhiều lần" })}
                >
                  <Gavel size={16} />
                  Ban
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <article className="metric-tile">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value.toLocaleString("vi-VN")}</strong>
      <small>{hint}</small>
    </article>
  );
}

function AuthPanel({
  accessToken,
  displayAlias,
  profile,
  authMode,
  authEmail,
  authPassword,
  authDisplayName,
  authBusy,
  authError,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onAuthSubmit,
  onLogout
}: {
  accessToken: string | null;
  displayAlias: string | null;
  profile: ChatProfile | null;
  authMode: AuthMode;
  authEmail: string;
  authPassword: string;
  authDisplayName: string;
  authBusy: boolean;
  authError: string;
  onAuthModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onAuthSubmit: (event: React.FormEvent) => void;
  onLogout: () => void;
}) {
  if (accessToken) {
    return (
      <section className="account-card">
        <div className="account-heading">
          <UserRound size={22} />
          <div>
            <h2>{displayAlias ?? "Bạn ẩn danh"}</h2>
            <p>{profile ? `${profile.age} tuổi • ${profile.location}` : "Chưa có hồ sơ chat"}</p>
          </div>
        </div>
        {profile && (
          <div className="profile-summary">
            <span>Bạn: {genderLabels[profile.gender]}</span>
            <span>Muốn gặp: {formatDesiredGenders(profile.desiredGenders)}</span>
          </div>
        )}
        <button className="secondary-button full-width" onClick={onLogout}>
          <LogOut size={16} />
          Đăng xuất
        </button>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-heading">
        <Mail size={22} />
        <div>
          <h2>Tài khoản email</h2>
          <p>Lưu hồ sơ để quay lại nhanh hơn.</p>
        </div>
      </div>
      <div className="auth-tabs" role="tablist" aria-label="Email auth">
        <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => onAuthModeChange("login")}>
          Đăng nhập
        </button>
        <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => onAuthModeChange("register")}>
          Đăng ký
        </button>
      </div>
      <form className="auth-form" onSubmit={onAuthSubmit}>
        {authMode === "register" && (
          <label>
            Tên hiển thị
            <div className="input-with-icon">
              <UserPlus size={16} />
              <input value={authDisplayName} onChange={(event) => onDisplayNameChange(event.target.value)} maxLength={30} />
            </div>
          </label>
        )}
        <label>
          Email
          <div className="input-with-icon">
            <AtSign size={16} />
            <input type="email" value={authEmail} onChange={(event) => onEmailChange(event.target.value)} autoComplete="email" />
          </div>
        </label>
        <label>
          Mật khẩu
          <div className="input-with-icon">
            <KeyRound size={16} />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
              minLength={8}
              autoComplete={authMode === "register" ? "new-password" : "current-password"}
            />
          </div>
        </label>
        {authError && <p className="form-error">{authError}</p>}
        <button className="primary-button full-width" type="submit" disabled={authBusy}>
          {authBusy ? <LoaderCircle className="spin" size={18} /> : authMode === "register" ? <UserPlus size={18} /> : <LogIn size={18} />}
          {authBusy ? "Đang xử lý..." : authMode === "register" ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
      </form>
    </section>
  );
}

function ChatPanel({
  participant,
  messages,
  composer,
  milestone,
  onComposerChange,
  onSend,
  onEnd,
  onNext,
  onReport,
  onBlock,
  onDismissMilestone
}: {
  participant: PublicParticipant;
  messages: ReturnType<typeof useSessionStore.getState>["messages"];
  composer: string;
  milestone: ReturnType<typeof useSessionStore.getState>["milestone"];
  onComposerChange: (value: string) => void;
  onSend: () => void;
  onEnd: () => void;
  onNext: () => void;
  onReport: () => void;
  onBlock: () => void;
  onDismissMilestone: () => void;
}) {
  return (
    <div className="chat-shell">
      <header className="chat-header">
        <div>
          <h2>{participant.alias}</h2>
          <p>{[participant.age, participant.location, participant.gender ? genderLabels[participant.gender] : null].filter(Boolean).join(" • ")}</p>
        </div>
        <div className="chat-actions">
          <button className="icon-button" title="Báo cáo" onClick={onReport}><ShieldAlert size={18} /></button>
          <button className="icon-button" title="Chặn" onClick={onBlock}><Ban size={18} /></button>
          <button className="icon-button" title="Kết thúc" onClick={onEnd}><DoorOpen size={18} /></button>
        </div>
      </header>

      <div className="message-list">
        {messages.length === 0 && <p className="empty-chat">Hãy gửi lời chào đầu tiên.</p>}
        {messages.map((message) => (
          <div key={message.id} className={message.sender.participantId === participant.participantId ? "bubble theirs" : "bubble mine"}>
            <span>{message.body}</span>
            <small>{new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
        ))}
      </div>

      {milestone && (
        <div className="engagement-tray">
          <strong>{milestone.title}</strong>
          {milestone.suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => onComposerChange(suggestion)}>{suggestion}</button>
          ))}
          <button className="ghost-button" onClick={onDismissMilestone}>Bỏ qua</button>
        </div>
      )}

      <footer className="composer">
        <textarea value={composer} onChange={(event) => onComposerChange(event.target.value)} maxLength={2000} placeholder="Nhập tin nhắn..." />
        <button className="send-button" title="Gửi" onClick={onSend}><Send size={20} /></button>
      </footer>
      <button className="secondary-button next-button" onClick={onNext}>
        <Shuffle size={16} />
        Đổi người
      </button>
    </div>
  );
}

function Segmented({
  label,
  value,
  onChange
}: {
  label: string;
  value: ChatProfile["gender"];
  onChange: (gender: ChatProfile["gender"]) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="segmented">
        {genders.map((item) => (
          <button key={item} type="button" className={value === item ? "active" : ""} onClick={() => onChange(item)}>
            {genderLabels[item]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function GenderPreference({
  label,
  value,
  onChange
}: {
  label: string;
  value: ChatProfile["desiredGenders"];
  onChange: (value: ChatProfile["desiredGenders"]) => void;
}) {
  const allSelected = genders.every((item) => value.includes(item));

  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="choice-grid">
        <button type="button" className={allSelected ? "active" : ""} onClick={() => onChange([...genders])}>
          <HeartHandshake size={16} />
          Bất kỳ
        </button>
        {genders.map((item) => (
          <button key={item} type="button" className={!allSelected && value.length === 1 && value[0] === item ? "active" : ""} onClick={() => onChange([item])}>
            {genderLabels[item]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function reportLabel(reason: ReportReason) {
  const labels: Record<ReportReason, string> = {
    spam: "Spam",
    harassment: "Quấy rối",
    scam: "Lừa đảo",
    sexual_content: "Nội dung tình dục",
    minor_safety: "An toàn trẻ vị thành niên",
    violence: "Bạo lực",
    privacy: "Lộ thông tin riêng tư",
    other: "Khác"
  };
  return labels[reason];
}

function formatDesiredGenders(value: ChatProfile["desiredGenders"]) {
  if (genders.every((item) => value.includes(item))) {
    return "Bất kỳ";
  }
  return value.map((item) => genderLabels[item]).join(", ");
}

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `client_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Hoạt động",
    muted: "Bị khóa mõm",
    banned: "Bị cấm",
    expired: "Hết hạn"
  };
  return labels[status] ?? status;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "Admin",
    moderator: "Mod",
    user: "User"
  };
  return labels[role] ?? role;
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    low: "Thấp",
    medium: "Trung bình",
    high: "Cao",
    critical: "Nguy cấp"
  };
  return labels[severity] ?? severity;
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Đang mở",
    reviewing: "Đang xem xét",
    resolved: "Đã xử lý",
    dismissed: "Bỏ qua"
  };
  return labels[status] ?? status;
}

function formatDateTime(value?: string) {
  if (!value) return "chưa rõ";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
