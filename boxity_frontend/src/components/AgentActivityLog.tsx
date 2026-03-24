import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Terminal, Brain, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentLogEntry {
  agent: string;
  action: string;
  output: any;
  timestamp: string;
}

export function AgentActivityLog({ logs }: { logs: AgentLogEntry[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-secondary/20 border border-border/50 rounded-lg p-6 py-12 flex flex-col items-center justify-center text-center space-y-3">
        <Terminal className="w-8 h-8 text-muted-foreground opacity-50" />
        <p className="text-sm font-mono text-muted-foreground">No agent activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-border/50 bg-[#0a0a0a] shadow-xl">
      <div className="bg-secondary/50 px-4 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Terminal className="w-4 h-4" /> Agent Terminal
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
        </div>
      </div>
      
      <ScrollArea className="h-[450px] p-4 font-mono text-xs">
        <AnimatePresence>
          <div className="space-y-4">
            {logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="space-y-2 border-b border-white/5 pb-4 last:border-0"
              >
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground min-w-[70px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <div className="flex-1 ml-3">
                    <Badge variant="outline" className={`mb-2 font-mono text-[10px] uppercase ${
                      log.agent === "Perception Agent" ? "border-blue-500/50 text-blue-400" :
                      log.agent === "Reasoning Agent" ? "border-purple-500/50 text-purple-400" :
                      "border-green-500/50 text-green-400"
                    }`}>
                      {log.agent === "Perception Agent" && <Eye className="w-3 h-3 mr-1" />}
                      {log.agent === "Reasoning Agent" && <Brain className="w-3 h-3 mr-1" />}
                      {log.agent}
                    </Badge>
                    
                    <p className="text-white/80 mb-1">{log.action}</p>
                    
                    {log.output && (
                      <div className="bg-black/50 p-2 rounded border border-white/10 mt-2 overflow-x-auto">
                        <pre className="text-[10px] text-green-400/80 leading-relaxed">
                          {JSON.stringify(log.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            <div className="animate-pulse flex items-center gap-2 text-muted-foreground pt-2">
               <span>_</span>
            </div>
          </div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
