import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { get, post, patch, del } from "@/lib/api";
import { Info, TriangleAlert, RefreshCw, Plus, Trash2, Loader2, Building2, Radio, Check, Edit, Sparkles, Layers } from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  appointments: "Appointments",
  feedback: "Feedback",
  wellness_newsletter: "Wellness Newsletter",
  messages: "Messages",
};

interface Announcement {
  id: number;
  hospitalId: number | null;
  hospitalName: string | null;
  title: string;
  message: string;
  type: "info" | "warning" | "update";
  published: boolean;
  createdAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
  targetModule: string | null;
}

interface HospitalOption { id: number; name: string; }

const TYPE_STYLES: Record<string, { label: string; cls: string; icon: typeof Info }> = {
  info:    { label: "Info",    cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: Info },
  warning: { label: "Warning", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: TriangleAlert },
  update:  { label: "Update",  cls: "bg-primary/10 text-primary border-primary/20",       icon: RefreshCw },
};

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "update">("info");
  const [targetAll, setTargetAll] = useState(true);
  const [hospitalId, setHospitalId] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [targetModule, setTargetModule] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ann, hosp] = await Promise.all([
        get<Announcement[]>("/super-admin/announcements"),
        get<{ id: number; name: string }[]>("/super-admin/hospitals").then(h => h.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name }))),
      ]);
      setItems(ann);
      setHospitals(hosp);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSaveError(""); setSaving(true);
    try {
      if (editingId) {
        await patch(`/super-admin/announcements/${editingId}`, {
          title: title.trim(),
          message: message.trim(),
          type,
          expiresAt: expiresAt || null,
          hospitalId: targetAll ? null : (hospitalId || null),
          targetModule: targetModule || null,
        });
      } else {
        await post("/super-admin/announcements", {
          title: title.trim(),
          message: message.trim(),
          type,
          hospitalId: targetAll ? null : (hospitalId || null),
          expiresAt: expiresAt || null,
          publish: publishNow,
          targetModule: targetModule || null,
        });
      }
      setTitle(""); setMessage(""); setType("info"); setTargetAll(true); setHospitalId(""); setExpiresAt(""); setTargetModule(""); setPublishNow(false); setEditingId(null);
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await del(`/super-admin/announcements/${id}`);
      await load();
    } catch {
      await load();
    } finally {
      setDeleting(null);
    }
  };

  const handlePublish = async (id: number) => {
    setDeleting(id);
    try { await patch(`/super-admin/announcements/${id}/publish`, {}); } catch { /* */ }
    finally { load(); setDeleting(null); }
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setMessage(a.message);
    setType(a.type);
    setExpiresAt(a.expiresAt ? a.expiresAt.split("T")[0] : "");
    setTargetAll(a.hospitalId === null);
    setHospitalId(a.hospitalId ?? "");
    setTargetModule(a.targetModule ?? "");
    setPublishNow(false);
    setShowForm(true);
  };

  const handleGenerate = async () => {
    setGenerating(true); setGenError("");
    try {
      const res = await fetch("/api/super-admin/announcements/auto-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-super-admin-token": localStorage.getItem("era_super_admin_token") || "" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to generate");
      }
      load();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  };

  const drafts = items.filter(a => !a.published);
  const published = items.filter(a => a.published);

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Announcements</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Push notices to hospital dashboards — feature updates, scheduled maintenance, policy changes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted transition disabled:opacity-50"
              title="Auto-generate draft announcements from recent code changes"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Generating…" : "Auto-draft"}
            </button>
            <button
              onClick={() => { setShowForm(v => !v); setSaveError(""); setEditingId(null); setTitle(""); setMessage(""); setType("info"); setExpiresAt(""); setTargetModule(""); setPublishNow(false); setTargetAll(true); setHospitalId(""); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
            >
              <Plus className="w-4 h-4" /> New Notice
            </button>
          </div>
        </div>

        {genError && <p className="text-xs text-destructive">{genError}</p>}

        {/* Create/Edit form */}
        {showForm && (
          <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="font-semibold text-sm">{editingId ? "Edit Draft" : "New Announcement"}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground font-medium">Title *</label>
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New feature: Named staff accounts" required />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground font-medium">Message *</label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Explain what's changing and what the hospital should do (if anything)…" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Type</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={type} onChange={e => setType(e.target.value as typeof type)}>
                  <option value="info">Info — general notice</option>
                  <option value="update">Update — feature change</option>
                  <option value="warning">Warning — action needed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Expires (optional)</label>
                <input type="date" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground font-medium">Module (optional — only show to hospitals with this module enabled)</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={targetModule} onChange={e => setTargetModule(e.target.value)}>
                  <option value="">All modules (no restriction)</option>
                  <option value="appointments">Appointments</option>
                  <option value="feedback">Patient Feedback</option>
                  <option value="wellness_newsletter">Wellness Newsletter</option>
                  <option value="messages">Messages / WhatsApp</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Target</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTargetAll(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${targetAll ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  <Radio className="w-3.5 h-3.5" /> All hospitals
                </button>
                <button type="button" onClick={() => setTargetAll(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${!targetAll ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  <Building2 className="w-3.5 h-3.5" /> Specific hospital
                </button>
              </div>
              {!targetAll && (
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={hospitalId} onChange={e => setHospitalId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— Select hospital —</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
            </div>

            {!editingId && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Save as</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPublishNow(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${!publishNow ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    📝 Draft (hidden)
                  </button>
                  <button type="button" onClick={() => setPublishNow(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${publishNow ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    ✓ Publish now
                  </button>
                </div>
              </div>
            )}

            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setTitle(""); setMessage(""); setType("info"); setExpiresAt(""); setTargetModule(""); setPublishNow(false); setTargetAll(true); setHospitalId(""); }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : editingId ? "Update Draft" : "Create Announcement"}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No announcements yet. Create one above to notify hospitals of upcoming changes.
          </div>
        ) : (
          <div className="space-y-6">
            {drafts.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">📝 Drafts (not visible to hospitals)</p>
                <div className="space-y-3">
                  {drafts.map(a => {
                    const s = TYPE_STYLES[a.type] ?? TYPE_STYLES.info;
                    const Icon = s.icon;
                    return (
                      <div key={a.id} className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-start gap-4">
                        <div className={`p-2 rounded-lg border shrink-0 ${s.cls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{a.title}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-px rounded border ${s.cls}`}>{s.label}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {a.hospitalName ? <><Building2 className="w-3 h-3" />{a.hospitalName}</> : <><Radio className="w-3 h-3" />All hospitals</>}
                            </span>
                            {a.targetModule && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Layers className="w-3 h-3" />{MODULE_LABELS[a.targetModule] ?? a.targetModule} only
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.message}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1.5">
                            Created {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {a.expiresAt ? ` · Expires ${new Date(a.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 flex gap-1.5">
                          <button type="button" onClick={() => startEdit(a)} disabled={deleting === a.id}
                            className="p-1.5 text-muted-foreground hover:text-primary transition rounded hover:bg-primary/10">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handlePublish(a.id)} disabled={deleting === a.id}
                            className="p-1.5 text-primary hover:bg-primary/10 transition rounded">
                            {deleting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button type="button" onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition rounded hover:bg-destructive/10">
                            {deleting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {published.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">✓ Published (visible to hospitals)</p>
                <div className="space-y-3">
                  {published.map(a => {
                    const s = TYPE_STYLES[a.type] ?? TYPE_STYLES.info;
                    const Icon = s.icon;
                    return (
                      <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
                        <div className={`p-2 rounded-lg border shrink-0 ${s.cls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{a.title}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-px rounded border ${s.cls}`}>{s.label}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {a.hospitalName ? <><Building2 className="w-3 h-3" />{a.hospitalName}</> : <><Radio className="w-3 h-3" />All hospitals</>}
                            </span>
                            {a.targetModule && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Layers className="w-3 h-3" />{MODULE_LABELS[a.targetModule] ?? a.targetModule} only
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.message}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1.5">
                            Published {new Date(a.publishedAt || a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {a.expiresAt ? ` · Expires ${new Date(a.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                          </p>
                        </div>
                        <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                          className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive transition rounded hover:bg-destructive/10">
                          {deleting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
