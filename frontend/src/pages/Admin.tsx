import { useCallback, useEffect, useMemo, useState } from "react";

type Session = { status: string; token: string; profile: { id: number; email: string; displayName: string; role: string } };
type Report = {
  id: number;
  userId: number | null;
  email: string;
  reason: string;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
};

async function api<T>(path: string, jwt: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}`, ...(init?.headers || {}) } });
  if (!resp.ok) {
    try { const data = await resp.json(); throw new Error(data?.message || JSON.stringify(data)); } catch { throw new Error(await resp.text()); }
  }
  return resp.json();
}

function useSession(): Session | null {
  const raw = localStorage.getItem("incentive_dashboard_session");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function AdminPage() {
  const session = useSession();
  const jwt = session?.token ?? "";
  const isAdmin = session?.profile?.role === "ADMIN";

  const [pending, setPending] = useState<Report[]>([]);
  const [resolved, setResolved] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"PENDING" | "RESOLVED">("PENDING");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const list = filterTab === "PENDING" ? pending : resolved;
    if (!q.trim()) return list;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter(r => {
      const s = `${r.id} ${r.email} ${r.reason} ${r.adminNote ?? ""}`.toLowerCase();
      return words.every(w => s.includes(w));
    });
  }, [filterTab, pending, resolved, q]);

  const load = useCallback(async () => {
    if (!jwt) return;
    setLoading(true); setError(null);
    try {
      const [p, r] = await Promise.all([
        api<{ ok: boolean; items: Report[] }>("/api/inbox/admin?status=PENDING", jwt),
        api<{ ok: boolean; items: Report[] }>("/api/inbox/admin?status=RESOLVED", jwt),
      ]);
      setPending(p.items);
      setResolved(r.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function resolveReport(id: number) {
    const note = window.prompt("处理备注（可留空）:") ?? "";
    try {
      await api("/api/inbox/admin/resolve", jwt, { method: "POST", body: JSON.stringify({ id, note }) });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function exportJSON() {
    const data = JSON.stringify({ pending, resolved }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inbox_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
        <div style={{ background: "white", padding: 24, borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>需要登录</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>请先前往 /auth 使用管理员账号登录</div>
          <div style={{ marginTop: 12 }}><a href="/auth" style={{ color: "#2563eb" }}>转到登录</a></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fef2f2" }}>
        <div style={{ background: "white", padding: 24, borderRadius: 12, border: "1px solid #fecaca" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#991b1b" }}>权限不足</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>当前登录账号不是管理员。请使用管理员账号登录。</div>
          <div style={{ marginTop: 12 }}><a href="/auth" style={{ color: "#2563eb" }}>切换账号</a></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>管理员面板 · 未使用原因收件箱</div>
            <div style={{ color: "#6b7280", marginTop: 4 }}>查看、筛选、导出与处理用户提交的未使用原因</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={load} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>{loading ? "刷新中..." : "刷新"}</button>
            <button onClick={exportJSON} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>导出 JSON</button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setFilterTab("PENDING")} style={{ padding: "8px 12px", background: filterTab === "PENDING" ? "#111827" : "transparent", color: filterTab === "PENDING" ? "white" : "#111827", border: 0 }}>待处理 {pending.length}</button>
            <button onClick={() => setFilterTab("RESOLVED")} style={{ padding: "8px 12px", background: filterTab === "RESOLVED" ? "#111827" : "transparent", color: filterTab === "RESOLVED" ? "white" : "#111827", border: 0 }}>已处理 {resolved.length}</button>
          </div>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索 邮箱/原因/备注" style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "white" }} />
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "#991b1b", background: "#fee2e2", padding: 8, borderRadius: 8 }}>{error}</div>
        )}

        <div style={{ marginTop: 16, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>ID</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>邮箱</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>用户ID</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>原因</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>状态</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>创建时间</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>处理时间</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>备注</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>暂无数据</td>
                </tr>
              ) : (
                visible.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 12 }}>{r.id}</td>
                    <td style={{ padding: 12 }}>{r.email}</td>
                    <td style={{ padding: 12 }}>{r.userId ?? "-"}</td>
                    <td style={{ padding: 12, whiteSpace: "pre-wrap" }}>{r.reason}</td>
                    <td style={{ padding: 12 }}>{r.status}</td>
                    <td style={{ padding: 12 }}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{ padding: 12 }}>{r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : "-"}</td>
                    <td style={{ padding: 12, whiteSpace: "pre-wrap" }}>{r.adminNote ?? "-"}</td>
                    <td style={{ padding: 12 }}>
                      {r.status === "PENDING" ? (
                        <button onClick={() => resolveReport(r.id)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "white" }}>标记已处理</button>
                      ) : (
                        <span style={{ color: "#6b7280" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
