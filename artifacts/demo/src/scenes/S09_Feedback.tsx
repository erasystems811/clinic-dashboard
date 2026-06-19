import { useEffect, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

const OTHER_FEEDBACK = [
  { initials: "NO", name: "Ngozi Obi", rating: 5, comment: "Loved the queue SMS — I didn't have to wait inside. Great experience!", time: "2d ago" },
  { initials: "TF", name: "Tunde Fasanya", rating: 4, comment: "Very professional staff. The reminder SMS saved me from missing my appointment.", time: "3d ago" },
  { initials: "AM", name: "Aisha Mohammed", rating: 5, comment: "The ERA-me app helped me track my medications. Thank you ERA Hospital!", time: "5d ago" },
];

export default function S09_Feedback({ prospect, onNext }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 600);
    const t2 = setTimeout(onNext, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onNext]);

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Automated feedback collection after every visit</p>
      </div>

      {/* Average rating */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <p className="text-3xl font-bold">4.7</p>
            <div className="flex justify-center gap-0.5 mt-1">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= 5 ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Overall Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <p className="text-3xl font-bold">182</p>
            <p className="text-xs text-muted-foreground mt-2">Total Responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <p className="text-3xl font-bold text-primary">94%</p>
            <p className="text-xs text-muted-foreground mt-2">Would Recommend</p>
          </CardContent>
        </Card>
      </div>

      {/* Prospect's new feedback card */}
      {show && (
        <div className="scale-in">
          <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            New feedback just arrived
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
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">Just now</span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1.5 leading-snug">
                    "Excellent service! The queue update SMS was a game-changer — I just waited outside until my turn. The whole team was professional and caring. Will definitely come back."
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">ERA Hospital · Post-visit</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">{fb.time}</span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1.5 leading-snug">"{fb.comment}"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <NarrationBubble
        text={<>ERA collects feedback automatically after every visit. <strong>You see every star rating and comment in real time</strong> — no manual chasing, no paper forms.</>}
        onNext={onNext}
        nextLabel="Continue →"
      />
    </div>
  );
}
