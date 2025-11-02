import { useEffect, useRef, useState } from "react";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    try { const data = await resp.json(); message = data?.message || JSON.stringify(data); } catch { message = await resp.text(); }
    throw new Error(message || `Request failed (${resp.status})`);
  }
  return resp.json();
}

type AuthUser = { id: number; email: string; displayName: string; role: string; points?: number };

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [disabledInfo, setDisabledInfo] = useState<{ at: string; reason?: string } | null>(null);
  const [inactivityReason, setInactivityReason] = useState("");
  const hbTimer = useRef<number | null>(null);

  const requestOtp = async () => {
    setErr(null); setMsg(null);
    await api("/api/auth-ex/request-otp", { method: "POST", body: JSON.stringify({ email }) });
    setMsg("验证码已发送，请查收邮箱");
  };

  const verifyOtp = async () => {
    setErr(null); setMsg(null);
    await api("/api/auth-ex/verify-otp", { method: "POST", body: JSON.stringify({ email, code }) });
    setMsg("邮箱已验证，可领取令牌");
  };

  const issueExclusiveToken = async () => {
    setErr(null); setMsg(null);
    const r = await api<{ ok: boolean; token: string }>("/api/auth-ex/issue-token", { method: "POST", body: JSON.stringify({ email }) });
    if (r.ok) { setIssuedToken(r.token); setToken(r.token); setMsg("已领取专属令牌，可复制使用"); }
  };

  const registerWithToken = async () => {
    setErr(null); setMsg(null);
  try {
    const r = await api<{ token: string; user: AuthUser }>("/api/auth-ex/register-with-token", { method: "POST", body: JSON.stringify({ email, code, token, name, password }) });
    localStorage.setItem("incentive_dashboard_session", JSON.stringify({ status: "authenticated", token: r.token, profile: r.user }));
    // 登录后启动心跳
    startHeartbeat(r.token);
    location.href = "/";
  } catch (e: unknown) {
    const text = e instanceof Error ? e.message : "注册失败";
    if (text.includes("令牌已被禁用")) {
      try { const info = JSON.parse(text); setDisabledInfo({ at: info?.disabledAt || "", reason: info?.reason }); } catch { setDisabledInfo({ at: "", reason: undefined }); }
    }
    setErr(text);
  }
  };

  const loginWithToken = async () => {
    setErr(null); setMsg(null);
  try {
    const r = await api<{ token: string; user: AuthUser }>("/api/auth-ex/login-with-token", { method: "POST", body: JSON.stringify({ email, password, token }) });
    localStorage.setItem("incentive_dashboard_session", JSON.stringify({ status: "authenticated", token: r.token, profile: r.user }));
    // 登录后启动心跳
    startHeartbeat(r.token);
    location.href = "/";
  } catch (e: unknown) {
    const text = e instanceof Error ? e.message : "登录失败";
    if (text.includes("令牌已被禁用")) {
      try { const info = JSON.parse(text); setDisabledInfo({ at: info?.disabledAt || "", reason: info?.reason }); } catch { setDisabledInfo({ at: "", reason: undefined }); }
    }
    setErr(text);
  }
  };

  function startHeartbeat(jwt: string) {
    if (hbTimer.current) window.clearInterval(hbTimer.current);
    hbTimer.current = window.setInterval(async () => {
      try {
        await api("/api/activity/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ minutes: 1 }) });
      } catch {
        // 忽略心跳错误
      }
    }, 60 * 1000);
  }

  useEffect(() => () => { if (hbTimer.current) window.clearInterval(hbTimer.current); }, []);

  const submitInactivity = async () => {
    setErr(null); setMsg(null);
    await api("/api/inbox/report", { method: "POST", body: JSON.stringify({ email, reason: inactivityReason }) });
    setMsg("已提交原因，我们会尽快跟进");
  };

  return (
    <div className="page">
      <div className="container card">
        <div className="header">
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>乡村硅谷员工激励平台</div>
            <div className="muted" style={{ marginTop: 6 }}>邮箱验证码 + 硅谷专属令牌</div>
          </div>
          <div className="row">
            <button onClick={() => setMode("register")} className={"btn " + (mode === "register" ? "btn-primary" : "")}>注册</button>
            <button onClick={() => setMode("login")} className={"btn " + (mode === "login" ? "btn-primary" : "")}>登录</button>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          {/* 左：邮箱 + 验证码 + 令牌领取/复制 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="col">
                <span>企业邮箱</span>
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@company.com" type="email" className="input" />
              </label>
              <div className="row">
                <button onClick={requestOtp} className="btn" style={{ flex: 1 }}>发送验证码</button>
                <input value={code} onChange={e=>setCode(e.target.value)} placeholder="6 位验证码" className="input" style={{ flex: 1 }} />
                <button onClick={verifyOtp} className="btn">验证</button>
              </div>
              <label className="col">
                <span>硅谷专属令牌</span>
                <div className="row">
                  <input value={token} onChange={e=>setToken(e.target.value)} placeholder="点击右侧领取令牌或粘贴" className="input" style={{ flex: 1 }} />
                  <button onClick={issueExclusiveToken} className="btn">领取令牌</button>
                  {issuedToken && <button onClick={()=>navigator.clipboard.writeText(issuedToken!)} className="btn">复制</button>}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>每邮箱每月最多 3 次发放；超限次月再试。</div>
              </label>
          </div>

          {/* 右：注册或登录卡片 */}
          {mode === "register" ? (
            <div className="col">
              <label className="col">
                  <span>姓名</span>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="张三" className="input" />
              </label>
              <label className="col">
                <span>设置密码</span>
                <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="至少 6 位" className="input" />
              </label>
                <button onClick={registerWithToken} className="btn btn-primary" style={{ padding: 12, fontWeight: 600 }}>注册并登录</button>
            </div>
          ) : (
            <div className="col">
              <label className="col">
                  <span>密码</span>
                <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="至少 6 位" className="input" />
              </label>
                <button onClick={loginWithToken} className="btn btn-primary" style={{ padding: 12, fontWeight: 600 }}>立即登录</button>
            </div>
          )}
        </div>

        {disabledInfo && (
          <div className="alert-warn" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>令牌已被禁用</div>
            <div>禁用时间：{disabledInfo.at ? new Date(disabledInfo.at).toLocaleString() : "未知"}</div>
            {disabledInfo.reason && <div>原因：{disabledInfo.reason}</div>}
            <div className="row" style={{ marginTop: 8 }}>
              <input value={inactivityReason} onChange={e=>setInactivityReason(e.target.value)} placeholder="请填写未使用原因，管理员将尽快处理" className="input" style={{ flex: 1 }} />
              <button onClick={submitInactivity} className="btn" style={{ background: "#92400E", color: "white" }}>提交原因</button>
            </div>
          </div>
        )}

        {msg && <div className="alert-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="alert-danger" style={{ marginTop: 12 }}>{err}</div>}

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>内部系统，仅限公司员工使用。</div>
      </div>
    </div>
  );
}
