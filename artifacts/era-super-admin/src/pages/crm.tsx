import { useState, useEffect, useCallback, useRef } from "react";
import { api, type CrmLead, type CrmRequest } from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";

const STAGES = [
  { id: "identified",    label: "Identified",    color: "#4A5568" },
  { id: "visited",       label: "Visited",        color: "#2B6CB0" },
  { id: "proposal_sent", label: "Proposal Sent",  color: "#6B46C1" },
  { id: "follow_up",     label: "Follow Up",      color: "#C05621" },
  { id: "responded",     label: "Responded",      color: "#2C7A7B" },
  { id: "approved",      label: "Approved",       color: "#276749" },
  { id: "declined",      label: "Declined",       color: "#9B2C2C" },
  { id: "paid",          label: "Paid",           color: "#1A365D" },
];

const EMPTY_FORM = { name: "", contact_person: "", last_contacted: "", stage: "identified", notes: "" };
const GENERAL_KEY = "era-crm-general-tasks-v1";

interface GeneralTask {
  id: string;
  text: string;
  dateAdded: string;
  dateDone: string | null;
  done: boolean;
}

function today() { return new Date().toISOString().split("T")[0]; }

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysSince(d: string | null | undefined) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function uid() { return crypto.randomUUID(); }

function loadGeneralTasks(): GeneralTask[] {
  try { return JSON.parse(localStorage.getItem(GENERAL_KEY) ?? "[]"); } catch { return []; }
}
function saveGeneralTasks(tasks: GeneralTask[]) {
  try { localStorage.setItem(GENERAL_KEY, JSON.stringify(tasks)); } catch { /**/ }
}

function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" style={{ ...S.input, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        onClick={() => setOpen(v => !v)}>
        <span style={{ color: value ? "#E2E8F0" : "#4B5563" }}>
          {value ? formatDate(value) : "Pick a date"}
        </span>
        <span style={{ fontSize: 12, color: "#6B7280" }}>📅</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "#1A2035", border: "1px solid #1F2937", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={day => {
              if (day) {
                const iso = day.toLocaleDateString("en-CA"); // YYYY-MM-DD
                onChange(iso);
                setOpen(false);
              }
            }}
            captionLayout="dropdown"
            fromYear={2020}
            toYear={new Date().getFullYear() + 1}
          />
          {value && (
            <div style={{ borderTop: "1px solid #1F2937", padding: "8px 12px" }}>
              <button type="button" style={{ background: "none", border: "none", color: "#FC8181", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => { onChange(""); setOpen(false); }}>
                Clear date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CRMPage() {
  const [leads, setLeads]           = useState<CrmLead[]>([]);
  const [generalTasks, setGeneralTasks] = useState<GeneralTask[]>(() => loadGeneralTasks());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  const [view, setView]             = useState<"board" | "actions">("board");
  const [showLeadForm, setShowLeadForm]   = useState(false);
  const [leadForm, setLeadForm]     = useState(EMPTY_FORM);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead]   = useState<CrmLead | null>(null);
  const [showRequestModal, setShowRequestModal] = useState<string | null>(null);
  const [requestText, setRequestText]     = useState("");
  const [newGeneralTask, setNewGeneralTask]   = useState("");
  const [showGeneralInput, setShowGeneralInput] = useState(false);
  const [error, setError]           = useState("");

  const [dragging, setDragging]     = useState<CrmLead | null>(null);
  const [dragOver, setDragOver]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listCrmLeads();
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep selectedLead in sync after any reload
  useEffect(() => {
    if (selectedLead) {
      const fresh = leads.find(l => l.id === selectedLead.id);
      if (fresh) setSelectedLead(fresh);
    }
  }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateGeneralTasks(tasks: GeneralTask[]) {
    setGeneralTasks(tasks);
    saveGeneralTasks(tasks);
  }

  async function submitLead() {
    if (!leadForm.name.trim()) return;
    setSaving(true);
    try {
      if (editLeadId) {
        await api.updateCrmLead(editLeadId, {
          name: leadForm.name,
          contact_person: leadForm.contact_person,
          stage: leadForm.stage,
          last_contacted: leadForm.last_contacted || undefined,
          notes: leadForm.notes,
        });
      } else {
        await api.createCrmLead({
          name: leadForm.name,
          contact_person: leadForm.contact_person,
          stage: leadForm.stage,
          last_contacted: leadForm.last_contacted || undefined,
          notes: leadForm.notes,
        });
      }
      setShowLeadForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    setSaving(true);
    try {
      await api.deleteCrmLead(id);
      setSelectedLead(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function moveStage(leadId: string, stage: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage } : l));
    try {
      await api.updateCrmLead(leadId, { stage });
    } catch {
      await load();
    }
  }

  async function logRequest(leadId: string) {
    if (!requestText.trim()) return;
    setSaving(true);
    try {
      await api.addCrmRequest(leadId, requestText.trim());
      setRequestText("");
      setShowRequestModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log request");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRequest(req: CrmRequest) {
    const nowDone = !req.done;
    // Optimistic update
    setLeads(prev => prev.map(l => ({
      ...l,
      crm_requests: l.crm_requests.map(r =>
        r.id === req.id ? { ...r, done: nowDone, date_done: nowDone ? today() : null } : r
      ),
    })));
    try {
      await api.updateCrmRequest(req.id, { done: nowDone, date_done: nowDone ? today() : null });
    } catch {
      await load();
    }
  }

  function addGeneralTask() {
    if (!newGeneralTask.trim()) return;
    updateGeneralTasks([...generalTasks, { id: uid(), text: newGeneralTask.trim(), dateAdded: today(), dateDone: null, done: false }]);
    setNewGeneralTask("");
    setShowGeneralInput(false);
  }

  function toggleGeneralTask(id: string) {
    updateGeneralTasks(generalTasks.map(t =>
      t.id === id ? { ...t, done: !t.done, dateDone: !t.done ? today() : null } : t
    ));
  }

  function deleteGeneralTask(id: string) {
    updateGeneralTasks(generalTasks.filter(t => t.id !== id));
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    if (dragging && dragging.stage !== stageId) moveStage(dragging.id, stageId);
    setDragging(null);
    setDragOver(null);
  }

  const allPendingRequests = leads.flatMap(l =>
    l.crm_requests.filter(r => !r.done).map(r => ({ ...r, leadName: l.name, leadId: l.id }))
  );
  const pendingGeneralTasks = generalTasks.filter(t => !t.done);
  const totalPending = allPendingRequests.length + pendingGeneralTasks.length;

  const stageMap: Record<string, CrmLead[]> = {};
  STAGES.forEach(s => { stageMap[s.id] = leads.filter(l => l.stage === s.id); });

  if (loading) return (
    <div style={S.center}>
      <div style={S.spinner} />
      <span style={{ color: "#6B7280", fontSize: 13, letterSpacing: 1 }}>Loading...</span>
    </div>
  );

  return (
    <div style={S.root}>
      {error && (
        <div style={{ background: "#7B1D1D", color: "#FEB2B2", padding: "10px 20px", fontSize: 13 }}>
          {error} — <button style={{ color: "#FEB2B2", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }} onClick={load}>Retry</button>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logoRow}>
            <span style={S.logo}>ERA</span>
            <span style={S.logoSub}>SYSTEMS</span>
          </div>
          <div style={S.headerSub}>Hospital Pipeline</div>
        </div>
        <div style={S.headerRight}>
          {saving && <span style={S.savingTag}>Saving...</span>}
          <button style={{ ...S.tabBtn, ...(view === "actions" ? S.tabActive : {}) }} onClick={() => setView("actions")}>
            Actions {totalPending > 0 && <span style={S.badge}>{totalPending}</span>}
          </button>
          <button style={{ ...S.tabBtn, ...(view === "board" ? S.tabActive : {}) }} onClick={() => setView("board")}>
            Pipeline
          </button>
          <button style={S.goldBtn} onClick={() => { setLeadForm(EMPTY_FORM); setEditLeadId(null); setShowLeadForm(true); }}>+ Add Lead</button>
        </div>
      </div>

      {/* Stats */}
      <div style={S.statsBar}>
        {[
          { label: "Total Leads",     val: leads.length },
          { label: "Approved",        val: leads.filter(l => l.stage === "approved").length },
          { label: "Paid",            val: leads.filter(l => l.stage === "paid").length },
          { label: "Pending Actions", val: totalPending, warn: totalPending > 0 },
        ].map((s, i) => (
          <div key={i} style={S.statGroup}>
            {i > 0 && <div style={S.statDivider} />}
            <div style={S.stat}>
              <span style={{ ...S.statNum, color: s.warn ? "#FC8181" : "#C9A84C" }}>{s.val}</span>
              <span style={S.statLabel}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions view */}
      {view === "actions" && (
        <div style={S.actionsWrap}>
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>Lead Requests</span>
              <span style={S.sectionCount}>{allPendingRequests.length} pending</span>
            </div>
            {allPendingRequests.length === 0 ? (
              <div style={S.emptyMsg}>No pending requests</div>
            ) : allPendingRequests.map(r => (
              <div key={r.id} style={S.actionRow}>
                <div style={{ ...S.checkbox, ...(r.done ? S.checkboxDone : {}) }} onClick={() => toggleRequest(r)}>
                  {r.done && "✓"}
                </div>
                <div style={S.actionText}>
                  <span style={S.actionHospital}>{r.leadName}</span>
                  <span style={S.actionReq}>{r.text}</span>
                  <span style={S.actionDate}>Requested {formatDate(r.date_added)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={S.section}>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>ERA Systems Tasks</span>
              <button style={S.addTaskBtn} onClick={() => setShowGeneralInput(true)}>+ Add Task</button>
            </div>
            {showGeneralInput && (
              <div style={S.inlineInput}>
                <input style={{ ...S.input, flex: 1 }} placeholder="e.g. Update proposal template" value={newGeneralTask}
                  onChange={e => setNewGeneralTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addGeneralTask()} autoFocus />
                <button style={S.goldBtn} onClick={addGeneralTask}>Add</button>
                <button style={S.ghostBtn} onClick={() => setShowGeneralInput(false)}>Cancel</button>
              </div>
            )}
            {pendingGeneralTasks.length === 0 && !showGeneralInput
              ? <div style={S.emptyMsg}>No pending tasks — add one above</div>
              : pendingGeneralTasks.map(t => (
                <div key={t.id} style={S.actionRow}>
                  <div style={{ ...S.checkbox, ...(t.done ? S.checkboxDone : {}) }} onClick={() => toggleGeneralTask(t.id)}>
                    {t.done && "✓"}
                  </div>
                  <div style={S.actionText}>
                    <span style={S.actionReq}>{t.text}</span>
                    <span style={S.actionDate}>Added {formatDate(t.dateAdded)}</span>
                  </div>
                  <button style={S.deleteSmall} onClick={() => deleteGeneralTask(t.id)}>✕</button>
                </div>
              ))
            }
            {generalTasks.filter(t => t.done).length > 0 && (
              <>
                <div style={S.completedHeader}>Completed</div>
                {generalTasks.filter(t => t.done).map(t => (
                  <div key={t.id} style={{ ...S.actionRow, opacity: 0.45 }}>
                    <div style={{ ...S.checkbox, ...S.checkboxDone }} onClick={() => toggleGeneralTask(t.id)}>✓</div>
                    <div style={S.actionText}>
                      <span style={{ ...S.actionReq, textDecoration: "line-through" }}>{t.text}</span>
                      <span style={S.actionDate}>Done {formatDate(t.dateDone)}</span>
                    </div>
                    <button style={S.deleteSmall} onClick={() => deleteGeneralTask(t.id)}>✕</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Kanban board */}
      {view === "board" && (
        <div style={S.board}>
          {STAGES.map(stage => (
            <div key={stage.id}
              style={{ ...S.column, borderTop: `3px solid ${stage.color}`, background: dragOver === stage.id ? "#1a2340" : "#111827" }}
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
              onDrop={e => handleDrop(e, stage.id)}
              onDragLeave={() => setDragOver(null)}
            >
              <div style={S.colHeader}>
                <span style={{ ...S.colTitle, color: stage.color }}>{stage.label}</span>
                <span style={S.colCount}>{stageMap[stage.id]?.length ?? 0}</span>
              </div>
              <div style={S.cards}>
                {(stageMap[stage.id] ?? []).length === 0 && <div style={S.emptyCol}>Drop here</div>}
                {(stageMap[stage.id] ?? []).map(lead => {
                  const pending = lead.crm_requests.filter(r => !r.done).length;
                  const days = daysSince(lead.last_contacted);
                  const overdue = pending > 0 && days !== null && days > 7;
                  return (
                    <div key={lead.id} draggable
                      onDragStart={e => { setDragging(lead); e.dataTransfer.effectAllowed = "move"; }}
                      style={{ ...S.card, opacity: dragging?.id === lead.id ? 0.4 : 1, borderLeft: overdue ? "3px solid #E53E3E" : `3px solid ${stage.color}` }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div style={S.cardName}>{lead.name}</div>
                      {lead.contact_person && <div style={S.cardMeta}>👤 {lead.contact_person}</div>}
                      {lead.last_contacted && (
                        <div style={S.cardMeta}>
                          🗓 {formatDate(lead.last_contacted)}
                          {days !== null && <span style={{ color: days > 7 ? "#FC8181" : "#68D391", marginLeft: 4 }}>({days}d ago)</span>}
                        </div>
                      )}
                      <div style={S.cardBottom}>
                        {pending > 0 && <span style={S.pendingPill}>{pending} pending</span>}
                        <button style={S.logBtn} onClick={e => { e.stopPropagation(); setShowRequestModal(lead.id); setRequestText(""); }}>
                          + Log Request
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead detail modal */}
      {selectedLead && (() => {
        const lead = leads.find(l => l.id === selectedLead.id) ?? selectedLead;
        const stageObj = STAGES.find(s => s.id === lead.stage);
        const pendingReqs = lead.crm_requests.filter(r => !r.done);
        const doneReqs    = lead.crm_requests.filter(r => r.done);
        return (
          <div style={S.overlay} onClick={() => setSelectedLead(null)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHead}>
                <div>
                  <div style={S.modalName}>{lead.name}</div>
                  <span style={{ ...S.stagePill, background: stageObj?.color }}>{stageObj?.label}</span>
                </div>
                <button style={S.closeBtn} onClick={() => setSelectedLead(null)}>✕</button>
              </div>
              <div style={S.modalBody}>
                {lead.contact_person && <div style={S.detailRow}><span style={S.detailLabel}>Contact</span><span style={S.detailVal}>{lead.contact_person}</span></div>}
                {lead.last_contacted  && <div style={S.detailRow}><span style={S.detailLabel}>Last Contacted</span><span style={S.detailVal}>{formatDate(lead.last_contacted)}</span></div>}
                {lead.notes           && <div style={S.detailRow}><span style={S.detailLabel}>Notes</span><span style={S.detailVal}>{lead.notes}</span></div>}

                <div style={S.detailLabel}>Move Stage</div>
                <div style={S.stageGrid}>
                  {STAGES.map(s => (
                    <button key={s.id}
                      style={{ ...S.stageMoveBtn, background: lead.stage === s.id ? s.color : "#1F2937", border: `1px solid ${s.color}` }}
                      onClick={() => moveStage(lead.id, s.id)}
                    >{s.label}</button>
                  ))}
                </div>

                <div style={S.reqHeader}>
                  <span style={S.detailLabel}>Requests & Actions</span>
                  <button style={S.addTaskBtn} onClick={() => { setShowRequestModal(lead.id); setRequestText(""); setSelectedLead(null); }}>+ Log Request</button>
                </div>
                {pendingReqs.length === 0 && doneReqs.length === 0 && <div style={S.emptyMsg}>No requests logged yet</div>}
                {pendingReqs.map(r => (
                  <div key={r.id} style={S.actionRow}>
                    <div style={S.checkbox} onClick={() => toggleRequest(r)} />
                    <div style={S.actionText}>
                      <span style={S.actionReq}>{r.text}</span>
                      <span style={S.actionDate}>Requested {formatDate(r.date_added)}</span>
                    </div>
                  </div>
                ))}
                {doneReqs.length > 0 && (
                  <>
                    <div style={S.completedHeader}>Completed</div>
                    {doneReqs.map(r => (
                      <div key={r.id} style={{ ...S.actionRow, opacity: 0.45 }}>
                        <div style={{ ...S.checkbox, ...S.checkboxDone }} onClick={() => toggleRequest(r)}>✓</div>
                        <div style={S.actionText}>
                          <span style={{ ...S.actionReq, textDecoration: "line-through" }}>{r.text}</span>
                          <span style={S.actionDate}>Done {formatDate(r.date_done)}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div style={S.modalFoot}>
                <button style={S.goldBtn} onClick={() => {
                  setLeadForm({ name: lead.name, contact_person: lead.contact_person, stage: lead.stage, last_contacted: lead.last_contacted ?? "", notes: lead.notes });
                  setEditLeadId(lead.id);
                  setShowLeadForm(true);
                  setSelectedLead(null);
                }}>Edit Lead</button>
                <button style={S.dangerBtn} onClick={() => deleteLead(lead.id)}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Log request modal */}
      {showRequestModal && (
        <div style={S.overlay} onClick={() => setShowRequestModal(null)}>
          <div style={{ ...S.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.modalName}>Log Request — {leads.find(l => l.id === showRequestModal)?.name}</div>
              <button style={S.closeBtn} onClick={() => setShowRequestModal(null)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <textarea style={{ ...S.input, height: 90, resize: "vertical" }}
                placeholder="What did they request? e.g. Send proposal by Friday"
                value={requestText} onChange={e => setRequestText(e.target.value)} autoFocus />
            </div>
            <div style={S.modalFoot}>
              <button style={S.goldBtn} onClick={() => logRequest(showRequestModal!)} disabled={saving}>
                {saving ? "Saving..." : "Log Request"}
              </button>
              <button style={S.ghostBtn} onClick={() => setShowRequestModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/edit lead modal */}
      {showLeadForm && (
        <div style={S.overlay} onClick={() => setShowLeadForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.modalName}>{editLeadId ? "Edit Lead" : "Add Lead"}</div>
              <button style={S.closeBtn} onClick={() => setShowLeadForm(false)}>✕</button>
            </div>
            <div style={S.modalBody}>
              {([
                { label: "Hospital Name *", key: "name" as const, placeholder: "e.g. MEV Specialist Hospital" },
                { label: "Contact Person",  key: "contact_person" as const, placeholder: "e.g. Dr. Amaka Obi" },
              ] as const).map(f => (
                <div key={f.key} style={S.formGroup}>
                  <label style={S.detailLabel}>{f.label}</label>
                  <input style={S.input} value={leadForm[f.key]}
                    onChange={e => setLeadForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div style={S.formGroup}>
                <label style={S.detailLabel}>Stage</label>
                <select style={S.input} value={leadForm.stage} onChange={e => setLeadForm(prev => ({ ...prev, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.detailLabel}>Last Contacted</label>
                <DatePickerField
                  value={leadForm.last_contacted}
                  onChange={v => setLeadForm(prev => ({ ...prev, last_contacted: v }))}
                />
              </div>
              <div style={S.formGroup}>
                <label style={S.detailLabel}>Notes</label>
                <textarea style={{ ...S.input, height: 80, resize: "vertical" }} value={leadForm.notes}
                  onChange={e => setLeadForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Key context about this prospect..." />
              </div>
            </div>
            <div style={S.modalFoot}>
              <button style={S.goldBtn} onClick={submitLead} disabled={saving}>
                {saving ? "Saving..." : editLeadId ? "Save Changes" : "Add Lead"}
              </button>
              <button style={S.ghostBtn} onClick={() => setShowLeadForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:            { minHeight: "100vh", background: "#0D1117", fontFamily: "'DM Mono','Courier New',monospace", color: "#E2E8F0", paddingBottom: 60 },
  center:          { minHeight: "100vh", background: "#0D1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 },
  spinner:         { width: 32, height: 32, borderRadius: "50%", border: "3px solid #C9A84C", borderTopColor: "transparent" },
  header:          { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px 14px", borderBottom: "1px solid #1F2937", flexWrap: "wrap", gap: 12 },
  logoRow:         { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 },
  logo:            { fontSize: 20, fontWeight: 700, color: "#C9A84C", letterSpacing: 4 },
  logoSub:         { fontSize: 10, color: "#6B7280", letterSpacing: 3 },
  headerSub:       { fontSize: 11, color: "#9CA3AF", letterSpacing: 2, textTransform: "uppercase" },
  headerRight:     { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  savingTag:       { fontSize: 11, color: "#6B7280", letterSpacing: 1 },
  badge:           { background: "#E53E3E", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", marginLeft: 6 },
  tabBtn:          { background: "transparent", border: "1px solid #1F2937", color: "#9CA3AF", padding: "8px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center" },
  tabActive:       { background: "#1F2937", color: "#E2E8F0", borderColor: "#374151" },
  goldBtn:         { background: "#C9A84C", color: "#0D1117", border: "none", padding: "9px 18px", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  ghostBtn:        { background: "transparent", border: "1px solid #374151", color: "#9CA3AF", padding: "9px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  dangerBtn:       { background: "transparent", border: "1px solid #FC8181", color: "#FC8181", padding: "9px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  statsBar:        { display: "flex", alignItems: "center", padding: "12px 28px", borderBottom: "1px solid #1F2937", background: "#111827", flexWrap: "wrap" },
  statGroup:       { display: "flex", alignItems: "center" },
  stat:            { display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px" },
  statNum:         { fontSize: 26, fontWeight: 700, lineHeight: "1" },
  statLabel:       { fontSize: 9, color: "#6B7280", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 },
  statDivider:     { width: 1, height: 32, background: "#1F2937" },
  actionsWrap:     { maxWidth: 680, margin: "28px auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 24 },
  section:         { background: "#111827", border: "1px solid #1F2937", borderRadius: 10, padding: "20px" },
  sectionHeader:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle:    { fontSize: 12, fontWeight: 700, color: "#C9A84C", letterSpacing: 2, textTransform: "uppercase" },
  sectionCount:    { fontSize: 11, color: "#6B7280" },
  addTaskBtn:      { background: "transparent", border: "1px solid #C9A84C", color: "#C9A84C", padding: "5px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  inlineInput:     { display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" },
  emptyMsg:        { color: "#4B5563", fontSize: 12, padding: "10px 0", textAlign: "center" },
  completedHeader: { fontSize: 10, color: "#4B5563", letterSpacing: 2, textTransform: "uppercase", margin: "14px 0 8px" },
  actionRow:       { display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #1A2035" },
  checkbox:        { width: 20, height: 20, borderRadius: 4, border: "1.5px solid #374151", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginTop: 2 },
  checkboxDone:    { background: "#276749", border: "none", color: "#fff" },
  actionText:      { display: "flex", flexDirection: "column", gap: 3, flex: 1 },
  actionHospital:  { fontSize: 10, color: "#C9A84C", letterSpacing: 1, textTransform: "uppercase" },
  actionReq:       { fontSize: 13, color: "#D1D5DB" },
  actionDate:      { fontSize: 10, color: "#6B7280" },
  deleteSmall:     { background: "transparent", border: "none", color: "#4B5563", cursor: "pointer", fontSize: 14, padding: 2, fontFamily: "inherit" },
  board:           { display: "flex", gap: 10, padding: "20px 16px", overflowX: "auto", alignItems: "flex-start" },
  column:          { minWidth: 195, maxWidth: 210, borderRadius: 8, padding: "12px 10px", flexShrink: 0, transition: "background 0.15s" },
  colHeader:       { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  colTitle:        { fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" },
  colCount:        { background: "#1F2937", color: "#6B7280", fontSize: 10, borderRadius: 10, padding: "1px 7px" },
  cards:           { display: "flex", flexDirection: "column", gap: 8, minHeight: 50 },
  emptyCol:        { border: "1px dashed #1F2937", borderRadius: 6, padding: "12px", textAlign: "center", color: "#374151", fontSize: 10 },
  card:            { background: "#1A2035", borderRadius: 6, padding: "10px", cursor: "grab" },
  cardName:        { fontSize: 12, fontWeight: 700, color: "#E2E8F0", marginBottom: 5 },
  cardMeta:        { fontSize: 10, color: "#9CA3AF", marginBottom: 2 },
  cardBottom:      { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 4 },
  pendingPill:     { background: "#7B341E", color: "#FEB2B2", fontSize: 9, padding: "2px 7px", borderRadius: 10 },
  logBtn:          { background: "transparent", border: "1px solid #374151", color: "#9CA3AF", fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" },
  overlay:         { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal:           { background: "#111827", border: "1px solid #1F2937", borderRadius: 10, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" },
  modalHead:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 22px 14px", borderBottom: "1px solid #1F2937" },
  modalName:       { fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 6 },
  stagePill:       { display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 10, color: "#fff", fontWeight: 600 },
  closeBtn:        { background: "transparent", border: "none", color: "#6B7280", fontSize: 18, cursor: "pointer", fontFamily: "inherit", padding: 2 },
  modalBody:       { padding: "14px 22px", display: "flex", flexDirection: "column", gap: 14 },
  modalFoot:       { display: "flex", gap: 10, padding: "14px 22px", borderTop: "1px solid #1F2937" },
  detailRow:       { display: "flex", flexDirection: "column", gap: 3 },
  detailLabel:     { fontSize: 9, color: "#6B7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  detailVal:       { fontSize: 13, color: "#D1D5DB" },
  stageGrid:       { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: 6 },
  stageMoveBtn:    { padding: "5px 10px", borderRadius: 5, fontSize: 10, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" },
  reqHeader:       { display: "flex", justifyContent: "space-between", alignItems: "center" },
  formGroup:       { display: "flex", flexDirection: "column", gap: 6 },
  input:           { background: "#1A2035", border: "1px solid #1F2937", borderRadius: 6, padding: "9px 12px", color: "#E2E8F0", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
};
