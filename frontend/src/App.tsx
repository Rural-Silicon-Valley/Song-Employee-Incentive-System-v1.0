import { useEffect, useMemo, useState } from "react";
import "./App.css";

interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  role: string;
  signature?: string | null;
  points: number;
}

interface Task {
  id: number;
  title: string;
  description?: string | null;
  scheduledFor: string;
  dueAt: string;
  submissions: Array<{ id: number; status: string; submittedAt: string; aiScore?: number | null }>;
}

interface Submission {
  id: number;
  task: Task;
  submittedAt: string;
  status: string;
  aiScore?: number | null;
  aiFeedback?: string | null;
  isLate: boolean;
}

interface PointLog {
  id: number;
  change: number;
  reason: string;
  note?: string | null;
  createdAt: string;
}

interface LeaderboardEntry {
  userId: number;
  displayName: string;
  points: number;
  rank?: number;
}

interface WrongAnswer {
  id: number;
  recordedAt: string;
  correctionDeadline: string;
  isResolved: boolean;
  correctionText?: string | null;
  question: { prompt: string };
  answer: { selectedOption: number; isCorrect: boolean };
}

type AuthState =
  | { status: "unauthenticated"; token: null }
  | { status: "authenticated"; token: string; profile?: UserProfile };

const STORAGE_KEY = "incentive_dashboard_session";

function loadStoredAuth(): AuthState {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return { status: "unauthenticated", token: null };
  try {
    const parsed = JSON.parse(data);
    if (parsed?.token) {
      return { status: "authenticated", token: parsed.token, profile: parsed.profile };
    }
  } catch (error) {
    console.warn("Failed to parse session", error);
  }
  return { status: "unauthenticated", token: null };
}

function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => loadStoredAuth());

  const login = (token: string, profile?: UserProfile) => {
    const newState: AuthState = { status: "authenticated", token, profile };
    setAuth(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const logout = () => {
    setAuth({ status: "unauthenticated", token: null });
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = (profile: UserProfile) => {
    if (auth.status === "authenticated") {
      const newState: AuthState = { ...auth, profile };
      setAuth(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    }
  };

  return { auth, login, logout, updateProfile };
}

async function apiFetch<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section id={id} style={{ border: "1px solid #e5e7eb", padding: 24, borderRadius: 12, marginBottom: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {action}
      </header>
      {children ?? <EmptyState />}
    </section>
  );
}

function EmptyState({ title = "暂无内容", description = "等待实际数据写入后自动更新" }) {
  return (
    <div style={{ textAlign: "center", color: "#6b7280", padding: "32px 0" }}>
      <div style={{ fontSize: 18, fontWeight: 500 }}>{title}</div>
      <div style={{ marginTop: 8 }}>{description}</div>
    </div>
  );
}

function HealthTag({ ok }: { ok: boolean }) {
  return (
    <span style={{
      padding: "4px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      color: ok ? "#065f46" : "#991b1b",
      background: ok ? "#d1fae5" : "#fee2e2",
    }}>
      {ok ? "在线" : "离线"}
    </span>
  );
}

function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

function LoginForm({ onLogin }: { onLogin: (token: string, profile?: UserProfile) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        await apiFetch("/api/auth/register", undefined, {
          method: "POST",
          body: JSON.stringify({ email, password, displayName, signature }),
        });
      }
      const response = await apiFetch<{ token: string; user: UserProfile }>("/api/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(response.token, response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setMode("login")} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: mode === "login" ? "#111827" : "white", color: mode === "login" ? "white" : "#111827" }}>
          登录
        </button>
        <button type="button" onClick={() => setMode("register")} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: mode === "register" ? "#111827" : "white", color: mode === "register" ? "white" : "#111827" }}>
          注册
        </button>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span>邮箱</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="user@example.com" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span>密码</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required placeholder="至少6位" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
      </label>
      {mode === "register" && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>姓名</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required placeholder="张三" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>个性签名（可选）</span>
            <input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="向着目标不懈奔跑" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
        </>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>}
      <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 8, background: "#111827", color: "white", border: "none", fontWeight: 600 }}>
        {loading ? "提交中..." : mode === "login" ? "立即登录" : "注册并登录"}
      </button>
    </form>
  );
}

function ProfileCard({ profile, onLogout }: { profile: UserProfile; onLogout(): void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: 12, border: "1px solid #e5e7eb", maxWidth: 420 }}>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{profile.displayName}</div>
      <div style={{ color: "#6b7280" }}>{profile.email}</div>
      <div style={{ fontSize: 14 }}>角色：{profile.role === "ADMIN" ? "管理员" : "员工"}</div>
      <div style={{ fontSize: 14 }}>积分：{profile.points ?? 0}</div>
      {profile.signature && <div style={{ fontStyle: "italic", color: "#111827" }}>“{profile.signature}”</div>}
      <button onClick={onLogout} style={{ marginTop: 8, padding: 8, background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8 }}>退出登录</button>
    </div>
  );
}

function TaskList({ submissions, onRefresh }: { submissions: Submission[]; onRefresh(): void }) {
  if (submissions.length === 0) {
    return <EmptyState title="暂无提交" description="待上传后显示任务提交与AI评审" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {submissions.map((submission) => (
        <div key={submission.id} style={{ border: "1px solid #e5e7eb", padding: 16, borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{submission.task.title}</div>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: submission.status === "APPROVED" ? "#d1fae5" : submission.status === "REJECTED" ? "#fee2e2" : "#e0f2fe", color: submission.status === "APPROVED" ? "#166534" : submission.status === "REJECTED" ? "#991b1b" : "#075985" }}>
              {submission.status === "APPROVED" ? "已通过" : submission.status === "REJECTED" ? "需改进" : "待评审"}
            </span>
          </div>
          <div style={{ marginTop: 8, color: "#6b7280" }}>
            提交时间：{formatDate(submission.submittedAt)}（{submission.isLate ? "逾期提交" : "按时提交"}）
          </div>
          {submission.aiScore != null && (
            <div style={{ marginTop: 8 }}>AI评分：{submission.aiScore} 分</div>
          )}
          {submission.aiFeedback && (
            <div style={{ marginTop: 8, background: "#f9fafb", padding: 12, borderRadius: 8, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600 }}>AI评语</div>
              <div style={{ marginTop: 4, whiteSpace: "pre-line" }}>{submission.aiFeedback}</div>
            </div>
          )}
          <button onClick={onRefresh} style={{ marginTop: 12, padding: 8, borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
            刷新状态
          </button>
        </div>
      ))}
    </div>
  );
}

function PointHistory({ logs }: { logs: PointLog[] }) {
  if (logs.length === 0) {
    return <EmptyState title="暂无积分流水" description="完成任务、答题或排名后将显示积分变动" />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb", textAlign: "left" }}>
            <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>时间</th>
            <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>变动</th>
            <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>类型</th>
            <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>备注</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{formatDate(log.createdAt)}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", color: log.change >= 0 ? "#166534" : "#991b1b" }}>{log.change >= 0 ? `+${log.change}` : log.change}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{log.reason}</td>
              <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}>{log.note ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Leaderboard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  if (leaderboard.length === 0) {
    return <EmptyState title="暂无榜单" description="等待AI评分与积分汇总后自动生成" />;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {leaderboard.map((entry, index) => (
        <div key={entry.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: index === 0 ? "#f59e0b" : index === 1 ? "#9ca3af" : index === 2 ? "#d97706" : "#e5e7eb", color: index < 3 ? "white" : "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
              {index + 1}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{entry.displayName}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>积分 {entry.points}</div>
            </div>
          </div>
          <button style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
            查看详情
          </button>
        </div>
      ))}
    </div>
  );
}

function WrongAnswerList({ wrongAnswers }: { wrongAnswers: WrongAnswer[] }) {
  if (wrongAnswers.length === 0) {
    return <EmptyState title="没有错题" description="答题正确或尚未收到AI错题反馈" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {wrongAnswers.map((item) => (
        <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, color: "#111827" }}>题目</div>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: item.isResolved ? "#d1fae5" : "#fef3c7", color: item.isResolved ? "#166534" : "#92400e" }}>
              {item.isResolved ? "已复习" : "待纠正"}
            </span>
          </div>
          <div style={{ marginTop: 8, lineHeight: 1.6 }}>{item.question.prompt}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>记录时间：{formatDate(item.recordedAt)}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>纠正期限：{formatDate(item.correctionDeadline)}</div>
          {item.correctionText && (
            <div style={{ marginTop: 12, background: "#f9fafb", padding: 12, borderRadius: 8, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600 }}>AI文字讲解</div>
              <div style={{ marginTop: 4 }}>{item.correctionText}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function App() {
  const { auth, login, logout, updateProfile } = useAuth();
  const [healthCheck, setHealthCheck] = useState<{ status: string; database: boolean } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ status: string; database: boolean }>("/api/health", undefined, { signal: controller.signal })
      .then(setHealthCheck)
      .catch((error) => {
        console.error(error);
        setHealthCheck(null);
      });
    return () => controller.abort();
  }, []);

  const authToken = auth.status === "authenticated" ? auth.token : undefined;

  useEffect(() => {
    if (!authToken) return;

    const controller = new AbortController();

    const fetchProfile = async () => {
      try {
        const profile = await apiFetch<UserProfile>("/api/users/me", authToken, { signal: controller.signal });
        updateProfile(profile);
      } catch (error) {
        console.warn("Failed to fetch profile", error);
      }
    };

    const fetchSubmissions = async () => {
      try {
        const result = await apiFetch<Submission[]>("/api/tasks/submissions", authToken, { signal: controller.signal });
        setSubmissions(result);
      } catch (error) {
        console.warn("Failed to fetch submissions", error);
        setSubmissions([]);
      }
    };

    const fetchPoints = async () => {
      try {
        const result = await apiFetch<PointLog[]>("/api/users/points", authToken, { signal: controller.signal });
        setPointLogs(result);
      } catch (error) {
        console.warn("Failed to fetch points", error);
        setPointLogs([]);
      }
    };

    const fetchLeaderboard = async () => {
      try {
        const result = await apiFetch<Array<{ id: number; weekStart: string; weekEnd: string; leaderboard: LeaderboardEntry[] }>>("/api/rewards/leaderboard", authToken, { signal: controller.signal });
        const latest = result.at(0)?.leaderboard ?? [];
        setLeaderboard(latest);
      } catch (error) {
        console.warn("Failed to fetch leaderboard", error);
        setLeaderboard([]);
      }
    };

    const fetchWrongAnswers = async () => {
      try {
        const result = await apiFetch<WrongAnswer[]>("/api/wrong-answers", authToken, { signal: controller.signal });
        setWrongAnswers(result);
      } catch (error) {
        console.warn("Failed to fetch wrong answers", error);
        setWrongAnswers([]);
      }
    };

    fetchProfile();
    fetchSubmissions();
    fetchPoints();
    fetchLeaderboard();
    fetchWrongAnswers();

    return () => controller.abort();
  }, [authToken, updateProfile]);

  const handleRefresh = async (key: string, fetcher: () => Promise<void>) => {
    setLoadingStates((prev) => ({ ...prev, [key]: true }));
    setErrorStates((prev) => ({ ...prev, [key]: null }));
    try {
      await fetcher();
    } catch (error) {
      setErrorStates((prev) => ({ ...prev, [key]: error instanceof Error ? error.message : "请求失败" }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [key]: false }));
    }
  };

  const refreshSubmissions = () => {
    if (!authToken) return;
    return handleRefresh("submissions", async () => {
      const result = await apiFetch<Submission[]>("/api/tasks/submissions", authToken);
      setSubmissions(result);
    });
  };

  const refreshPoints = () => {
    if (!authToken) return;
    return handleRefresh("points", async () => {
      const logs = await apiFetch<PointLog[]>("/api/users/points", authToken);
      setPointLogs(logs);
    });
  };

  const refreshLeaderboard = () => {
    if (!authToken) return;
    return handleRefresh("leaderboard", async () => {
      const result = await apiFetch<Array<{ id: number; weekStart: string; weekEnd: string; leaderboard: LeaderboardEntry[] }>>("/api/rewards/leaderboard", authToken);
      setLeaderboard(result.at(0)?.leaderboard ?? []);
    });
  };

  const refreshWrongAnswers = () => {
    if (!authToken) return;
    return handleRefresh("wrongAnswers", async () => {
      const result = await apiFetch<WrongAnswer[]>("/api/wrong-answers", authToken);
      setWrongAnswers(result);
    });
  };

  const isLoggedIn = auth.status === "authenticated" && auth.profile;

  const navigation = useMemo(
    () => [
      { label: "登录系统", href: "#login" },
      { label: "任务上传", href: "#tasks" },
      { label: "积分中心", href: "#points" },
      { label: "周榜排名", href: "#leaderboard" },
      { label: "错题本", href: "#wrongs" },
    ],
    []
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <header style={{ background: "white", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>乡村硅谷员工激励平台</div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>积分封顶15分 · AI评审 · 实时周榜 · 错题追踪 · 登录采用“邮箱验证码 + 硅谷专属令牌”</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>后端服务</div>
              <HealthTag ok={healthCheck?.status === "ok"} />
            </div>
          </div>
          <nav style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[...navigation, { label: "独立登录页", href: "/auth" }].map((item) => (
              <a key={item.href} href={item.href} style={{ padding: "8px 16px", borderRadius: 999, background: "#111827", color: "white", textDecoration: "none", fontSize: 14 }}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 2 }}>
          <Section
            id="login"
            title="登录系统"
            action={isLoggedIn && (
              <button onClick={logout} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                退出登录
              </button>
            )}
          >
            {auth.status === "authenticated" && auth.profile ? <ProfileCard profile={auth.profile} onLogout={logout} /> : <LoginForm onLogin={login} />}
          </Section>

          <Section
            id="tasks"
            title="任务上传与AI评审"
            action={
              <button onClick={refreshSubmissions} disabled={!authToken || loadingStates.submissions} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                {loadingStates.submissions ? "刷新中..." : "刷新任务"}
              </button>
            }
          >
            {errorStates.submissions && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{errorStates.submissions}</div>}
            {authToken ? <TaskList submissions={submissions} onRefresh={refreshSubmissions} /> : <EmptyState title="未登录" description="登录后可查看任务提交与AI评分" />}
          </Section>

          <Section
            id="points"
            title="积分中心"
            action={
              <button onClick={refreshPoints} disabled={!authToken || loadingStates.points} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                {loadingStates.points ? "刷新中..." : "刷新积分"}
              </button>
            }
          >
            {errorStates.points && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{errorStates.points}</div>}
            {authToken ? <PointHistory logs={pointLogs} /> : <EmptyState title="未登录" description="登录后查看积分上限与流水" />}
          </Section>

          <Section
            id="leaderboard"
            title="周榜排名"
            action={
              <button onClick={refreshLeaderboard} disabled={!authToken || loadingStates.leaderboard} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                {loadingStates.leaderboard ? "刷新中..." : "刷新榜单"}
              </button>
            }
          >
            {errorStates.leaderboard && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{errorStates.leaderboard}</div>}
            {authToken ? <Leaderboard leaderboard={leaderboard} /> : <EmptyState title="未登录" description="登录后查看AI评分周榜" />}
          </Section>

          <Section
            id="wrongs"
            title="错题本"
            action={
              <button onClick={refreshWrongAnswers} disabled={!authToken || loadingStates.wrongAnswers} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                {loadingStates.wrongAnswers ? "刷新中..." : "刷新错题"}
              </button>
            }
          >
            {errorStates.wrongAnswers && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{errorStates.wrongAnswers}</div>}
            {authToken ? <WrongAnswerList wrongAnswers={wrongAnswers} /> : <EmptyState title="未登录" description="登录并完成每日AI考题后将显示错题" />}
          </Section>
        </div>

        <aside style={{ flex: 1, position: "sticky", top: 32, alignSelf: "flex-start" }}>
          <Section id="info" title="核心规则">
            <ul style={{ margin: 0, paddingLeft: 18, color: "#374151", lineHeight: 1.8 }}>
              <li>积分上限 15 分，按任务、排名、AI测评、未上传扣分</li>
              <li>每日任务优先上传 +1 分，AI评分刷新周榜，前三额外 +1 分</li>
              <li>每日 5 题考核，答对 ≥4 题加分；错题自动记录并限期纠正</li>
              <li>错题未按时纠正将扣分，AI提供文字/视频讲解</li>
              <li>周榜第一可兑换勋章或申请奖励</li>
              <li>AI审查任务内容，生成评审记录并支持排名展示</li>
            </ul>
          </Section>
        </aside>
      </main>
    </div>
  );
}

export default App;
