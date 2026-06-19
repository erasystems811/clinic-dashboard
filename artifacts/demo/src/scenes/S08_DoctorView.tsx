import { useState } from "react";
import { Stethoscope, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props {
  prospect: Prospect;
  onNext: () => void;
}

export default function S08_DoctorView({ prospect, onNext }: Props) {
  const [tab, setTab] = useState<"queue" | "messages">("queue");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ from: "doctor" | "patient"; text: string }[]>([
    { from: "patient", text: `Hi doctor, I'm not sure how many times a day I should take the Paracetamol. Can you clarify?` },
  ]);
  const [messageSent, setMessageSent] = useState(false);
  const [transferred, setTransferred] = useState(false);

  function handleTransfer() {
    setTransferred(true);
    setTimeout(onNext, 1500);
  }

  function handleSendMessage() {
    if (!message.trim()) return;
    setMessages(m => [...m, { from: "doctor", text: message }]);
    setMessage("");
    setMessageSent(true);
    setTimeout(() => {
      setMessages(m => [...m, {
        from: "patient",
        text: `Thank you doctor! That's very helpful. I'll follow the schedule as prescribed.`
      }]);
    }, 1200);
  }

  return (
    <div className="relative space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Doctor View</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Dr. Emmanuel Obi — General Practice</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["queue", "messages"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "queue" ? "Patient Queue" : "ERA Messages"}
            {t === "messages" && !messageSent && (
              <span className="ml-2 w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            )}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        <div className="space-y-4">
          {transferred ? (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                <p className="font-semibold text-green-400">Consultation Complete</p>
                <p className="text-sm text-muted-foreground">{prospect.firstName} has been moved to Post Treatment</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Assigned Patients (1)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {prospect.firstName[0]}{prospect.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                      <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">In Care</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">ERA-001</span>
                      <span>URTI · Paracetamol 500mg, Amoxicillin 250mg</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setTab("messages")}>
                    <MessageSquare className="w-3.5 h-3.5" /> Message
                  </Button>
                  <Button size="sm" onClick={handleTransfer}>
                    Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "messages" && (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                {prospect.firstName[0]}{prospect.lastName[0]}
              </div>
              <div>
                <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                <p className="text-xs text-muted-foreground">ERA-001 · Active</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "doctor" ? "justify-end" : "justify-start"} scale-in`}>
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-xl text-sm leading-snug ${
                  msg.from === "doctor"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </CardContent>
          <div className="px-4 pb-4 pt-2 border-t border-border flex items-center gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Reply to patient..."
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              defaultValue={!messageSent ? "Take it 3 times daily after meals — morning, afternoon, and evening. Let me know if you experience any side effects." : ""}
            />
            <Button size="icon" onClick={handleSendMessage}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      <NarrationBubble
        text={
          tab === "queue" && !transferred
            ? <>Doctors see only their assigned patients, with the full care plan ready. <strong>No digging through files. No asking the nurse what was prescribed.</strong></>
            : tab === "messages"
            ? <>Patients have questions after a visit. <strong>ERA Messages gives them a direct line to their doctor or nurse</strong> — no personal numbers shared, everything on record.</>
            : <><strong>Stage updated automatically.</strong> {prospect.firstName} moves to Post Treatment — ERA schedules their follow-up check-in without anyone having to remember.</>}
        }
        onNext={tab === "queue" ? (transferred ? onNext : handleTransfer) : handleSendMessage}
        nextLabel={tab === "queue" && !transferred ? "Complete Consultation →" : "Send →"}
      />
    </div>
  );
}
