import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl, authHeader } from "@/lib/api";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, X, ChevronRight, Download,
} from "lucide-react";

// ── Patient fields the import supports ───────────────────────────────────────

const PATIENT_FIELDS = [
  { key: "fullName",      label: "Full Name (combined)",    required: false },
  { key: "firstName",     label: "First Name",              required: false },
  { key: "lastName",      label: "Last Name",               required: false },
  { key: "email",         label: "Email",                   required: false },
  { key: "phone",         label: "Phone",                   required: false },
  { key: "dateOfBirth",   label: "Date of Birth",           required: false },
  { key: "age",           label: "Age",                     required: false },
  { key: "gender",        label: "Gender",                  required: false },
  { key: "lastVisitedAt", label: "Last Visit Date",         required: false },
  { key: "patientId",     label: "Hospital Patient ID / MRN", required: false },
  { key: "notes",         label: "Notes",                   required: false },
] as const;

type PatientField = typeof PATIENT_FIELDS[number]["key"];

// Auto-detect column name → patient field
const FIELD_ALIASES: Record<PatientField, string[]> = {
  fullName:      ["name", "full name", "fullname", "full_name", "patient name", "patient_name"],
  firstName:     ["first name", "firstname", "first_name", "given name", "given_name", "forename", "name (first)"],
  lastName:      ["last name", "lastname", "last_name", "surname", "family name", "family_name", "second name", "name (last)"],
  email:         ["email", "email address", "e-mail", "email_address", "e_mail"],
  phone:         ["phone", "phone number", "telephone", "mobile", "tel", "phone_number", "mobile_number", "contact number"],
  dateOfBirth:   ["date of birth", "dob", "birth date", "birthday", "date_of_birth", "birthdate", "birth_date"],
  age:           ["age"],
  gender:        ["gender", "sex"],
  lastVisitedAt: ["last visit", "last visit date", "last visited", "last_visit", "last_visit_date", "last_visited", "last seen", "last_seen", "last attendance", "last check-in", "last checkin"],
  patientId:     ["patient id", "patient_id", "hospital id", "mrn", "record number", "patient ref", "id", "pid", "ref", "chart no", "chart number"],
  notes:         ["notes", "remarks", "comments", "note", "additional info", "additional notes"],
};

function autoDetect(headers: string[]): Record<PatientField, string> {
  const mapping: Record<string, string> = {};
  for (const field of PATIENT_FIELDS) {
    const aliases = FIELD_ALIASES[field.key];
    const match = headers.find(h =>
      aliases.some(a => h.toLowerCase().trim() === a)
    );
    if (match) mapping[field.key] = match;
  }
  return mapping as Record<PatientField, string>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface ImportResults {
  imported: number;
  skipped: number;
  total: number;
  errors: { row: number; reason: string }[];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PatientImport() {
  const { hospital } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<PatientField, string>>({} as Record<PatientField, string>);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);

  // ── File parsing ─────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const headers = result.meta.fields ?? [];
          const rows = result.data;
          setParsed({ fileName: file.name, headers, rows });
          setMapping(autoDetect(headers));
          setResults(null);
        },
        error: () => toast({ title: "Failed to parse CSV", variant: "destructive" }),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      import("xlsx").then((XLSX) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
            const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
            setParsed({ fileName: file.name, headers, rows: rawRows });
            setMapping(autoDetect(headers));
            setResults(null);
          } catch {
            toast({ title: "Failed to parse Excel file", variant: "destructive" });
          }
        };
        reader.readAsArrayBuffer(file);
      });
    } else {
      toast({ title: "Unsupported file type", description: "Please upload a .csv, .xlsx, or .xls file", variant: "destructive" });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!parsed || !hospital?.token) return;

    const hasNameMapping = mapping["fullName"] || (mapping["firstName"] && mapping["lastName"]) || mapping["firstName"];
    if (!hasNameMapping) {
      toast({ title: "Please map at least a Name or First Name column", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const patients = parsed.rows.map(row => {
        const p: Record<string, string> = {};
        for (const field of PATIENT_FIELDS) {
          const col = mapping[field.key];
          if (col && row[col] !== undefined) {
            p[field.key] = String(row[col]).trim();
          }
        }
        return p;
      }).filter(p => p.fullName || p.firstName);

      if (patients.length === 0) {
        toast({ title: "No valid rows to import", description: "Make sure First Name and Last Name are mapped and filled", variant: "destructive" });
        setImporting(false);
        return;
      }

      const res = await fetch(apiUrl("/api/patients/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ patients }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResults(data as ImportResults);
    } catch (err: unknown) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // ── Preview rows ──────────────────────────────────────────────────────────

  const previewRows = parsed?.rows.slice(0, 5).map(row => {
    const out: Partial<Record<PatientField, string>> = {};
    for (const field of PATIENT_FIELDS) {
      const col = mapping[field.key];
      if (col) out[field.key] = row[col] ?? "";
    }
    return out;
  }) ?? [];

  const mappedFields = PATIENT_FIELDS.filter(f => mapping[f.key]);
  const validRowCount = parsed?.rows.filter(r => {
    const fullNameCol = mapping["fullName"];
    const fnCol = mapping["firstName"];
    return (fullNameCol && r[fullNameCol]?.trim()) || (fnCol && r[fnCol]?.trim());
  }).length ?? 0;

  // ── Download error report ─────────────────────────────────────────────────

  const downloadErrors = () => {
    if (!results?.errors.length) return;
    const lines = ["Row,Reason", ...results.errors.map(e => `${e.row},"${e.reason}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Patients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Upload a CSV or Excel file exported from your existing EMR to bring all your patient records in at once.
          </p>
        </div>

        {/* ── Results banner ── */}
        {results && (
          <div className={`rounded-xl border p-5 space-y-3 ${results.errors.length === 0 ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Import complete</p>
                <p className="text-sm text-muted-foreground">
                  {results.imported} of {results.total} patients imported successfully
                  {results.skipped > 0 && ` · ${results.skipped} skipped`}
                </p>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-400">{results.errors.length} row{results.errors.length !== 1 ? "s" : ""} had issues</p>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={downloadErrors}>
                    <Download className="w-3 h-3" />Download error report
                  </Button>
                </div>
                <div className="rounded-md bg-muted/40 divide-y divide-border max-h-40 overflow-y-auto">
                  {results.errors.slice(0, 10).map((e, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">Row {e.row}:</span>
                      <span>{e.reason}</span>
                    </div>
                  ))}
                  {results.errors.length > 10 && (
                    <p className="px-3 py-1.5 text-xs text-muted-foreground">…and {results.errors.length - 10} more — download the full report above</p>
                  )}
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => { setParsed(null); setResults(null); setMapping({} as Record<PatientField, string>); }}>
              Import another file
            </Button>
          </div>
        )}

        {!results && (
          <>
            {/* ── Step 1: Upload zone ── */}
            {!parsed ? (
              <div
                className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Drop your file here, or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports CSV, Excel (.xlsx), and .xls files</p>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-muted border border-border">.csv</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted border border-border">.xlsx</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted border border-border">.xls</span>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
              </div>
            ) : (
              <>
                {/* ── File info bar ── */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/20">
                  <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{parsed.fileName}</p>
                    <p className="text-xs text-muted-foreground">{parsed.rows.length} rows · {parsed.headers.length} columns detected</p>
                  </div>
                  <button
                    onClick={() => { setParsed(null); setMapping({} as Record<PatientField, string>); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Step 2: Column mapping ── */}
                <div className="rounded-xl border border-border bg-card">
                  <div className="px-5 py-3.5 border-b border-border bg-muted/10">
                    <p className="font-semibold text-sm">Map Columns</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Match your file's column headers to patient fields. We've auto-detected what we can.
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {PATIENT_FIELDS.map(field => (
                      <div key={field.key} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-52 shrink-0">
                          <p className="text-sm font-medium">
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <select
                          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={mapping[field.key] ?? ""}
                          onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        >
                          <option value="">— Not mapped —</option>
                          {parsed.headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        {mapping[field.key] && (
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Step 3: Preview ── */}
                {mappedFields.length > 0 && previewRows.length > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border bg-muted/10">
                      <p className="font-semibold text-sm">Preview — first {Math.min(5, parsed.rows.length)} rows</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            {mappedFields.map(f => (
                              <th key={f.key} className="px-4 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                                {f.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewRows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                              {mappedFields.map(f => (
                                <td key={f.key} className="px-4 py-2.5 max-w-[180px] truncate text-muted-foreground">
                                  {row[f.key] || <span className="text-muted-foreground/40 italic">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsed.rows.length > 5 && (
                      <p className="px-5 py-2 text-xs text-muted-foreground border-t border-border">
                        …and {parsed.rows.length - 5} more rows
                      </p>
                    )}
                  </div>
                )}

                {/* ── Import button ── */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">
                      Ready to import{" "}
                      <span className="text-primary font-semibold">{validRowCount}</span>{" "}
                      patient{validRowCount !== 1 ? "s" : ""}
                    </p>
                    {parsed.rows.length !== validRowCount && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parsed.rows.length - validRowCount} rows will be skipped (no name found)
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={importing || validRowCount === 0}
                    className="gap-2"
                  >
                    {importing
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Importing…</>
                      : <><Upload className="w-4 h-4" />Import {validRowCount} Patient{validRowCount !== 1 ? "s" : ""}</>
                    }
                  </Button>
                </div>
              </>
            )}

            {/* ── Format guide ── */}
            {!parsed && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Tips for a smooth import</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>All fields are optional — just map whatever your EMR exports. If your export has a combined <strong className="text-foreground">Name</strong> column instead of separate first/last name, map it to <strong className="text-foreground">Full Name (combined)</strong> and it will be split automatically.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>Column names are auto-detected — common names like "DOB", "Mobile", "MRN" are picked up automatically.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>Patients already in the system (matched by <strong className="text-foreground">Hospital Patient ID / MRN</strong> only) are skipped. The same email can appear on multiple patients — e.g. a parent registering several children.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>If your EMR exports Excel, open it and save as CSV first for best results. Or just upload the Excel file directly.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>Map <strong className="text-foreground">Last Visit Date</strong> if your EMR export includes it. Patients whose last visit is older than your dormant threshold will be imported as <strong className="text-foreground">Dormant</strong> automatically — all others import as Active.</span>
                  </li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
