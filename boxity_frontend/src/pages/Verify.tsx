// src/pages/Verify.tsx
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Walkthrough } from "@/components/Walkthrough";
import { WalletConnect } from "@/components/WalletConnect";
import { loadBatches, type Batch as DemoBatch } from "@/lib/demoData";
import {
  web3Service,
  type Batch as ContractBatch,
  type BatchEvent as ContractBatchEvent,
} from "@/lib/web3";
import { Search, Package, Loader2, Shield, Database } from "lucide-react";
import { QRScanAnimator } from "@/components/QRScanAnimator";
import { AnimatedTimeline } from "@/components/AnimatedTimeline";
import { GlassCard } from "@/components/GlassCard";
import ClickSpark from "@/components/ClickSpark";
import QRScanner from "@/components/QRScanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/* Contract Batch timeline component (unchanged) */
const ContractBatchTimeline = ({ batchId }: { batchId: string }) => {
  const [events, setEvents] = useState<ContractBatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadEvents = async () => {
      try {
        setLoading(true);
        const batchEvents = await web3Service.getBatchEvents(batchId);
        if (!mounted) return;
        setEvents(batchEvents);
        setError(null);
      } catch (err) {
        console.error("Failed to load batch events:", err);
        if (!mounted) return;
        setError("Failed to load events from blockchain");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    loadEvents();
    return () => {
      mounted = false;
    };
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading blockchain events...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No events logged yet on blockchain
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex gap-4 p-4 border rounded-lg bg-card"
        >
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{event.id}</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{event.role}</Badge>
              <span className="font-medium">{event.actor}</span>
              <Badge className="bg-green-100 text-green-800">
                <Shield className="mr-1 h-3 w-3" />
                Blockchain
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{event.note}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{new Date(event.timestamp * 1000).toLocaleString()}</span>
              <span className="font-mono">Hash: {event.eventHash.slice(0, 8)}...</span>
            </div>
            {event.image && (
              <img
                src={event.image}
                alt="Event image"
                className="w-16 h-16 object-cover rounded border"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const Verify = () => {
  const [searchId, setSearchId] = useState("");
  const [batch, setBatch] = useState<ContractBatch | DemoBatch | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isContractBatch, setIsContractBatch] = useState(false);

  // Scanner dialog state
  const [scanOpen, setScanOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");

  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!searchId.trim()) return;

    setIsScanning(true);
    setNotFound(false);
    setBatch(null);
    setIsContractBatch(false);

    try {
      // Try contract batch if wallet connected
      if (connectedAddress) {
        try {
          const contractBatch = await web3Service.getBatch(searchId.trim());
          // some contract implementations may return exists flag; be defensive
          if (contractBatch && (contractBatch as any).id) {
            setBatch(contractBatch);
            setIsContractBatch(true);
            setIsScanning(false);
            return;
          }
        } catch (error) {
          // not found on-chain — continue with demo
          console.log("Batch not found in contract, checking demo batches");
        }
      }

      // Fallback to demo batches (local)
      setTimeout(() => {
        const demoBatches = loadBatches();
        const found = demoBatches.find((b) => b.id === searchId.trim());

        if (found) {
          setBatch(found);
          setIsContractBatch(false);
        } else {
          setNotFound(true);
        }
        setIsScanning(false);
      }, 700);
    } catch (error) {
      console.error("Search error:", error);
      setNotFound(true);
      setIsScanning(false);
    }
  }, [searchId, connectedAddress]);

  // Called when QR scanner decodes something
  const applyDecodedAndSearch = useCallback(
    async (decodedText: string) => {
      if (!decodedText) {
        toast({
          title: "No payload",
          description: "Scanned QR returned empty text",
          variant: "destructive",
        });
        setScanOpen(false);
        return;
      }

      // close dialog and clear camera error
      setScanOpen(false);
      setCameraError("");

      // Try JSON payload first
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed && typeof parsed === "object" && parsed.batchId) {
          setSearchId(parsed.batchId);
          setTimeout(() => {
            void handleSearch();
          }, 120);
          toast({
            title: "QR scanned",
            description: `Batch ID auto-filled: ${parsed.batchId}`,
          });
          return;
        }
      } catch {
        // not JSON — continue
      }

      // If plain text — treat as batchId unless it's a url
      const candidate = decodedText.trim();
      if (/^https?:\/\//i.test(candidate)) {
        toast({
          title: "Invalid QR",
          description:
            "This QR contains a URL. Please scan a payload QR with a batchId or enter the batch id manually.",
          variant: "destructive",
        });
        return;
      }

      setSearchId(candidate);
      setTimeout(() => {
        void handleSearch();
      }, 120);
      toast({
        title: "QR scanned",
        description: `Batch ID auto-filled: ${candidate}`,
      });
    },
    [handleSearch, toast]
  );

  // Callback for QRScanner to report camera errors
  const onScannerError = useCallback((err: unknown) => {
    const msg =
      typeof err === "string" ? err : err instanceof Error ? err.message : "Camera unavailable";
    setCameraError(msg);
    console.error("QR Scanner error:", err);
  }, []);

  // Called by QRScanAnimator (simulate)
  const handleScanCompleteFromAnimator = useCallback(
    async (id?: string) => {
      if (id) {
        setSearchId(id);
        // small delay then search
        setTimeout(() => {
          void handleSearch();
        }, 150);
      }
    },
    [handleSearch]
  );

  const demoSuggestions = ["CHT-001-ABC", "CHT-002-XYZ", "CHT-DEMO"];

  const walkthroughSteps = [
    {
      target: "batch-id-input",
      title: "Enter Batch ID",
      description:
        "Type or paste a batch ID here to verify its journey through the supply chain",
      position: "bottom" as const,
    },
    {
      target: "verify-btn",
      title: "Verify Batch",
      description: "Click to retrieve and display the complete timeline for this batch",
      position: "top" as const,
    },
  ];

  return (
    <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
      <div className="container mx-auto px-4 py-8">
        <Walkthrough steps={walkthroughSteps} storageKey="verify-walkthrough" />
        <div className="flex justify-between items-center mb-8">
          <motion.h1
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Verify Batch
          </motion.h1>
          <WalletConnect onAddressChange={setConnectedAddress} />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Search Form */}
          <div className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Enter Batch ID</CardTitle>
                <CardDescription>Verify the provenance and history of a batch</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="searchId">Batch ID</Label>
                    <Input
                      id="batch-id-input"
                      placeholder="e.g., CHT-001-ABC"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && void handleSearch()}
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      id="verify-btn"
                      onClick={() => void handleSearch()}
                      disabled={isScanning}
                      className="whitespace-nowrap"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Get Log
                        </>
                      )}
                    </Button>

                    {/* open scanner dialog */}
                    <Button variant="outline" onClick={() => setScanOpen(true)}>
                      <Search className="mr-2 h-4 w-4" />
                      Scan QR
                    </Button>
                  </div>
                </div>

                {/* Demo Suggestions */}
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Try these demo batches:</p>
                  <div className="flex flex-wrap gap-2">
                    {demoSuggestions.map((id) => (
                      <Badge
                        key={id}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => {
                          setSearchId(id);
                          void handleSearch();
                        }}
                      >
                        {id}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </GlassCard>

            {/* QR Scanner Animator (simulate flow) */}
            <div>
              <QRScanAnimator onScanComplete={(id?: string) => void handleScanCompleteFromAnimator(id)} />
            </div>
          </div>

          {/* Info/Instructions */}
          <GlassCard>
            <CardHeader>
              <CardTitle>How to Verify</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h3 className="font-semibold">Option 1: Manual Entry</h3>
                <p className="text-sm text-muted-foreground">
                  Enter a batch ID in the search box and click "Get Log" to view its complete provenance timeline.
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h3 className="font-semibold">Option 2: Scan QR</h3>
                <p className="text-sm text-muted-foreground">
                  Click "Scan QR" to open your camera and scan a QR payload. If QR contains{" "}
                  <code>{'{ "batchId": "CHT-001-ABC" }'}</code> it will autofill.
                </p>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium">
                  💡 Connect your wallet to verify blockchain batches with cryptographic signatures and immutable event records.
                </p>
              </div>

              {connectedAddress && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    ✅ Wallet connected! You can now verify blockchain batches with full cryptographic transparency.
                  </p>
                </div>
              )}
            </CardContent>
          </GlassCard>
        </div>

        {/* Not Found Message */}
        {notFound && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>Batch ID "{searchId}" not found. Try one of the demo batches above.</AlertDescription>
          </Alert>
        )}

        {/* Batch Details & Timeline */}
        {batch && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-8">
            {/* Batch Info */}
            <GlassCard>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {batch.productName}
                    </CardTitle>
                    <CardDescription>Batch ID: {batch.id}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {isContractBatch ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <Shield className="mr-1 h-3 w-3" />
                        Blockchain
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Database className="mr-1 h-3 w-3" />
                        Demo
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Origin</p>
                    <p className="font-semibold">{batch.origin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">SKU</p>
                    <p className="font-semibold">{(batch as any).sku || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-semibold">{new Date(batch.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {(batch as any).baselineImage && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Baseline Image</p>
                    <img
                      src={(batch as any).baselineImage}
                      alt="Baseline product"
                      className="w-32 h-32 object-cover rounded-lg border"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </GlassCard>

            {/* Timeline */}
            <GlassCard>
              <CardHeader>
                <CardTitle>Supply Chain Timeline</CardTitle>
                <CardDescription>
                  {isContractBatch
                    ? `${(batch as ContractBatch).events?.length || 0} events recorded on blockchain`
                    : `${(batch as DemoBatch).events?.length || 0} events recorded`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isContractBatch ? (
                  <ContractBatchTimeline batchId={batch.id} />
                ) : (
                  <>
                    {(batch as DemoBatch).events?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No events logged yet</p>
                    ) : (
                      <AnimatedTimeline events={(batch as DemoBatch).events || []} />
                    )}
                  </>
                )}
              </CardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* Scanner Dialog — re-used from LogEvent.tsx */}
        <Dialog open={scanOpen} onOpenChange={setScanOpen}>
          <DialogContent className="sm:max-w-[820px]">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2">Scan QR Code</DialogTitle>
              <DialogDescription>
                Camera opens automatically. The scanner will autofill the batch id on detection.
              </DialogDescription>
            </DialogHeader>

            <div className="w-full flex flex-col items-center">
              <QRScanner
                onDecoded={(decoded) => void applyDecodedAndSearch(decoded)}
                onError={(err) => onScannerError(err)}
                onAutoScan={() => {
                  /* optional UI feedback */
                }}
                elementId="qr-reader-verify"
                regionBox={320}
              />

              {cameraError && <div className="mt-3 text-xs text-red-600 flex items-center gap-2"><span>{cameraError}</span></div>}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ClickSpark>
  );
};

export default Verify;
