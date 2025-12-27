import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@insforge/sdk";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type InsforgeBatchRow = {
  id: string;
  batch_id: string;
  first_view_ipfs: string;
  second_view_ipfs: string;
  created_at: string;
  approved: boolean;
};

export default function LogEvent(): JSX.Element {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [demoBatches, setDemoBatches] = useState<DemoBatch[]>([]);
  const [contractBatches, setContractBatches] = useState<ContractBatch[]>([]);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string>("");
  const [actor, setActor] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [imageAngle1, setImageAngle1] = useState<string>("");
  const [imageAngle2, setImageAngle2] = useState<string>("");

  const [scanOpen, setScanOpen] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");

  const [qrPngUrl, setQrPngUrl] = useState<string>("");
  const [justScanned, setJustScanned] = useState<boolean>(false);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCheckingIntegrityAngle1, setIsCheckingIntegrityAngle1] = useState(false);
  const [integrityResultAngle1, setIntegrityResultAngle1] = useState<{passed: boolean, tisScore?: number, differences?: any[], trustScore?: any} | null>(null);
  const [uploadedImageFileAngle1, setUploadedImageFileAngle1] = useState<File | null>(null);
  const [uploadedImagePreviewAngle1, setUploadedImagePreviewAngle1] = useState<string | null>(null);
  const [isCheckingIntegrityAngle2, setIsCheckingIntegrityAngle2] = useState(false);
  const [integrityResultAngle2, setIntegrityResultAngle2] = useState<{passed: boolean, tisScore?: number, differences?: any[], trustScore?: any} | null>(null);
  const [uploadedImageFileAngle2, setUploadedImageFileAngle2] = useState<File | null>(null);
  const [uploadedImagePreviewAngle2, setUploadedImagePreviewAngle2] = useState<string | null>(null);

  const [selectedInsforgeBatch, setSelectedInsforgeBatch] = useState<InsforgeBatchRow | null>(null);
  const [insforgeFirstViewUrl, setInsforgeFirstViewUrl] = useState<string>("");
  const [insforgeSecondViewUrl, setInsforgeSecondViewUrl] = useState<string>("");

  const INSFORGE_BASE_URL = import.meta.env.VITE_INSFORGE_BASE_URL as string | undefined;
  const INSFORGE_ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined;

  const JWT = import.meta.env.VITE_PINATA_JWT as string;

  const IMAGE_PACK_DELIMITER = "||";

  const unpackImages = (packed: string): string[] => {
    const raw = String(packed || "").trim();
    if (!raw) return [];
    return raw
      .split(IMAGE_PACK_DELIMITER)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const packImages = (a: string, b: string): string => {
    const out = [String(a || "").trim(), String(b || "").trim()].filter(Boolean);
    return out.join(IMAGE_PACK_DELIMITER);
  };

  const ipfsToHttp = (uri: string): string => {
    const value = String(uri || "").trim();
    if (!value) return "";
    if (value.startsWith("ipfs://")) {
      const cid = value.replace("ipfs://", "");
      return `https://ipfs.io/ipfs/${cid}`;
    }
    return value;
  };

  const insforge = useMemo(() => {
    if (!INSFORGE_BASE_URL) return null;
    return createClient({
      baseUrl: INSFORGE_BASE_URL,
      anonKey: INSFORGE_ANON_KEY,
    });
  }, [INSFORGE_BASE_URL, INSFORGE_ANON_KEY]);

  const fetchPendingInsforgeBatches = async (): Promise<InsforgeBatchRow[]> => {
    if (!insforge) {
      return [];
    }

    const { data, error } = await insforge.database
      .from("batches")
      .select("id,batch_id,first_view_ipfs,second_view_ipfs,created_at,approved")
      .eq("approved", false)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error((error as any)?.message || "InsForge query failed");
    }

    return (data as InsforgeBatchRow[] | null) ?? [];
  };

  const {
    data: pendingInsforgeBatches = [],
    isLoading: isLoadingPendingInsforgeBatches,
    isFetching: isFetchingPendingInsforgeBatches,
    error: pendingInsforgeBatchesError,
    refetch: refetchPendingInsforgeBatches,
  } = useQuery({
    queryKey: ["insforge", "batches", "pending"],
    queryFn: fetchPendingInsforgeBatches,
    enabled: Boolean(insforge),
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });

  const approveInsforgeBatchMutation = useMutation({
    mutationFn: async (row: InsforgeBatchRow) => {
      if (!insforge) {
        throw new Error("Missing VITE_INSFORGE_BASE_URL");
      }

      const { error } = await insforge.database.from("batches").update({ approved: true }).eq("id", row.id);
      if (error) {
        throw new Error((error as any)?.message || "Approve failed");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["insforge", "batches", "pending"] });
    },
  });

  const rejectInsforgeBatchMutation = useMutation({
    mutationFn: async (row: InsforgeBatchRow) => {
      if (!insforge) {
        throw new Error("Missing VITE_INSFORGE_BASE_URL");
      }

      const { error } = await insforge.database.from("batches").delete().eq("id", row.id);
      if (error) {
        throw new Error((error as any)?.message || "Reject failed");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["insforge", "batches", "pending"] });
    },
  });

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

  const checkIntegrityAngle1 = async (beforeImageUrl: string, afterImageFile: File) => {
    setIsCheckingIntegrityAngle1(true);
    setIntegrityResultAngle1(null);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const afterImageBase64 = reader.result as string;
        
        // Call integrity check API (same as IntegrityCheck.tsx)
        const API_BASE = (import.meta.env.VITE_BACKEND_URL as string) || "/api";
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
        
        setIntegrityResultAngle1({ passed, tisScore, differences: mapped, trustScore: trustScoreData });
        
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
      setIntegrityResultAngle1({ passed: false, tisScore: 0, differences: [], trustScore: null });
    } finally {
      setIsCheckingIntegrityAngle1(false);
    }
  };

  const checkIntegrityAngle2 = async (beforeImageUrl: string, afterImageFile: File) => {
    setIsCheckingIntegrityAngle2(true);
    setIntegrityResultAngle2(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const afterImageBase64 = reader.result as string;
        const API_BASE = (import.meta.env.VITE_BACKEND_URL as string) || "/api";
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

        const tisScore = data.aggregate_tis || 100;
        const trustScoreData = {
          aggregate_tis: tisScore,
          overall_assessment: data.overall_assessment || "SAFE",
          confidence_overall: data.confidence_overall || 0.8,
          notes: data.notes || "Analysis completed",
        };

        const passed = tisScore >= 40;

        setIntegrityResultAngle2({ passed, tisScore, differences: mapped, trustScore: trustScoreData });

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
      setIntegrityResultAngle2({ passed: false, tisScore: 0, differences: [], trustScore: null });
    } finally {
      setIsCheckingIntegrityAngle2(false);
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
    () => {
      const contract = contractBatches.find((b) => b.id === batchId);
      if (contract) return contract;
      const demo = demoBatches.find((b) => b.id === batchId);
      if (demo) return demo;
      if (selectedInsforgeBatch && selectedInsforgeBatch.batch_id === batchId) {
        return {
          id: selectedInsforgeBatch.batch_id,
          productName: "Pending Batch",
          sku: "",
          origin: "InsForge",
          createdAt: selectedInsforgeBatch.created_at,
          baselineImage: "",
          events: [],
        } as unknown as DemoBatch;
      }
      return undefined;
    },
    [contractBatches, demoBatches, batchId, selectedInsforgeBatch]
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

    if (!imageAngle1 || !imageAngle2) {
      toast({
        title: "Missing image angle",
        description: "Please provide both Angle 1 and Angle 2 images.",
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
          imageAngle1 || '',
          imageAngle2 || '',
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
          setImageAngle1("");
          setImageAngle2("");
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
      image: packImages(imageAngle1, imageAngle2) || undefined,
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
    setImageAngle1("");
    setImageAngle2("");
  };

  const applyPayload = (decodedText: string): void => {
    setLastScan(decodedText);
    setScanOpen(false);
    setCameraError("");

    // Check if it's an image URL first
    if (decodedText.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      setImageAngle1(decodedText);
      toast({
        title: "Image URL Scanned",
        description: "Angle 1 image URL has been set from QR code",
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
      setImageAngle1(payload.image);
      changed.push("Angle 1 Image URL → set");
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
      description: "Fill in event details and attach both angle images to record this step in the supply chain",
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
                    {(pendingInsforgeBatches.length > 0 || selectedInsforgeBatch) && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Pending (InsForge)
                        </div>
                        {selectedInsforgeBatch && (
                          <SelectItem key={selectedInsforgeBatch.id} value={selectedInsforgeBatch.batch_id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                                INSFORGE
                              </span>
                              {selectedInsforgeBatch.batch_id}
                            </div>
                          </SelectItem>
                        )}
                        {pendingInsforgeBatches
                          .filter((b) => b.id !== selectedInsforgeBatch?.id)
                          .map((batch) => (
                            <SelectItem key={batch.id} value={batch.batch_id}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                                  INSFORGE
                                </span>
                                {batch.batch_id}
                              </div>
                            </SelectItem>
                          ))}
                      </>
                    )}
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
                <Label>Current Images (2 angles)</Label>

                {(() => {
                  // Handle both contract batches (firstViewBaseline/secondViewBaseline) and demo batches (baselineImage)
                  let baselineAngle1 = "";
                  let baselineAngle2 = "";
                  
                  if (isContractBatch && selectedBatch) {
                    const contractBatch = selectedBatch as ContractBatch;
                    baselineAngle1 = contractBatch.firstViewBaseline || "";
                    baselineAngle2 = contractBatch.secondViewBaseline || "";
                  } else if (selectedBatch) {
                    const demoBatch = selectedBatch as DemoBatch;
                    const baseline = demoBatch.baselineImage || "";
                    const baselineUrls = unpackImages(baseline);
                    baselineAngle1 = baselineUrls[0] || baseline;
                    baselineAngle2 = baselineUrls[1] || baselineUrls[0] || baseline;
                  }

                  const blockSubmitForAngle1 = Boolean(uploadedImageFileAngle1 && !integrityResultAngle1?.passed);
                  const blockSubmitForAngle2 = Boolean(uploadedImageFileAngle2 && !integrityResultAngle2?.passed);

                  return (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="imageAngle1" className="text-xs text-muted-foreground">Angle 1 Image URL</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            id="imageAngle1"
                            placeholder="/demo/image.jpg or IPFS url"
                            value={imageAngle1}
                            onChange={(e) => setImageAngle1(e.target.value)}
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
                                  setUploadedImageFileAngle1(file);
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setUploadedImagePreviewAngle1(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                  toast({
                                    title: "Image Selected",
                                    description: "Angle 1 selected. Run integrity check before uploading to IPFS.",
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

                        {uploadedImageFileAngle1 && selectedBatch && (
                          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="font-semibold text-sm">Integrity Check (Angle 1)</h4>
                                <p className="text-xs text-muted-foreground">
                                  Compare uploaded image with baseline images from batch: {selectedBatch.id}
                                </p>
                              </div>
                              <Button
                                onClick={() => {
                                  if (uploadedImageFileAngle1 && baselineAngle1) {
                                    checkIntegrityAngle1(baselineAngle1, uploadedImageFileAngle1);
                                  }
                                }}
                                disabled={isCheckingIntegrityAngle1 || !baselineAngle1}
                                size="sm"
                                className="gap-2"
                              >
                                {isCheckingIntegrityAngle1 ? (
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

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  Baseline (Angle 1)
                                </h5>
                                <div className="aspect-square bg-secondary/20 rounded-lg border-2 border-dashed border-green-500/30 flex items-center justify-center overflow-hidden">
                                  {baselineAngle1 ? (
                                    <img src={baselineAngle1} alt="Baseline" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-center p-4">
                                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">No baseline image</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  Uploaded (Angle 1)
                                </h5>
                                <div className="aspect-square bg-secondary/20 rounded-lg border-2 border-dashed border-orange-500/30 flex items-center justify-center overflow-hidden">
                                  {uploadedImagePreviewAngle1 ? (
                                    <img src={uploadedImagePreviewAngle1} alt="Uploaded" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-center p-4">
                                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">No image selected</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {integrityResultAngle1?.passed && (
                              <Button
                                onClick={async () => {
                                  if (uploadedImageFileAngle1) {
                                    try {
                                      const url = await handlePinataUpload(uploadedImageFileAngle1);
                                      setImageAngle1(url);
                                      setUploadedImageFileAngle1(null);
                                      setUploadedImagePreviewAngle1(null);
                                      setIntegrityResultAngle1(null);
                                      toast({
                                        title: "Upload Success",
                                        description: "Angle 1 image uploaded to IPFS.",
                                      });
                                    } catch {
                                      toast({
                                        title: "Upload Error",
                                        description: "Failed to upload image to Pinata",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                size="sm"
                                className="gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                Upload Angle 1 to IPFS
                              </Button>
                            )}
                          </div>
                        )}

                        {imageAngle1 ? (
                          <div className="rounded-xl border p-2">
                            <img src={imageAngle1} alt="" className="w-full max-h-64 object-cover rounded-lg" />
                          </div>
                        ) : null}

                        {blockSubmitForAngle1 && (
                          <div className="text-xs text-red-600">
                            Angle 1 integrity check is required before logging.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="imageAngle2" className="text-xs text-muted-foreground">Angle 2 Image URL</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            id="imageAngle2"
                            placeholder="/demo/image.jpg or IPFS url"
                            value={imageAngle2}
                            onChange={(e) => setImageAngle2(e.target.value)}
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
                                  setUploadedImageFileAngle2(file);
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setUploadedImagePreviewAngle2(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                  toast({
                                    title: "Image Selected",
                                    description: "Angle 2 selected. Run integrity check before uploading to IPFS.",
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

                        {uploadedImageFileAngle2 && selectedBatch && (
                          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="font-semibold text-sm">Integrity Check (Angle 2)</h4>
                                <p className="text-xs text-muted-foreground">
                                  Compare uploaded image with baseline images from batch: {selectedBatch.id}
                                </p>
                              </div>
                              <Button
                                onClick={() => {
                                  if (uploadedImageFileAngle2 && baselineAngle2) {
                                    checkIntegrityAngle2(baselineAngle2, uploadedImageFileAngle2);
                                  }
                                }}
                                disabled={isCheckingIntegrityAngle2 || !baselineAngle2}
                                size="sm"
                                className="gap-2"
                              >
                                {isCheckingIntegrityAngle2 ? (
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

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  Baseline (Angle 2)
                                </h5>
                                <div className="aspect-square bg-secondary/20 rounded-lg border-2 border-dashed border-green-500/30 flex items-center justify-center overflow-hidden">
                                  {baselineAngle2 ? (
                                    <img src={baselineAngle2} alt="Baseline" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-center p-4">
                                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">No baseline image</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  Uploaded (Angle 2)
                                </h5>
                                <div className="aspect-square bg-secondary/20 rounded-lg border-2 border-dashed border-orange-500/30 flex items-center justify-center overflow-hidden">
                                  {uploadedImagePreviewAngle2 ? (
                                    <img src={uploadedImagePreviewAngle2} alt="Uploaded" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-center p-4">
                                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">No image selected</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {integrityResultAngle2?.passed && (
                              <Button
                                onClick={async () => {
                                  if (uploadedImageFileAngle2) {
                                    try {
                                      const url = await handlePinataUpload(uploadedImageFileAngle2);
                                      setImageAngle2(url);
                                      setUploadedImageFileAngle2(null);
                                      setUploadedImagePreviewAngle2(null);
                                      setIntegrityResultAngle2(null);
                                      toast({
                                        title: "Upload Success",
                                        description: "Angle 2 image uploaded to IPFS.",
                                      });
                                    } catch {
                                      toast({
                                        title: "Upload Error",
                                        description: "Failed to upload image to Pinata",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                size="sm"
                                className="gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                Upload Angle 2 to IPFS
                              </Button>
                            )}
                          </div>
                        )}

                        {imageAngle2 ? (
                          <div className="rounded-xl border p-2">
                            <img src={imageAngle2} alt="" className="w-full max-h-64 object-cover rounded-lg" />
                          </div>
                        ) : null}

                        {blockSubmitForAngle2 && (
                          <div className="text-xs text-red-600">
                            Angle 2 integrity check is required before logging.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {isUploadingImage && <span className="text-xs text-blue-500">Uploading image...</span>}
              </div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={handleSubmit} 
                  className="w-full"
                  disabled={
                    isLogging || 
                    (isContractBatch && !connectedAddress) ||
                    (uploadedImageFileAngle1 && !integrityResultAngle1?.passed) ||
                    (uploadedImageFileAngle2 && !integrityResultAngle2?.passed)
                  }
                >
                  {isLogging ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isContractBatch ? 'Logging to Blockchain...' : 'Logging Event...'}
                    </>
                  ) : (uploadedImageFileAngle1 && !integrityResultAngle1?.passed) || (uploadedImageFileAngle2 && !integrityResultAngle2?.passed) ? (
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
                <h3 className="font-semibold">Step 4: 2 Images (Required)</h3>
                <p className="text-sm text-muted-foreground">
                  Add both angle images. We store them in the ledger using the existing event image field.
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

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8"
      >
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Pending Batches
                  <Badge variant="secondary" className="font-mono">
                    approved=false
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Live feed from InsForge `batches` table. Click approve to autofill the Batch ID and both images.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchPendingInsforgeBatches()}
                  disabled={isLoadingPendingInsforgeBatches || isFetchingPendingInsforgeBatches}
                  className="gap-2"
                >
                  {(isLoadingPendingInsforgeBatches || isFetchingPendingInsforgeBatches) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refreshing
                    </>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(!INSFORGE_BASE_URL || !INSFORGE_ANON_KEY) && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="font-medium mb-1">InsForge env not configured</div>
                <div className="text-muted-foreground">
                  Add `VITE_INSFORGE_BASE_URL` and `VITE_INSFORGE_ANON_KEY` to your frontend `.env`, then restart Vite.
                </div>
              </div>
            )}

            {pendingInsforgeBatchesError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {pendingInsforgeBatchesError instanceof Error
                  ? pendingInsforgeBatchesError.message
                  : "Failed to load pending batches"}
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>First View</TableHead>
                    <TableHead>Second View</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPendingInsforgeBatches ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        Loading pending batches...
                      </TableCell>
                    </TableRow>
                  ) : pendingInsforgeBatches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        No pending rows (approved=false)
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingInsforgeBatches.map((row) => {
                      const firstUrl = ipfsToHttp(row.first_view_ipfs);
                      const secondUrl = ipfsToHttp(row.second_view_ipfs);
                      const isApproving = approveInsforgeBatchMutation.isPending && approveInsforgeBatchMutation.variables?.id === row.id;
                      const isRejecting = rejectInsforgeBatchMutation.isPending && rejectInsforgeBatchMutation.variables?.id === row.id;

                      return (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-semibold">{row.batch_id}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            {firstUrl ? (
                              <a
                                href={firstUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm underline underline-offset-4"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {secondUrl ? (
                              <a
                                href={secondUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm underline underline-offset-4"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                size="sm"
                                className="gap-2"
                                disabled={isApproving || isRejecting}
                                onClick={async () => {
                                  setSelectedInsforgeBatch(row);
                                  setBatchId(row.batch_id);
                                  setInsforgeFirstViewUrl(firstUrl);
                                  setInsforgeSecondViewUrl(secondUrl);
                                  if (firstUrl) {
                                    setImageAngle1(firstUrl);
                                  }
                                  if (secondUrl) {
                                    setImageAngle2(secondUrl);
                                  }
                                  toast({
                                    title: "Loaded batch",
                                    description: `Batch ID and both images filled for ${row.batch_id}`,
                                  });

                                  try {
                                    await approveInsforgeBatchMutation.mutateAsync(row);
                                    toast({
                                      title: "Approved",
                                      description: `${row.batch_id} marked approved in InsForge`,
                                    });
                                  } catch (e) {
                                    toast({
                                      title: "Approve failed",
                                      description: e instanceof Error ? e.message : "Could not approve",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                {isApproving ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Approving
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                disabled={isApproving || isRejecting}
                                onClick={async () => {
                                  const ok = window.confirm(`Reject ${row.batch_id}? This will delete the row from InsForge.`);
                                  if (!ok) return;
                                  try {
                                    await rejectInsforgeBatchMutation.mutateAsync(row);
                                    toast({
                                      title: "Rejected",
                                      description: `${row.batch_id} removed from pending list`,
                                    });
                                  } catch (e) {
                                    toast({
                                      title: "Reject failed",
                                      description: e instanceof Error ? e.message : "Could not reject",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                {isRejecting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Rejecting
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="h-4 w-4" />
                                    Reject
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {(insforgeFirstViewUrl || insforgeSecondViewUrl) && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="text-sm font-semibold mb-2">First view (angle 1)</div>
                  <Input value={insforgeFirstViewUrl} readOnly />
                  {insforgeFirstViewUrl && (
                    <img src={insforgeFirstViewUrl} alt="" className="mt-3 w-full max-h-56 object-cover rounded-lg border" />
                  )}
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-sm font-semibold mb-2">Second view (angle 2)</div>
                  <Input value={insforgeSecondViewUrl} readOnly />
                  {insforgeSecondViewUrl && (
                    <img src={insforgeSecondViewUrl} alt="" className="mt-3 w-full max-h-56 object-cover rounded-lg border" />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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
