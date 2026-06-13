import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";
import Layout from "@/components/layout";
import { Upload, Trash2, Search, FileText, RefreshCw } from "lucide-react";

const CATEGORIES = ["weightloss", "psychology", "nutrition", "fitness", "general"] as const;
type Category = typeof CATEGORIES[number];

interface RagDocument {
  id: number;
  title: string;
  category: Category;
  source: string | null;
  chunk_index: number;
  content: string;
  created_at: string;
}

interface UploadResult {
  ok: boolean;
  chunks: number;
  title: string;
}

interface DocsResult {
  documents: RagDocument[];
  total: number;
}

interface TestResult {
  query: string;
  category: Category;
  results: string[];
}

const CAT_COLORS: Record<Category, string> = {
  weightloss: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  psychology:  "bg-violet-500/15 text-violet-400 border-violet-500/20",
  nutrition:   "bg-orange-500/15 text-orange-400 border-orange-500/20",
  fitness:     "bg-blue-500/15 text-blue-400 border-blue-500/20",
  general:     "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export default function KnowledgeBasePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upload" | "documents" | "test">("documents");
  const [filterCat, setFilterCat] = useState<Category | "all">("all");

  // Upload state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    category: "psychology" as Category,
    source: "",
    content: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Test state
  const [testQuery, setTestQuery] = useState("");
  const [testCat, setTestCat] = useState<Category>("psychology");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data: docsData, isLoading: docsLoading } = useQuery<DocsResult>({
    queryKey: ["rag-docs"],
    queryFn: () => get<DocsResult>("/super-admin/rag/documents"),
  });

  const uploadMut = useMutation({
    mutationFn: (body: typeof uploadForm) =>
      post<UploadResult>("/super-admin/rag/upload", body),
    onSuccess: (res) => {
      setUploadResult(res);
      setUploadForm((p) => ({ ...p, title: "", source: "", content: "" }));
      void qc.invalidateQueries({ queryKey: ["rag-docs"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (title: string) =>
      del<{ ok: boolean; deleted: number }>(`/super-admin/rag/documents/${encodeURIComponent(title)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["rag-docs"] }),
  });

  const testMut = useMutation({
    mutationFn: (body: { query: string; category: Category }) =>
      post<TestResult>("/super-admin/rag/test", body),
    onSuccess: setTestResult,
  });

  function handleFileRead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadForm((p) => ({ ...p, content: ev.target?.result as string, title: p.title || file.name.replace(/\.[^.]+$/, "") }));
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const filtered = (docsData?.documents ?? []).filter(
    (d) => filterCat === "all" || d.category === filterCat
  );

  const grouped = filtered.reduce<Record<string, RagDocument[]>>((acc, d) => {
    (acc[d.title] ??= []).push(d);
    return acc;
  }, {});

  return (
    <Layout breadcrumb={[{ label: "Knowledge Base" }]}>
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload documents for the diary companion (psychology) and weight loss coach (weightloss). Content is chunked, embedded, and retrieved at query time.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-foreground">{docsData?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">total chunks</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-card border border-border w-fit">
          {(["documents", "upload", "test"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Documents tab ── */}
        {tab === "documents" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", ...CATEGORIES] as const).map((c) => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition capitalize ${
                    filterCat === c ? "bg-primary/20 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  }`}>
                  {c}
                </button>
              ))}
            </div>

            {docsLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No documents yet. Upload some content to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(grouped).map(([title, chunks]) => {
                  const cat = chunks[0].category;
                  const date = new Date(chunks[0].created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
                  const preview = chunks[0].content.slice(0, 180);
                  return (
                    <div key={title} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${CAT_COLORS[cat]}`}>
                              {cat}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50">{chunks.length} chunk{chunks.length !== 1 ? "s" : ""}</span>
                            <span className="text-[10px] text-muted-foreground/40">{date}</span>
                            {chunks[0].source && (
                              <span className="text-[10px] text-muted-foreground/50 truncate max-w-[160px]">{chunks[0].source}</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{preview}…</p>
                        </div>
                        <button
                          onClick={() => { if (confirm(`Delete all chunks for "${title}"?`)) deleteMut.mutate(title); }}
                          disabled={deleteMut.isPending}
                          className="shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Upload tab ── */}
        {tab === "upload" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Upload document</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Title</label>
                <input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. CBT Techniques for Anxiety"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm((p) => ({ ...p, category: e.target.value as Category }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Source URL / Reference (optional)</label>
              <input
                value={uploadForm.source}
                onChange={(e) => setUploadForm((p) => ({ ...p, source: e.target.value }))}
                placeholder="e.g. WHO guidelines 2024, book title, URL…"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</label>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition">
                  <Upload className="w-3 h-3" /> Load from file (.txt, .md)
                </button>
                <input ref={fileRef} type="file" accept=".txt,.md,.text" className="hidden" onChange={handleFileRead} />
              </div>
              <textarea
                value={uploadForm.content}
                onChange={(e) => setUploadForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Paste research content, guidelines, study findings, or any text you want the system to draw on…"
                rows={12}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition resize-none font-mono"
              />
              <p className="text-[11px] text-muted-foreground/50 mt-1">
                {uploadForm.content.length} chars · ~{Math.ceil(uploadForm.content.length / 800)} chunks estimated
              </p>
            </div>

            {uploadResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-400">
                ✓ Uploaded "{uploadResult.title}" — {uploadResult.chunks} chunk{uploadResult.chunks !== 1 ? "s" : ""} stored and embedded
              </div>
            )}

            {uploadMut.isError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                Upload failed. Check the console for details.
              </div>
            )}

            <button
              onClick={() => { setUploadResult(null); uploadMut.mutate(uploadForm); }}
              disabled={!uploadForm.title || !uploadForm.content || uploadMut.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50 transition hover:opacity-90 active:scale-[0.98]">
              {uploadMut.isPending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Chunking & embedding…</>
                : <><Upload className="w-4 h-4" /> Upload to knowledge base</>}
            </button>
          </div>
        )}

        {/* ── Test tab ── */}
        {tab === "test" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Test retrieval</h2>
              <p className="text-xs text-muted-foreground">Simulate what the system retrieves for a given query. Use this to verify your uploads are working.</p>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Query</label>
                <input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="e.g. how to manage anxiety symptoms"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setTestCat(c)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition capitalize ${
                        testCat === c ? "bg-primary/20 text-primary border-primary/30" : "bg-card text-muted-foreground border-border"
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => testMut.mutate({ query: testQuery, category: testCat })}
                disabled={!testQuery.trim() || testMut.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 transition hover:opacity-90">
                {testMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Searching…</> : <><Search className="w-3.5 h-3.5" /> Run retrieval</>}
              </button>
            </div>

            {testResult && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {testResult.results.length} chunk{testResult.results.length !== 1 ? "s" : ""} retrieved for "{testResult.query}"
                </p>
                {testResult.results.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-4 text-center text-sm text-muted-foreground">
                    No relevant chunks found. Try uploading content in the "{testResult.category}" category.
                  </div>
                ) : (
                  testResult.results.map((chunk, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4">
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">Chunk {i + 1}</p>
                      <p className="text-xs text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap">{chunk}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
