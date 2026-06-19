import { useState } from "react";
import { Star, ThumbsUp, ThumbsDown, Mail, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; onSMSBanner?: (msg: string) => void; }

const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function StarRow({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
      <span className="text-sm font-medium sm:w-44 sm:shrink-0">{label}</span>
      <div className="flex items-center gap-1 sm:gap-1.5">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            <Star className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${s <= (hovered || value) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40"}`} />
          </button>
        ))}
        <span className="text-xs text-amber-400 font-medium w-14 sm:w-16 ml-1">
          {(hovered || value) > 0 ? LABELS[hovered || value] : ""}
        </span>
      </div>
    </div>
  );
}

const OTHER_FEEDBACK = [
  { initials: "NO", name: "Ngozi Obi", overall: 5, wait: 4, staff: 5, care: 5, recommend: true, comment: "Loved the queue SMS — I didn't have to wait inside. Great experience!", time: "2d ago" },
  { initials: "TF", name: "Tunde Fasanya", overall: 4, wait: 3, staff: 5, care: 4, recommend: true, comment: "Very professional staff. The reminder SMS saved me from missing my appointment.", time: "3d ago" },
  { initials: "AM", name: "Aisha Mohammed", overall: 5, wait: 5, staff: 5, care: 5, recommend: true, comment: "The ERA-me app helped me track my medications. Thank you ERA Hospital!", time: "5d ago" },
];

export default function S09_Feedback({ prospect, onNext }: Props) {
  const [step, setStep] = useState<"email" | "form" | "admin">("email");

  // Form state
  const [overall, setOverall] = useState(0);
  const [waitTime, setWaitTime] = useState(0);
  const [staffFriendliness, setStaffFriendliness] = useState(0);
  const [qualityOfCare, setQualityOfCare] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  function handleFormSubmit() {
    if (overall === 0) setOverall(5); // default to 5 stars so the demo never blocks
    setFormSubmitted(true);
    setTimeout(() => setStep("admin"), 1000);
  }

  const finalOverall = overall || 5;
  const finalRecommend = recommend ?? true;

  if (step === "email") {
    return (
      <div className="relative space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Automated feedback collection after every visit</p>
        </div>

        {/* Mock email */}
        <div className="max-w-lg mx-auto">
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Email sent to {prospect.firstName} — next morning after visit
          </div>
          <Card className="border-border overflow-hidden">
            {/* Email header */}
            <div className="bg-primary/10 px-5 py-4 border-b border-border space-y-1">
              <p className="text-xs text-muted-foreground">From: ERA Hospital &lt;no-reply@erasystems.com.ng&gt;</p>
              <p className="text-xs text-muted-foreground">To: {prospect.email}</p>
              <p className="text-xs font-medium text-foreground">Subject: How was your visit at ERA Hospital?</p>
            </div>
            <CardContent className="pt-5 space-y-4">
              <p className="text-sm">Hi {prospect.firstName},</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Thank you for visiting <strong className="text-foreground">ERA Hospital</strong> today. We hope you're feeling better!
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We'd love to hear about your experience. It only takes 30 seconds.
              </p>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
              >
                Share Your Feedback →
              </button>
              <p className="text-[10px] text-muted-foreground text-center">ERA Hospital · Lagos · erasystems.com.ng</p>
            </CardContent>
          </Card>
        </div>

        <NarrationBubble
          text={<>ERA automatically sends a feedback request <strong>the morning after every visit</strong> — no staff needed. Click "Share Your Feedback" to see what {prospect.firstName} sees.</>}
          onNext={() => setStep("form")}
          nextLabel="Open feedback form →"
        />
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="relative space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Patient-facing form — what {prospect.firstName} sees</p>
        </div>

        <div className="max-w-lg mx-auto">
          {formSubmitted ? (
            <Card className="border-green-500/30 bg-green-500/5 text-center">
              <CardContent className="pt-10 pb-10 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                <p className="font-semibold text-green-400 text-lg">Thank you!</p>
                <p className="text-sm text-muted-foreground">Your feedback has been submitted to ERA Hospital.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-5 space-y-5">
                <div className="text-center space-y-1 pb-2 border-b border-border">
                  <p className="font-bold text-base">ERA Hospital</p>
                  <p className="text-xs text-muted-foreground">How was your visit, {prospect.firstName}?</p>
                </div>

                <div className="space-y-4">
                  <StarRow label="Overall Experience *" value={overall} onChange={setOverall} />
                  <StarRow label="Wait Time" value={waitTime} onChange={setWaitTime} />
                  <StarRow label="Staff Friendliness" value={staffFriendliness} onChange={setStaffFriendliness} />
                  <StarRow label="Quality of Care" value={qualityOfCare} onChange={setQualityOfCare} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Would you recommend us to others?</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecommend(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${recommend === true ? "border-green-500 bg-green-500/10 text-green-400" : "border-border text-muted-foreground hover:border-green-500/40"}`}
                    >
                      <ThumbsUp className="w-4 h-4" /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecommend(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${recommend === false ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:border-destructive/40"}`}
                    >
                      <ThumbsDown className="w-4 h-4" /> No
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Additional Comments</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Tell us more about your experience…"
                    defaultValue="Excellent service! The queue SMS was brilliant — I waited outside and just came in when it was my turn. The staff were very professional."
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={handleFormSubmit}
                >
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <NarrationBubble
          text={
            formSubmitted
              ? <><strong>Feedback submitted.</strong> It lands instantly in the admin's Feedback tab — no manual collection, no paper forms.</>
              : <>This is the form {prospect.firstName} fills out. Rate any category and click Submit — it takes under 30 seconds.</>
          }
          onNext={formSubmitted ? undefined : handleFormSubmit}
          nextLabel="Submit Feedback →"
        />
      </div>
    );
  }

  // Admin view
  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Automated feedback collection after every visit</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 sm:pt-5 sm:pb-5 text-center">
            <p className="text-xl sm:text-3xl font-bold">4.7</p>
            <div className="flex justify-center gap-0.5 mt-1">
              {[1,2,3,4,5].map(s => <Star key={s} className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 fill-amber-400 text-amber-400" />)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Overall Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 sm:pt-5 sm:pb-5 text-center">
            <p className="text-xl sm:text-3xl font-bold">183</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">Total Responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 sm:pt-5 sm:pb-5 text-center">
            <p className="text-xl sm:text-3xl font-bold text-primary">94%</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">Would Recommend</p>
          </CardContent>
        </Card>
      </div>

      {/* New feedback from prospect */}
      <div className="scale-in">
        <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          New feedback just arrived from {prospect.firstName}
        </div>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {prospect.firstName[0]}{prospect.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= finalOverall ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">Just now</span>
                </div>
                <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>Wait: {waitTime || 4}/5</span>
                  <span>Staff: {staffFriendliness || 5}/5</span>
                  <span>Care: {qualityOfCare || 5}/5</span>
                  <span className={finalRecommend ? "text-green-400" : "text-destructive"}>
                    {finalRecommend ? "✓ Would recommend" : "✗ Would not recommend"}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-1.5 leading-snug">
                  "Excellent service! The queue SMS was brilliant — I waited outside and just came in when it was my turn. The staff were very professional."
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Other feedback */}
      <div className="space-y-3">
        {OTHER_FEEDBACK.map(fb => (
          <Card key={fb.name}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary text-muted-foreground font-bold text-xs flex items-center justify-center shrink-0">
                  {fb.initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{fb.name}</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= fb.overall ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">{fb.time}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>Wait: {fb.wait}/5</span>
                    <span>Staff: {fb.staff}/5</span>
                    <span>Care: {fb.care}/5</span>
                    <span className="text-green-400">✓ Would recommend</span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1.5 leading-snug">"{fb.comment}"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <NarrationBubble
        text={<>Every rating — overall, wait time, staff, quality of care — collected automatically. <strong>No staff chasing. No paper forms.</strong> You can also print a branded PDF feedback report for any period.</>}
        onNext={onNext}
        nextLabel="Continue →"
      />
    </div>
  );
}
