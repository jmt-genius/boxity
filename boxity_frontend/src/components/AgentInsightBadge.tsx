import { Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AgentInsight {
  decision: string;
  tisScore: number;
  iterations: number;
}

export const parseAgentInsights = (note: string): { cleanNote: string, insights: AgentInsight | null } => {
  const match = note.match(/\[AGENT_INSIGHTS\|([^|]+)\|([^|]+)\|([^\]]+)\]/);
  if (match) {
    const cleanNote = note.replace(match[0], '').trim();
    return {
      cleanNote,
      insights: {
        decision: match[1],
        tisScore: Number(match[2]),
        iterations: Number(match[3])
      }
    };
  }
  return { cleanNote: note, insights: null };
};

export const AgentInsightBadge = ({ insights }: { insights: AgentInsight | null }) => {
  if (!insights) return null;
  const isDanger = insights.decision !== "APPROVE";
  return (
    <div className="mt-3 p-3 bg-secondary/30 rounded-lg border border-border/50 flex flex-wrap items-center gap-4 text-xs font-mono">
      <div className="flex items-center gap-1.5">
        <Cpu className="w-4 h-4 text-primary" />
        <span className="text-muted-foreground">AI Agent:</span>
        <span className={isDanger ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{insights.decision}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={isDanger ? "border-red-500/30 text-red-500 font-mono" : "border-green-500/30 text-green-500 font-mono"}>
          TIS Score: {insights.tisScore}%
        </Badge>
      </div>
      <div className="text-muted-foreground">
        ({insights.iterations} loops)
      </div>
    </div>
  );
};
