import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Eye, RefreshCw, CheckCircle, ShieldAlert, Cpu, Link as LinkIcon } from "lucide-react";

interface Difference {
  region: string;
  type: string;
  severity: string;
  confidence: number;
  description?: string;
}

interface AgentLogEntry {
  agent?: string;
  step?: string;
  action?: string;
  output: any;
  timestamp?: string;
}

interface AgentWorkflowPanelProps {
  isAnalyzing: boolean;
  auditLog: AgentLogEntry[];
  finalDecision: string | null;
  iterations: number;
  txHash?: string;
  isLoggingToBlockchain?: boolean;
}

export function AgentWorkflowPanel({
  isAnalyzing,
  auditLog,
  finalDecision,
  iterations,
  txHash,
  isLoggingToBlockchain,
}: AgentWorkflowPanelProps) {
  // We will "replay" the audit log over time to simulate the agentic process
  const [displayedLogs, setDisplayedLogs] = useState<AgentLogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<"IDLE" | "PERCEPTION" | "REASONING" | "DECISION" | "BLOCKCHAIN">("IDLE");
  const [activeIteration, setActiveIteration] = useState(1);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];

    if (isAnalyzing) {
      setDisplayedLogs([]);
      setCurrentStep("PERCEPTION");
      setActiveIteration(1);
    } else if (auditLog && auditLog.length > 0) {
      // Replay timing for effect safely
      let delay = 0;
      
      auditLog.forEach((log, index) => {
        const timer = setTimeout(() => {
          setDisplayedLogs((prev) => [...prev, log]);
          
          const isPerception = log.agent === "Perception Agent" || log.step === "perception";
          const isReasoning = log.agent === "Reasoning Agent" || log.step === "reasoning";
          const isError = log.step === "error";

          if (isError) {
            setCurrentStep("IDLE");
          } else if (isPerception) {
            setCurrentStep("PERCEPTION");
          } else if (isReasoning) {
            setCurrentStep("REASONING");
          }
          
          if (isReasoning && log.output?.decision === "REANALYZE") {
            const loopTimer = setTimeout(() => {
              setActiveIteration((prev) => prev + 1);
              setCurrentStep("PERCEPTION");
            }, 800);
            timeouts.push(loopTimer);
          }
          
          if (index === auditLog.length - 1) {
            setCurrentStep("DECISION");
            if (isLoggingToBlockchain || txHash) {
              const bcTimer = setTimeout(() => setCurrentStep("BLOCKCHAIN"), 1500);
              timeouts.push(bcTimer);
            }
          }
        }, delay);
        
        timeouts.push(timer);
        delay += 1200;
      });
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isAnalyzing, auditLog, isLoggingToBlockchain, txHash]);

  // Derive current state variables from displayed logs
  const latestPerception = displayedLogs.filter(l => l.agent === "Perception Agent" || l.step === "perception").pop();
  const latestReasoning = displayedLogs.filter(l => l.agent === "Reasoning Agent" || l.step === "reasoning").pop();
  const latestError = displayedLogs.filter(l => l.step === "error").pop();
  
  const getDecisionColor = (decision: string) => {
    if (decision === "APPROVE") return "bg-green-500/20 text-green-400 border-green-500/50";
    if (decision === "REANALYZE") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    return "bg-red-500/20 text-red-500 border-red-500/50";
  };

  return (
    <div className="w-full space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <Cpu className="w-5 h-5 text-primary" />
        Agentic Workflow
      </h3>
      
      <div className="relative border-l-2 border-primary/20 pl-6 ml-3 space-y-8">
        
        {/* Step 1: Perception Agent */}
        <div className="relative">
          <div className={`absolute -left-[35px] top-2 w-6 h-6 rounded-full flex items-center justify-center border-2 
            ${currentStep === "PERCEPTION" || currentStep === "REASONING" || currentStep === "DECISION" || currentStep === "BLOCKCHAIN" 
              ? "bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]" 
              : "bg-background border-muted"}`}>
            <Eye className="w-3 h-3 text-white" />
          </div>
          
          <Card className={`transition-all duration-500 ${currentStep === "PERCEPTION" ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "opacity-80"}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-primary font-mono text-xs">AGENT 1</span>
                  Perception Agent
                </CardTitle>
                {(isAnalyzing || (currentStep === "PERCEPTION" && displayedLogs.length === 0)) && !latestError && (
                  <Badge variant="outline" className="animate-pulse flex gap-1 items-center">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing Image...
                  </Badge>
                )}
                {latestError && (
                  <Badge variant="destructive" className="flex gap-1 items-center bg-red-500/10 text-red-500 border-red-500/20">
                    <ShieldAlert className="w-3 h-3" /> System Error
                  </Badge>
                )}
                {activeIteration > 1 && (
                  <Badge variant="secondary" className="bg-primary/20 text-primary">Iteration {activeIteration}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="popLayout">
                {latestPerception ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">Detected Issues</p>
                        <p className="font-mono text-lg font-semibold">{latestPerception.output?.differences?.length || 0}</p>
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">Confidence</p>
                        <Badge variant="outline" className="border-primary/50 text-primary">
                          {Math.round((latestPerception.output?.overall_confidence || 0) * 100)}%
                        </Badge>
                      </div>
                    </div>
                    
                    {latestPerception.output?.differences?.length > 0 && (
                      <div className="bg-secondary/30 rounded-md p-3 text-xs space-y-2 mt-2">
                        {latestPerception.output.differences.slice(0,2).map((diff: Difference, idx: number) => (
                          <div key={idx} className="flex justify-between border-b border-border/50 pb-1 last:border-0 last:pb-0">
                            <span className="font-mono">{diff.region}</span>
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">{diff.type.replace("_", " ")}</span>
                              <span className={diff.severity === "HIGH" ? "text-red-400 font-bold" : diff.severity === "MEDIUM" ? "text-yellow-400 font-bold" : "text-green-400 font-bold"}>
                                {diff.severity}
                              </span>
                            </div>
                          </div>
                        ))}
                        {latestPerception.output.differences.length > 2 && (
                          <p className="text-muted-foreground text-center text-[10px] pt-1">+ {latestPerception.output.differences.length - 2} more</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : latestError ? (
                  <div className="h-16 flex items-center text-xs text-red-500 font-mono">
                    <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0" />
                    {latestError.output?.error || "Analysis failed. Please try again."}
                  </div>
                ) : (
                  <div className="h-16 flex items-center text-xs text-muted-foreground">Waiting for visual input...</div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* REANALYZE LOOP ANIMATION */}
        <AnimatePresence>
          {latestReasoning?.output?.decision === "REANALYZE" && currentStep === "PERCEPTION" && activeIteration > 1 && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute -left-12 top-24 bottom-16 w-8 border-l-2 border-t-2 border-b-2 border-dashed border-yellow-500/50 rounded-l-xl z-0 flex items-center justify-start p-1"
            >
               <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin-slow bg-background rounded-full absolute -left-2" />
               <div className="absolute top-1/2 -translate-y-1/2 left-4 w-max bg-background px-2 py-1 text-[10px] text-yellow-500 border border-yellow-500/30 rounded shadow-lg uppercase tracking-wider font-mono">
                 Refining Instructions
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 2: Reasoning Agent */}
        <div className="relative z-10">
          <div className={`absolute -left-[35px] top-2 w-6 h-6 rounded-full flex items-center justify-center border-2 
            ${currentStep === "REASONING" || currentStep === "DECISION" || currentStep === "BLOCKCHAIN"
              ? "bg-purple-500 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" 
              : "bg-background border-muted"}`}>
            <Brain className="w-3 h-3 text-white" />
          </div>
          
          <Card className={`transition-all duration-500 ${currentStep === "REASONING" ? "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]" : "opacity-80"}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-purple-500 font-mono text-xs">AGENT 2</span>
                  Reasoning Agent
                </CardTitle>
                {currentStep === "REASONING" && !latestReasoning && (
                  <Badge variant="outline" className="animate-pulse border-purple-500/50 text-purple-400">
                    Evaluating logic...
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="popLayout">
                {latestReasoning ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">Confidence</p>
                        <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                          {latestReasoning.output?.confidence_assessment || latestReasoning.output?.confidence || "High"}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">Decision Output</p>
                        <Badge variant="outline" className={`font-bold ${getDecisionColor(latestReasoning.output?.decision)}`}>
                          {latestReasoning.output?.decision}
                        </Badge>
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-md p-3 text-xs border border-border/50 shadow-inner">
                      <p className="font-mono text-muted-foreground mb-1 block flex items-center gap-2">
                        <Brain className="w-3 h-3" /> {"// Output Analysis"}
                      </p>
                      <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {latestReasoning.output?.reasoning || latestReasoning.output?.reason || "Processing safety guidelines..."}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-16 flex items-center text-xs text-muted-foreground">Awaiting perception data...</div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Step 3: Final Decision */}
        <div className="relative">
          <div className={`absolute -left-[35px] top-2 w-6 h-6 rounded-full flex items-center justify-center border-2 
            ${currentStep === "DECISION" || currentStep === "BLOCKCHAIN"
              ? finalDecision === "APPROVE" ? "bg-green-500 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" : "bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
              : "bg-background border-muted"}`}>
            {finalDecision === "APPROVE" ? <CheckCircle className="w-3 h-3 text-white" /> : <ShieldAlert className="w-3 h-3 text-white" />}
          </div>
          
          <AnimatePresence>
            {(currentStep === "DECISION" || currentStep === "BLOCKCHAIN") && finalDecision && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className={`border-2 ${finalDecision === "APPROVE" ? "border-green-500/50 bg-green-500/5" : "border-red-500/50 bg-red-500/5"}`}>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Final Ordnance</p>
                    <h2 className={`text-2xl font-black tracking-tight ${finalDecision === "APPROVE" ? "text-green-500" : "text-red-500"}`}>
                      {finalDecision}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">Completed in {iterations} iteration{iterations > 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Step 4: Blockchain (Optional) */}
        {(isLoggingToBlockchain || txHash || currentStep === "BLOCKCHAIN") && finalDecision === "APPROVE" && (
          <div className="relative">
            <div className={`absolute -left-[35px] top-2 w-6 h-6 rounded-full flex items-center justify-center border-2 
              ${txHash ? "bg-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "bg-background border-blue-500/50"}`}>
              <LinkIcon className="w-3 h-3 text-white" />
            </div>
            
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-secondary/40 border border-blue-500/20 rounded-lg p-3 text-xs font-mono space-y-2 relative overflow-hidden">
                {!txHash ? (
                  <>
                    <p className="flex items-center gap-2 text-blue-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Committing event to blockchain...
                    </p>
                    <div className="h-1 w-full bg-secondary overflow-hidden rounded-full mt-2">
                       <motion.div className="h-full bg-blue-500" initial={{ width: "0%" }} animate={{ width: "80%" }} transition={{ duration: 2 }} />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-2 text-green-400 border-b border-border/50 pb-2">
                      <CheckCircle className="w-3 h-3" /> Immutable Record Written
                    </p>
                    <p className="text-muted-foreground truncate pt-1">TX: <span className="text-foreground">{txHash}</span></p>
                    <p className="text-muted-foreground">Network: Polygon zkEVM</p>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  );
}
