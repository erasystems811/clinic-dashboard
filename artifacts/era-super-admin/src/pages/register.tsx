import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { Building2, User, Mail, Phone, MapPin, AtSign, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

interface RegisterResult {
  ok: boolean;
  message: string;
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();

  const [hospitalName, setHospitalName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const inputCls = "w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition";

  const suggestUsername = (name: string) => {
    if (!username) {
      setUsername(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (username.length < 3) { setError("Username must be at least 3 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalName, contactName, email, phone, city, username }),
      });
      const data: RegisterResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 ring-1 ring-primary/30">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Era Systems</h1>
            <p className="text-sm text-muted-foreground mt-1">Create your hospital account</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-xl bg-card border border-border p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">Account created!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your login credentials have been sent to <strong>{email}</strong>. Check your inbox — including spam.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Your account is on a <span className="text-amber-400 font-medium">trial</span> subscription. Contact us to upgrade.
              </p>
            </div>
            <button
              onClick={() => setLocation("/")}
              className="mt-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl bg-card border border-border p-6 space-y-4">
              <p className="text-xs text-muted-foreground">Fill in your details to get instant access. Credentials will be emailed to you.</p>

              {/* Hospital Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hospital / Clinic Name *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={e => setHospitalName(e.target.value)}
                    onBlur={e => suggestUsername(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="e.g. Sunrise Medical Centre"
                  />
                </div>
              </div>

              {/* Contact Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Person Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="Full name"
                  />
                </div>
              </div>

              {/* Email + Phone side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="admin@hospital.com"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="+234..."
                    />
                  </div>
                </div>
              </div>

              {/* City (optional) + Username */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City <span className="normal-case font-normal">(optional)</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className={inputCls}
                      placeholder="Lagos"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username *</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      required
                      minLength={3}
                      className={inputCls}
                      placeholder="sunrise_mc"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Account — It's Free"}
            </button>

            <button
              type="button"
              onClick={() => setLocation("/")}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Already have an account? Sign in
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">By registering you agree to Era Systems terms of service.</p>
      </div>
    </div>
  );
}
