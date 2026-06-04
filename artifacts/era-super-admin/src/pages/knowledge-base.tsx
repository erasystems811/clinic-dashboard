import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { get, post, del } from "@/lib/api";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";

interface KBEntry {
  id: number;
  section: string;
  title: string;
  content: string;
  updatedAt: string;
}

const SECTIONS = ["Features", "API", "Troubleshooting", "Configuration", "Billing", "Other"];

export default function KnowledgeBase() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KBEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [section, setSection] = useState("Features");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await get("/super-admin/knowledge-base")); }
    catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setError(""); setSaving(true);
    try {
      await post("/super-admin/knowledge-base", {
        section,
        title: title.trim(),
        content: content.trim(),
      });
      setTitle(""); setContent(""); setSection("Features"); setEditing(null); setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await del(`/super-admin/knowledge-base/${id}`); load(); }
    catch { /* */ }
    finally { setDeleting(null); }
  };

  const startEdit = (entry: KBEntry) => {
    setEditing(entry);
    setSection(entry.section);
    setTitle(entry.title);
    setContent(entry.content);
    setShowForm(true);
  };

  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.section]) acc[e.section] = [];
    acc[e.section].push(e);
    return acc;
  }, {} as Record<string, KBEntry[]>);

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Document features, API changes, and troubleshooting. Support AI uses this + recent deployments to answer questions.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setEditing(null); setTitle(""); setContent(""); setSection("Features"); setError(""); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="font-semibold text-sm">{editing ? "Edit Entry" : "New KB Entry"}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Section</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={section} onChange={e => setSection(e.target.value)}>
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Title *</label>
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Named staff accounts" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Content *</label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[150px] resize-none"
                value={content} onChange={e => setContent(e.target.value)}
                placeholder="Explain the feature, how it works, any setup needed…" required />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); setTitle(""); setContent(""); }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Entry</>}
              </button>
            </div>
          </form>
        )}

        {/* Entries by section */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No KB entries yet. Create one to document your features and help the support AI answer questions.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([sec, items]) => (
              <div key={sec}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">{sec}</h3>
                <div className="space-y-2">
                  {items.map(entry => (
                    <div key={entry.id} className="rounded-lg border border-border bg-card p-4 flex items-start justify-between group hover:border-primary/30 transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{entry.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{entry.content}</p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          Updated {new Date(entry.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="shrink-0 flex gap-1.5 ml-3">
                        <button onClick={() => startEdit(entry)} disabled={deleting === entry.id}
                          className="p-1.5 text-muted-foreground hover:text-primary transition rounded opacity-0 group-hover:opacity-100">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(entry.id)} disabled={deleting === entry.id}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100">
                          {deleting === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
