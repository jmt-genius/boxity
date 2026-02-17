import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Walkthrough } from "@/components/Walkthrough";
import { WalletConnect } from "@/components/WalletConnect";
import {
  loadBatches,
  saveBatches,
  type Batch as DemoBatch,
} from "@/lib/demoData";
import { web3Service, type Batch as ContractBatch } from "@/lib/web3";
import ClickSpark from "@/components/ClickSpark";
import QRCode from "qrcode";
import { Download, Loader2, Upload } from "lucide-react";

const Admin = () => {
  const { toast } = useToast();
  const [demoBatches, setDemoBatches] = useState<DemoBatch[]>(loadBatches());
  const [contractBatches, setContractBatches] = useState<ContractBatch[]>([]);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [batchId, setBatchId] = useState("");
  const [baselineImage1, setBaselineImage1] = useState("");
  const [baselineImage2, setBaselineImage2] = useState("");
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [currentQR, setCurrentQR] = useState({ id: "", dataUrl: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const JWT = import.meta.env.VITE_PINATA_JWT as string;

  const IMAGE_PACK_DELIMITER = "||";

  const packImages = (a: string, b: string): string => {
    const out = [String(a || "").trim(), String(b || "").trim()].filter(Boolean);
    return out.join(IMAGE_PACK_DELIMITER);
  };

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
        return `https://chocolate-worldwide-earwig-657.mypinata.cloud/ipfs/${response.data.cid}`;
      } else {
        throw new Error("No CID returned from Pinata.");
      }
    } finally {
      setIsUploadingImage(false);
    }
  };
  // Load contract batches when connected
  useEffect(() => {
    if (connectedAddress) {
      loadContractBatches();
    }
  }, [connectedAddress]);

  const generateBatchId = () => {
    const prefix = "CHT";
    const random1 = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const random2 = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${random1}-${random2}`;
  };

  const loadContractBatches = async () => {
    if (!connectedAddress) return;

    setIsLoadingBatches(true);
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
      console.error("Failed to load contract batches:", error);
      toast({
        title: "Error",
        description: "Failed to load batches from contract",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!productName) {
      toast({
        title: "Error",
        description: "Product name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const finalBatchId = batchId || generateBatchId();

    try {
      // Create batch on Ethereum
      if (!connectedAddress) {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        });
        return;
      }

      const tx = await web3Service.createBatch(
        finalBatchId,
        productName,
        sku || "",
        "Your Company",
        baselineImage1 || "/demo/placeholder.jpg",
        baselineImage2 || "/demo/placeholder.jpg"
      );

      toast({
        title: "Transaction Sent",
        description: "Waiting for blockchain confirmation...",
      });

      // Wait for transaction confirmation
      const receipt = await web3Service.waitForTransaction(tx);

      if (receipt) {
        // Reload contract batches
        await loadContractBatches();

        // Generate QR code
        try {
          const qrDataUrl = await QRCode.toDataURL(finalBatchId, {
            width: 400,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setCurrentQR({ id: finalBatchId, dataUrl: qrDataUrl });
          setQrDialogOpen(true);
        } catch (error) {
          console.error("QR generation error:", error);
        }

        // Reset form
        setProductName("");
        setSku("");
        setBatchId("");
        setBaselineImage1("");
        setBaselineImage2("");

        toast({
          title: "Success",
          description: `Batch ${finalBatchId} created successfully on blockchain!`,
        });
      }
    } catch (error: any) {
      console.error("Batch creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create batch on blockchain",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const downloadQR = () => {
    const link = document.createElement("a");
    link.download = `qr-${currentQR.id}.png`;
    link.href = currentQR.dataUrl;
    link.click();
  };

  const walkthroughSteps = [
    {
      target: "create-batch-form",
      title: "Create Batch",
      description:
        "Fill in product details and generate a unique batch ID with QR code",
      position: "right" as const,
    },
    {
      target: "batch-table",
      title: "View Batches",
      description: "All created batches are listed here with their details",
      position: "top" as const,
    },
  ];

  return (
    <ClickSpark
      sparkColor="#fff"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
    >
      <div className="container mx-auto px-4 py-8">
        <Walkthrough steps={walkthroughSteps} storageKey="admin-walkthrough" />
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <WalletConnect onAddressChange={setConnectedAddress} />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Create Batch Form */}
          <Card id="create-batch-form">
            <CardHeader>
              <CardTitle>Create New Batch</CardTitle>
              <CardDescription>
                Register a new product batch in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  placeholder="e.g., VitaTabs 10mg"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input
                  id="sku"
                  placeholder="e.g., VT-10MG-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchId">Batch ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="batchId"
                    placeholder="Auto-generated if empty"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBatchId(generateBatchId())}
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Baseline Images (2 angles)</Label>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="baselineImage1" className="text-xs text-muted-foreground">Baseline Image 1</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="baselineImage1"
                        placeholder="/demo/product.jpg or IPFS url"
                        value={baselineImage1}
                        onChange={(e) => setBaselineImage1(e.target.value)}
                        style={{ flex: 1 }}
                        disabled={isUploadingImage}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              try {
                                const url = await handlePinataUpload(file);
                                setBaselineImage1(url);
                                toast({
                                  title: "Upload Success",
                                  description: "Image 1 uploaded to IPFS.",
                                });
                              } catch {
                                toast({
                                  title: "Upload Error",
                                  description: "Failed to upload image to Pinata",
                                  variant: "destructive",
                                });
                              }
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
                    {baselineImage1 && (
                      <img
                        src={baselineImage1}
                        alt="baseline 1 preview"
                        className="w-28 h-28 rounded border mt-2 object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="baselineImage2" className="text-xs text-muted-foreground">Baseline Image 2</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="baselineImage2"
                        placeholder="/demo/product.jpg or IPFS url"
                        value={baselineImage2}
                        onChange={(e) => setBaselineImage2(e.target.value)}
                        style={{ flex: 1 }}
                        disabled={isUploadingImage}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              try {
                                const url = await handlePinataUpload(file);
                                setBaselineImage2(url);
                                toast({
                                  title: "Upload Success",
                                  description: "Image 2 uploaded to IPFS.",
                                });
                              } catch {
                                toast({
                                  title: "Upload Error",
                                  description: "Failed to upload image to Pinata",
                                  variant: "destructive",
                                });
                              }
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
                    {baselineImage2 && (
                      <img
                        src={baselineImage2}
                        alt="baseline 2 preview"
                        className="w-28 h-28 rounded border mt-2 object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </div>
                </div>

                {isUploadingImage && <span className="text-xs text-blue-500">Uploading image...</span>}
              </div>

              <Button
                onClick={handleCreateBatch}
                className="w-full"
                disabled={!connectedAddress || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating on Blockchain...
                  </>
                ) : (
                  "Create Batch on Blockchain"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Demo Batches Info */}
          <Card>
            <CardHeader>
              <CardTitle>Demo Batches Available</CardTitle>
              <CardDescription>Pre-loaded batches for testing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-semibold">CHT-001-ABC</p>
                  <p className="text-sm text-muted-foreground">
                    VitaTabs 10mg (2 events)
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-semibold">CHT-002-XYZ</p>
                  <p className="text-sm text-muted-foreground">
                    ColdVax (1 event)
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-semibold">CHT-DEMO</p>
                  <p className="text-sm text-muted-foreground">
                    Generic Demo Product (2 events)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blockchain Batches Table */}
        {connectedAddress && (
          <Card className="mt-8" id="batch-table">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Blockchain Batches</CardTitle>
                  <CardDescription>
                    Batches stored on the blockchain
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadContractBatches}
                  disabled={isLoadingBatches}
                >
                  {isLoadingBatches ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractBatches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          {isLoadingBatches
                            ? "Loading batches..."
                            : "No batches found on blockchain"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      contractBatches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-mono font-semibold">
                            {batch.id}
                          </TableCell>
                          <TableCell>{batch.productName}</TableCell>
                          <TableCell>{batch.sku || "-"}</TableCell>
                          <TableCell>{batch.origin}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {batch.creator.slice(0, 6)}...
                            {batch.creator.slice(-4)}
                          </TableCell>
                          <TableCell>
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demo Batches Table */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Demo Batches (Local)</CardTitle>
            <CardDescription>Local demo batches for testing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono font-semibold">
                        {batch.id}
                      </TableCell>
                      <TableCell>{batch.productName}</TableCell>
                      <TableCell>{batch.sku || "-"}</TableCell>
                      <TableCell>{batch.origin}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {batch.events?.length || 0} events
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Batch Created Successfully</DialogTitle>
              <DialogDescription>
                Batch ID:{" "}
                <span className="font-mono font-semibold">{currentQR.id}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
              {currentQR.dataUrl && (
                <img
                  src={currentQR.dataUrl}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              )}
              <Button onClick={downloadQR} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download QR Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ClickSpark>
  );
};

export default Admin;
