import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  ScanLine,
  Camera,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  Upload,
  ShieldCheck,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { Walkthrough } from "@/components/Walkthrough";
import { WalletConnect } from "@/components/WalletConnect";

import {
  loadBatches,
  saveBatches,
  generateHash,
  generateLedgerRef,
  type BatchEvent as DemoBatchEvent,
  parseQrPayload,
  findBatchById,
  type Batch as DemoBatch,
} from "@/lib/demoData";

import { web3Service, type Batch as ContractBatch, type BatchEvent as ContractBatchEvent } from "@/lib/web3";
import ClickSpark from "@/components/ClickSpark";
import QRScanner from "@/components/QRScanner";
import QRCode from "qrcode";

const roles: ReadonlyArray<string> = [
  "Manufacturer",
  "3PL",
  "Warehouse",
  "Distributor",
  "Retailer",
  "Other",
];

export default function LogEvent(): JSX.Element {
  const { toast } = useToast();
  const [demoBatches, setDemoBatches] = useState<DemoBatch[]>([]);
  const [contractBatches, setContractBatches] = useState<ContractBatch[]>([]);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string>("");
  const [actor, setActor] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [image, setImage] = useState<string>("");

  const [scanOpen, setScanOpen] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");

  const [qrPngUrl, setQrPngUrl] = useState<string>("");
  const [justScanned, setJustScanned] = useState<boolean>(false);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{passed: boolean, tisScore?: number, differences?: any[], trustScore?: any} | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);

  const JWT = import.meta.env.VITE_PINATA_JWT;

  const handlePinataUpload = async (file: File): Promise<string> => {
    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("network", "public");
    try {
      const request = await fetch("https://uploads.pinata.cloud/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${JWT}`,
        },
        body: formData,
      });
      const response = await request.json();
      if (response.data?.cid) {
        return `https://ipfs.io/ipfs/${response.data.cid}`;
      } else {
        throw new Error("No CID returned from Pinata.");
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const checkIntegrity = async (beforeImageUrl: string, afterImageFile: File) => {
    setIsCheckingIntegrity(true);
    setIntegrityResult(null);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const afterImageBase64 = reader.result as string;
        
        // Call integrity check API (same as IntegrityCheck.tsx)
        const API_BASE = import.meta.env.VITE_BACKEND_URL || "/api";
        const response = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseline_b64: beforeImageUrl,
            current_b64: afterImageBase64,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Analyzer returned ${response.status}`);
        }
        
        const data = await response.json();
        const differences = data.differences || [];
        
        // Map backend schema to UI format (same as IntegrityCheck.tsx)
        const mapped = differences.map((d: any) => ({
          location: d?.region || "Unknown region",
          severity: (String(d?.severity || "LOW").toLowerCase() === "critical"
            ? "high"
            : String(d?.severity || "LOW").toLowerCase() === "high"
            ? "high"
            : String(d?.severity || "LOW").toLowerCase() === "medium"
            ? "medium"
            : "low") as "low" | "medium" | "high",
          description: d?.description || "",
        }));
        
        // Extract TIS score from backend response
        const tisScore = data.aggregate_tis || 100;
        const trustScoreData = {
          aggregate_tis: tisScore,
          overall_assessment: data.overall_assessment || "SAFE",
          confidence_overall: data.confidence_overall || 0.8,
          notes: data.notes || "Analysis completed",
        };
        
        // Allow upload if TIS score is 40 or above
        const passed = tisScore >= 40;
        
        setIntegrityResult({ passed, tisScore, differences: mapped, trustScore: trustScoreData });
        
        if (passed) {
          toast({
            title: "Integrity Check Passed",
            description: `TIS Score: ${tisScore}% (≥40 required). Found ${mapped.length} differences.`,
          });
        } else {
          toast({
            title: "Integrity Check Failed",
            description: `TIS Score: ${tisScore}% (<40 required). Upload blocked.`,
            variant: "destructive",
          });
        }
      };
      
      reader.readAsDataURL(afterImageFile);
    } catch (error) {
      console.error('Integrity check error:', error);
      toast({
        title: "Integrity Check Error",
        description: "Failed to perform integrity check",
        variant: "destructive",
      });
      setIntegrityResult({ passed: false, tisScore: 0, differences: [], trustScore: null });
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  useEffect(() => {
    setDemoBatches(loadBatches());
  }, []);

  // Load contract batches when connected
  useEffect(() => {
    if (connectedAddress) {
      loadContractBatches();
    }
  }, [connectedAddress]);

  const loadContractBatches = async () => {
    if (!connectedAddress) return;
    
    try {
      const batchIds = await web3Service.getAllBatchIds();
      const batches: ContractBatch[] = [];
      
      for (const batchId of batchIds) {
        try {
          const batch = await web3Service.getBatch(batchId);
          batches.push(batch);
        } catch (error) {
          console.error(`Failed to load batch ${batchId}:`, error);
        }
      }
      
      setContractBatches(batches);
    } catch (error) {
      console.error('Failed to load contract batches:', error);
      toast({
        title: 'Error',
        description: 'Failed to load batches from contract',
        variant: 'destructive',
      });
    }
  };

  const selectedBatch = useMemo<ContractBatch | DemoBatch | undefined>(
    () => contractBatches.find((b) => b.id === batchId) || demoBatches.find((b) => b.id === batchId),
    [contractBatches, demoBatches, batchId]
  );

  const isContractBatch = useMemo<boolean>(
    () => contractBatches.some((b) => b.id === batchId),
    [contractBatches, batchId]
  );

  const handleSubmit = async (): Promise<void> => {
    if (!batchId || !actor || !role || !note) {
      toast({
        title: "Missing info",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBatch) {
      toast({
        title: "Batch not found",
        description: "Select a valid batch or scan a QR",
        variant: "destructive",
      });
      return;
    }

    // Handle contract batch event logging
    if (isContractBatch) {
      if (!connectedAddress) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet to log events for blockchain batches",
          variant: "destructive",
        });
        return;
      }

      setIsLogging(true);
      try {
        // Generate event hash for blockchain
        const eventHash = generateHash(`${batchId}${actor}${Date.now()}`);
        
        const tx = await web3Service.logEvent(
          batchId,
          actor,
          role,
          note,
          image || '',
          eventHash
        );

        toast({
          title: "Transaction Sent",
          description: "Waiting for blockchain confirmation...",
        });

        const receipt = await web3Service.waitForTransaction(tx);
        
        if (receipt) {
          // Reload contract batches to show updated events
          await loadContractBatches();
          
          toast({
            title: "Event Logged Successfully",
            description: "Event has been recorded on the blockchain!",
          });

          setActor("");
          setRole("");
          setNote("");
          setImage("");
        }
      } catch (error: any) {
        console.error('Event logging error:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to log event on blockchain',
          variant: 'destructive',
        });
      } finally {
        setIsLogging(false);
      }
      return;
    }

    // Handle demo batch event logging (existing functionality)
    const batchIndex = demoBatches.findIndex((b) => b.id === batchId);
    if (batchIndex === -1) {
      toast({
        title: "Batch not found",
        description: "Select a valid batch or scan a QR",
        variant: "destructive",
      });
      return;
    }

    const newEvent: DemoBatchEvent = {
      id: `evt-${Date.now()}`,
      actor,
      role,
      timestamp: new Date().toISOString(),
      note,
      image: image || undefined,
      hash: generateHash(`${batchId}${actor}${Date.now()}`),
      ledgerRef: generateLedgerRef(),
    };

    const next = [...demoBatches];
    next[batchIndex] = {
      ...next[batchIndex],
      events: [...next[batchIndex].events, newEvent],
    };

    setDemoBatches(next);
    saveBatches(next);

    toast({
      title: "Event logged",
      description: "Cryptographic hash & ledger ref generated.",
    });

    setActor("");
    setRole("");
    setNote("");
    setImage("");
  };

  const applyPayload = (decodedText: string): void => {
    setLastScan(decodedText);
    setScanOpen(false);
    setCameraError("");

    // Check if it's an image URL first
    if (decodedText.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      setImage(decodedText);
      toast({
        title: "Image URL Scanned",
        description: "Image URL has been set from QR code",
      });
      return;
    }

    // reject plain URLs (non-supply QR)
    if (/^https?:\/\//i.test(decodedText)) {
      toast({
        title: "QR isn't a supply payload",
        description:
          "You scanned a regular URL. Use a QR with batchId — try the generated test QR.",
        variant: "destructive",
      });
      return;
    }

    const payload = parseQrPayload(decodedText);
    const changed: string[] = [];

    if (payload.batchId) {
      // Check contract batches first, then demo batches
      const contractFound = contractBatches.find(b => b.id === payload.batchId);
      const demoFound = findBatchById(demoBatches, payload.batchId);
      const found = contractFound || demoFound;
      
      if (found) {
        setBatchId(found.id);
        changed.push(`Batch → ${found.id}${contractFound ? ' (Blockchain)' : ' (Demo)'}`);
      } else {
        toast({
          title: "Batch not found",
          description: `Scanned batch "${payload.batchId}" was not found in demo data or blockchain.`,
          variant: "destructive",
        });
      }
    }

    if (payload.actor) {
      setActor(payload.actor);
      changed.push(`Actor → ${payload.actor}`);
    }
    if (payload.role && roles.includes(payload.role)) {
      setRole(payload.role);
      changed.push(`Role → ${payload.role}`);
    }
    if (payload.note) {
      setNote(payload.note);
      changed.push(
        `Note → ${payload.note.slice(0, 40)}${
          payload.note.length > 40 ? "…" : ""
        }`
      );
    }
    if (payload.image) {
      setImage(payload.image);
      changed.push("Image URL → set");
    }

    toast({
      title: "QR scanned",
      description:
        changed.length > 0
          ? `Auto-filled: ${changed.join(", ")}`
          : "No fillable fields found. You can submit manually.",
    });
  };

  const handleAutoScanHit = (): void => {
    setJustScanned(true);
    setTimeout(() => setJustScanned(false), 1200);
  };

  const handleGeneratePng = async (): Promise<void> => {
    const payload = JSON.stringify({
      batchId: "CHT-001-ABC",
      actor: "QuickShip Inc",
      role: "3PL",
      note: "Received at WH",
      image: "/demo/wh1.jpg",
    });

    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setQrPngUrl(dataUrl);
      toast({
        title: "Test QR generated",
        description:
          "Download it and try file scan, or show it to your camera.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "QR generation failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const walkthroughSteps = [
    {
      target: "scan-qr-btn",
      title: "Scan QR Code",
      description: "Use your camera to scan a batch QR code or enter the batch ID manually",
      position: "bottom" as const,
    },
    {
      target: "log-event-form",
      title: "Log Event",
      description: "Fill in event details and attach an image to record this step in the supply chain",
      position: "right" as const,
    },
  ];

  return (
    <ClickSpark
      sparkColor='#fff'
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
    >
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Walkthrough steps={walkthroughSteps} storageKey="log-event-walkthrough" />
      <div className="flex justify-between items-center mb-6">
        <motion.h1
          className="text-3xl md:text-4xl font-bold tracking-tight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          Log Event
        </motion.h1>
        <WalletConnect onAddressChange={setConnectedAddress} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden" id="log-event-form">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Attach Event to Batch</CardTitle>
                  <CardDescription>
                    Record a new supply chain event
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    id="scan-qr-btn"
                    variant="secondary"
                    size="sm"
                    onClick={() => setScanOpen(true)}
                    className="gap-2"
                  >
                    <ScanLine className="h-4 w-4" />
                    Scan QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePng}
                    className="gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    Generate Test QR
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrPngUrl && (
                <div className="rounded-xl border p-3">
                  <img
                    src={qrPngUrl}
                    alt=""
                    className="w-full max-w-[280px] mx-auto"
                  />
                  <div className="flex justify-center mt-2">
                    <a
                      href={qrPngUrl}
                      download="chaintrust-test-qr.png"
                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border"
                    >
                      <Download className="h-4 w-4" />
                      Download PNG
                    </a>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="batchId">Batch ID *</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger id="batchId" className="w-full">
                    <SelectValue placeholder="Select a batch or scan QR" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Contract Batches */}
                    {contractBatches.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Blockchain Batches
                        </div>
                        {contractBatches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                BLOCKCHAIN
                              </span>
                              {batch.id} — {batch.productName}
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    {/* Demo Batches */}
                    {demoBatches.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Demo Batches
                        </div>
                        {demoBatches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                DEMO
                              </span>
                              {batch.id} — {batch.productName}
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    {contractBatches.length === 0 && demoBatches.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No batches available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {selectedBatch && (
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium">Origin:</span>{" "}
                    {selectedBatch.origin}
                    {isContractBatch && (
                      <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                        Blockchain
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="actor">Actor Name *</Label>
                <div className="flex gap-2">
                  <Input
                    id="actor"
                    placeholder="e.g., FastLogistics"
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    aria-label="Fill demo actor"
                    variant="secondary"
                    onClick={() => setActor("QuickShip Inc")}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r === "3PL" ? "3PL / Logistics" : r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Notes *</Label>
                <Textarea
                  id="note"
                  placeholder="Describe the event..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Image URL (Optional)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="image"
                    placeholder="/demo/image.jpg or IPFS url"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    style={{ flex: 1 }}
                    disabled={isUploadingImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          setUploadedImageFile(file);
                          // Create preview
                          const reader = new FileReader();
                          reader.onload = () => {
                            setUploadedImagePreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                          // Don't upload to IPFS yet, wait for integrity check
                          toast({ 
                            title: "Image Selected", 
                            description: "Click 'Check Integrity' to verify before uploading to blockchain." 
                          });
                        }
                      };
                      input.click();
                    }}
                    disabled={isUploadingImage}
                    className="gap-2"
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Choose File
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Integrity Check Section */}
                {uploadedImageFile && selectedBatch && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-sm">Integrity Check Required</h4>
                        <p className="text-xs text-muted-foreground">
                          Compare uploaded image with baseline image from batch: {selectedBatch.id}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          if (selectedBatch && uploadedImageFile) {
                            checkIntegrity(selectedBatch.baselineImage, uploadedImageFile);
                          }
                        }}
                        disabled={isCheckingIntegrity || !selectedBatch?.baselineImage}
                        size="sm"
                        className="gap-2"
                      >
                        {isCheckingIntegrity ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Check Integrity
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Side-by-side Image Comparison */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Baseline Image */}
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Baseline Image
                        </h5>
                        <div className="aspect-square bg-secondary/20 rounded-lg border-2 border-dashed border-green-500/30 flex items-center justify-center overflow-hidden">
                          {selectedBatch.baselineImage ? (
                            <img
                              src={selectedBatch.baselineImage}
                              alt="Baseline"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-4">
                              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">No baseline image</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Uploaded Image */}
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Uploaded Image
                        </h5>
                        <div className="aspect-square bg-secondary/20 rounded-lg border-2 border-dashed border-orange-500/30 flex items-center justify-center overflow-hidden">
                          {uploadedImagePreview ? (
                            <img
                              src={uploadedImagePreview}
                              alt="Uploaded"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-4">
                              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">No image selected</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Integrity Result */}
                    {integrityResult && (
                      <div className={`p-4 rounded-lg border ${
                        integrityResult.passed 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="text-center mb-4">
                          <h4 className="text-lg font-bold mb-3 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            Trust Identity Score
                          </h4>

                          {/* TIS Score Circle */}
                          <div className="relative inline-block mb-4">
                            <div className="w-20 h-20 rounded-full border-4 border-secondary/20 flex items-center justify-center">
                              <svg
                                className="w-20 h-20 absolute inset-0 transform -rotate-90"
                                viewBox="0 0 100 100"
                              >
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  fill="none"
                                  className="text-secondary/20"
                                />
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  fill="none"
                                  strokeDasharray={`${2 * Math.PI * 40}`}
                                  strokeDashoffset={`${
                                    2 *
                                    Math.PI *
                                    40 *
                                    (1 - (integrityResult.tisScore || 0) / 100)
                                  }`}
                                  className={
                                    (integrityResult.tisScore || 0) >= 80
                                      ? "text-green-500"
                                      : (integrityResult.tisScore || 0) >= 40
                                      ? "text-orange-500"
                                      : "text-red-500"
                                  }
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div
                                className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${
                                  (integrityResult.tisScore || 0) >= 80
                                    ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                                    : (integrityResult.tisScore || 0) >= 40
                                    ? "bg-orange-500/20 text-orange-400 border-2 border-orange-500/30"
                                    : "bg-red-500/20 text-red-400 border-2 border-red-500/30"
                                }`}
                              >
                                {integrityResult.tisScore || 0}%
                              </div>
                            </div>
                          </div>

                          {/* Risk Assessment */}
                          <div className="space-y-2">
                            <div
                              className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                                (integrityResult.tisScore || 0) >= 80
                                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                  : (integrityResult.tisScore || 0) >= 40
                                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                  : "bg-red-500/20 text-red-300 border border-red-500/30"
                              }`}
                            >
                              {(integrityResult.tisScore || 0) >= 80 ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  SAFE - Product integrity maintained
                                </>
                              ) : (integrityResult.tisScore || 0) >= 40 ? (
                                <>
                                  <AlertTriangle className="w-4 h-4 mr-2" />
                                  MODERATE RISK - Review required
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-4 h-4 mr-2" />
                                  HIGH RISK - Upload blocked
                                </>
                              )}
                            </div>

                            {integrityResult.trustScore?.notes && (
                              <p className="text-xs text-muted-foreground italic">
                                {integrityResult.trustScore.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Differences List */}
                        {integrityResult.differences && integrityResult.differences.length > 0 && (
                          <div className="mb-3">
                            <h6 className="text-sm font-medium mb-2">Detected Differences ({integrityResult.differences.length}):</h6>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {integrityResult.differences.map((diff: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`p-2 rounded text-xs ${
                                    diff.severity === "high"
                                      ? "bg-red-100 border-l-2 border-red-500"
                                      : diff.severity === "medium"
                                      ? "bg-orange-100 border-l-2 border-orange-500"
                                      : "bg-yellow-100 border-l-2 border-yellow-500"
                                  }`}
                                >
                                  <div className="font-medium">{diff.location}</div>
                                  <div className="text-muted-foreground">{diff.description}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {integrityResult.passed && (
                          <Button
                            onClick={async () => {
                              if (uploadedImageFile) {
                                try {
                                  const url = await handlePinataUpload(uploadedImageFile);
                                  setImage(url);
                                  setUploadedImageFile(null);
                                  setUploadedImagePreview(null);
                                  setIntegrityResult(null);
                                  toast({ 
                                    title: "Upload Success", 
                                    description: "Image uploaded to IPFS and ready for blockchain." 
                                  });
                                } catch {
                                  toast({ 
                                    title: "Upload Error", 
                                    description: "Failed to upload image to Pinata", 
                                    variant: "destructive" 
                                  });
                                }
                              }
                            }}
                            size="sm"
                            className="gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Upload to IPFS
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {isUploadingImage && <span className="text-xs text-blue-500">Uploading image...</span>}
                {image ? (
                  <div className="rounded-xl border p-2">
                    <img
                      src={image}
                      alt=""
                      className="w-full max-h-64 object-cover rounded-lg"
                    />
                  </div>
                ) : null}
              </div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={handleSubmit} 
                  className="w-full"
                  disabled={
                    isLogging || 
                    (isContractBatch && !connectedAddress) ||
                    (uploadedImageFile && !integrityResult?.passed)
                  }
                >
                  {isLogging ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isContractBatch ? 'Logging to Blockchain...' : 'Logging Event...'}
                    </>
                  ) : uploadedImageFile && !integrityResult?.passed ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      TIS Score Too Low (Need ≥40%)
                    </>
                  ) : (
                    isContractBatch ? 'Log Event to Blockchain' : 'Log Event'
                  )}
                </Button>
              </motion.div>

              {lastScan && (
                <div className="p-3 rounded-lg border bg-muted/40 text-xs break-words">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Last QR Payload</span>
                  </div>
                  <pre className="whitespace-pre-wrap">{lastScan}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Demo Walkthrough (older version as requested) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Demo Walkthrough</CardTitle>
              <CardDescription>
                Try logging events to these demo batches
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Step 1: Scan or Select Batch
                </h3>
                <p className="text-sm text-muted-foreground">
                  Scan a QR that includes at least a <code>batchId</code> —
                  e.g.:
                </p>
                <div className="text-xs bg-background border rounded-lg p-2 overflow-x-auto">
                  {
                    '{"batchId":"CHT-001-ABC","actor":"QuickShip Inc","role":"3PL","note":"Received at WH"}'
                  }
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Or use one of the demo batches: <b>CHT-001-ABC</b>,{" "}
                  <b>CHT-002-XYZ</b>, or <b>CHT-DEMO</b>.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold">Step 2: Add Actor Details</h3>
                <p className="text-sm text-muted-foreground">
                  Example: Actor = <b>QuickShip Inc</b>, Role ={" "}
                  <b>3PL / Logistics</b>
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold">Step 3: Describe Event</h3>
                <p className="text-sm text-muted-foreground">
                  Example note:{" "}
                  <i>"Package received at distribution center."</i>
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold">Step 4: Optional Image</h3>
                <p className="text-sm text-muted-foreground">
                  Add an image URL if you have a receipt/photo. We store the
                  hash in the ledger.
                </p>
              </div>

              <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                <p className="text-sm font-medium">
                  💡 Each event generates a unique cryptographic hash and ledger
                  reference for verification.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Scanner Dialog — centered, clean, animated */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <Camera className="h-5 w-5" />
              Scan QR Code
            </DialogTitle>
            <DialogDescription>
              Camera opens automatically. Auto-submits on detection.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full flex flex-col items-center">
            <QRScanner
              onDecoded={applyPayload}
              onError={(err) =>
                setCameraError(typeof err === "string" ? err : err.message)
              }
              onAutoScan={() => setJustScanned(true)}
              elementId="qr-reader-logevent"
              regionBox={320}
            />
            {cameraError && (
              <div className="mt-3 text-xs text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{cameraError}</span>
              </div>
            )}
            <AnimatePresence>
              {justScanned && (
                <motion.div
                  className="mt-3 px-3 py-1.5 rounded-full bg-green-600/90 text-white text-xs"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  onAnimationComplete={() => setJustScanned(false)}
                >
                  Scan captured ✔ Auto-filled form
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </ClickSpark>
  );
}
