import { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Ban,
  DoorOpen,
  HeartHandshake,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Send,
  ShieldAlert,
  Shuffle,
  UserPlus,
  UserRound
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { chatProfileSchema, genders, type ChatProfile, type PublicParticipant, type ReportReason } from "@chatandanh/shared";
import {
  apiBaseUrl,
  blockParticipant,
  createAnonymousSession,
  getAdminMetrics,
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
  const [composer, setComposer] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("Mây");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [adminMetrics, setAdminMetrics] = useState<null | {
    onlineUsers: number;
    activeConversations: number;
    messagesLastHour: number;
    openReports: number;
  }>(null);

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

  async function handleStartGuest() {
    setStatus("Đang tạo phiên ẩn danh...");
    const session = await createAnonymousSession();
    setSession({ accessToken: session.accessToken, displayAlias: session.displayAlias, avatarKey: session.avatarKey });
    setStatus("Tạo phiên xong. Hoàn tất hồ sơ nhanh để tìm người lạ.");
  }

  async function handleProfileSubmit(nextProfile: ChatProfile) {
    const parsed = chatProfileSchema.parse(nextProfile);
    if (!accessToken) {
      const session = await createAnonymousSession(parsed);
      setSession({
        accessToken: session.accessToken,
        displayAlias: session.displayAlias,
        avatarKey: session.avatarKey,
        profile: parsed
      });
      setStatus("Hồ sơ đã sẵn sàng. Bạn có thể tìm người lạ.");
      return;
    }
    await updateProfile(accessToken, parsed);
    setProfile(parsed);
    setStatus("Đã lưu hồ sơ. Tìm người lạ thôi.");
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
        avatarKey: "avatar_registered"
      });
      const profileResult = await getProfile(response.accessToken);
      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setStatus("Đã đăng nhập. Bạn có thể tìm người lạ.");
      } else {
        setStatus("Đã đăng nhập. Hoàn tất hồ sơ nhanh để bắt đầu.");
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
    setAdminMetrics(null);
    setAuthPassword("");
    setStatus("Đã đăng xuất. Bạn vẫn có thể bắt đầu bằng phiên ẩn danh.");
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
    const result = await startMatching(accessToken, profile.desiredGenders);
    if (result.status === "queued") {
      setStatus("Đang chờ người phù hợp. Mở thêm một cửa sổ khác để thử ghép nhanh.");
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

  async function loadAdminMetrics() {
    if (!accessToken) {
      setStatus("Cần đăng nhập bằng tài khoản admin để xem dashboard.");
      return;
    }
    try {
      setAdminMetrics(await getAdminMetrics(accessToken));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không tải được admin metrics.");
    }
  }

  const currentStep = useMemo(() => {
    if (!accessToken) return "guest";
    if (!profile) return "profile";
    if (conversationId) return "chat";
    return "match";
  }, [accessToken, conversationId, profile]);

  return (
    <main className="app-shell">
      <aside className="app-rail" aria-label="Điều hướng nhanh">
        <div className="rail-logo">ẩn<br />danh</div>
        <button className="rail-button active" title="Chat"><MessageCircle size={20} /></button>
        <button className="rail-button" title="Ghép ngẫu nhiên"><Shuffle size={20} /></button>
        <button className="rail-button" title="An toàn"><ShieldAlert size={20} /></button>
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
            <small>100+ người đang online</small>
          </div>
          <div className="session-pill" title={displayAlias ?? "Khách mới"}>
            <UserRound size={16} />
            <span>{displayAlias ?? "Khách mới"}</span>
          </div>
        </header>

        <div className="status-line">{status}</div>

        <div className="main-grid">
          <section className="primary-panel">
            {currentStep === "guest" && <Lobby onStart={handleStartGuest} />}

            {currentStep === "profile" && <ProfileSetup onSubmit={handleProfileSubmit} />}

            {currentStep === "match" && (
              <MatchingPanel
                profile={profile}
                onDesiredGendersChange={(next) => void handleDesiredGendersChange(next)}
                onMatch={handleMatch}
                matching={matching}
                savingPreference={savingPreference}
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
          <div className="fake-input"><small>Tuổi</small><span>Tất cả</span></div>
          <div className="fake-input"><small>Giới tính</small><span>Bất kỳ</span></div>
          <div className="fake-input"><small>Tỉnh thành</small><span>Tất cả</span></div>
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
  profile,
  onDesiredGendersChange,
  onMatch,
  matching,
  savingPreference
}: {
  profile: ChatProfile | null;
  onDesiredGendersChange: (value: ChatProfile["desiredGenders"]) => void;
  onMatch: () => void;
  matching: boolean;
  savingPreference: boolean;
}) {
  return (
    <div className="setup-dialog">
      <section className="setup-section">
        <h2>Thông tin của bạn:</h2>
        <div className="preview-stack">
          <div className="fake-input"><small>Tên</small><span>{profile?.displayName}</span></div>
          <div className="two-cols">
            <div className="fake-input"><small>Tuổi</small><span>{profile?.age}</span></div>
            <div className="fake-input"><small>Giới tính</small><span>{profile?.gender ? genderLabels[profile.gender] : ""}</span></div>
          </div>
          <div className="fake-input"><small>Tỉnh thành</small><span>{profile?.location}</span></div>
        </div>
      </section>

      <section className="setup-section">
        <h2>Bạn muốn gặp:</h2>
        <GenderPreference
          label="Giới tính"
          value={profile?.desiredGenders ?? ["male", "female", "other"]}
          onChange={onDesiredGendersChange}
        />
        <small>{savingPreference ? "Đang lưu lựa chọn..." : "Không cần chọn chủ đề."}</small>
      </section>

      <footer className="setup-footer">
        <p>*Bạn có thể đổi lựa chọn giới tính trước mỗi lần tìm</p>
        <button className="primary-button" onClick={onMatch} disabled={matching}>
          {matching ? <LoaderCircle className="spin" size={18} /> : <Shuffle size={18} />}
          {matching ? "Đang tìm..." : "Tìm bạn mới"}
        </button>
      </footer>
    </div>
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
