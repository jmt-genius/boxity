import { useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle, CheckCircle } from "lucide-react";
import { Box3D } from "@/components/Box3D";
import { useToast } from "@/hooks/use-toast";
import ClickSpark from "@/components/ClickSpark";

interface DifferenceResult {
  location: string;
  severity: "low" | "medium" | "high";
  description: string;
}

interface BackendDifference {
  id?: string;
  region?: string;
  bbox?: [number, number, number, number] | null;
  type?: string;
  description?: string;
  severity?: string;
  confidence?: number;
  view?: string;
  explainability?: string[];
  suggested_action?: string;
  tis_delta?: number;
}

interface TrustScoreData {
  aggregate_tis: number;
  overall_assessment: string;
  confidence_overall: number;
  notes: string;
}

interface ImageInfo {
  resolution?: [number, number];
  exif_present?: boolean;
  camera_make?: string;
  camera_model?: string;
  datetime?: string;
}

interface AnalysisMetadata {
  total_differences: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  analysis_timestamp: string;
}

interface BackendResponse {
  differences?: BackendDifference[];
  aggregate_tis?: number;
  overall_assessment?: string;
  confidence_overall?: number;
  notes?: string;
  baseline_image_info?: ImageInfo;
  current_image_info?: ImageInfo;
  analysis_metadata?: AnalysisMetadata;
  angle_results?: any[];
}

export default function IntegrityCheck() {
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);

  const [baselineAngle1, setBaselineAngle1] = useState<string | null>(null);
  const [baselineAngle2, setBaselineAngle2] = useState<string | null>(null);
  const [currentAngle1, setCurrentAngle1] = useState<string | null>(null);
  const [currentAngle2, setCurrentAngle2] = useState<string | null>(null);

  const [differences, setDifferences] = useState<DifferenceResult[] | null>(
    null
  );
  const [trustScore, setTrustScore] = useState<TrustScoreData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (
    e: ChangeEvent<HTMLInputElement>,
    type: "before" | "after"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "before") {
          setBeforeImage(reader.result as string);
        } else {
          setAfterImage(reader.result as string);
        }
        // Reset previous analysis results when new images are uploaded
        setDifferences(null);
        setTrustScore(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleActualImageUpload = (
    e: ChangeEvent<HTMLInputElement>,
    type: "baseline1" | "baseline2" | "current1" | "current2"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const value = reader.result as string;
        if (type === "baseline1") {
          setBaselineAngle1(value);
        } else if (type === "baseline2") {
          setBaselineAngle2(value);
        } else if (type === "current1") {
          setCurrentAngle1(value);
        } else {
          setCurrentAngle2(value);
        }

        setDifferences(null);
        setTrustScore(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadDemoMode = () => {
    setIsDemoMode(true);
    // Demo images - using placeholder data URIs
    const demoBeforeImage =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%2320184f'/%3E%3Ctext x='50%25' y='50%25' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3ESealed Box - Pristine%3C/text%3E%3Crect x='50' y='50' width='300' height='300' fill='none' stroke='%238b5cf6' stroke-width='3' rx='10'/%3E%3C/svg%3E";
    const demoAfterImage =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%2320184f'/%3E%3Ctext x='50%25' y='50%25' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3EBox - With Damage%3C/text%3E%3Crect x='50' y='50' width='300' height='300' fill='none' stroke='%23ef4444' stroke-width='3' rx='10'/%3E%3Cpolygon points='300,100 350,80 320,120' fill='%23ef4444' opacity='0.7'/%3E%3Cline x1='60' y1='200' x2='150' y2='210' stroke='%23f97316' stroke-width='2'/%3E%3C/svg%3E";

    setBeforeImage(demoBeforeImage);
    setAfterImage(demoAfterImage);

    setBaselineAngle1(null);
    setBaselineAngle2(null);
    setCurrentAngle1(null);
    setCurrentAngle2(null);
    // Reset previous analysis results when loading demo mode
    setDifferences(null);
    setTrustScore(null);

    toast({
      title: "Demo mode loaded",
      description: "Sample images loaded. Click 'Check Integrity' to analyze.",
    });
  };

  const checkIntegrity = () => {
    if (isDemoMode) {
      if (!beforeImage || !afterImage) {
        toast({
          title: "Missing images",
          description: "Please upload both before and after images",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!baselineAngle1 || !baselineAngle2 || !currentAngle1 || !currentAngle2) {
        toast({
          title: "Missing images",
          description: "Please upload 2 baseline images and 2 current images",
          variant: "destructive",
        });
        return;
      }
    }

    setIsAnalyzing(true);

    // If demo mode is enabled, keep existing simulated behavior
    if (isDemoMode) {
      setTimeout(() => {
        const hardcodedDifferences: DifferenceResult[] = [
          {
            location: "Top-right corner",
            severity: "medium",
            description: "Visible dent detected (3.2mm depth)",
          },
          {
            location: "Left side panel",
            severity: "low",
            description: "Minor surface scratches",
          },
          {
            location: "Seal integrity",
            severity: "high",
            description: "Seal appears tampered - security breach detected",
          },
        ];

        // Demo trust score data - simulating a compromised package
        const demoTrustScore: TrustScoreData = {
          aggregate_tis: 35, // Low score due to seal tampering
          overall_assessment: "QUARANTINE",
          confidence_overall: 0.92,
          notes: "High-risk tampering detected - immediate quarantine required",
        };

        setDifferences(hardcodedDifferences);
        setTrustScore(demoTrustScore);
        setIsAnalyzing(false);
        toast({
          title: "Analysis complete",
          description: `Found ${hardcodedDifferences.length} differences. Trust Score: ${demoTrustScore.aggregate_tis}%`,
        });
      }, 2000);
      return;
    }

    // Call backend analyzer when not in demo mode
    const API_BASE = (import.meta.env.VITE_BACKEND_URL as string) || "/api";
    fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseline_angle1: baselineAngle1,
        baseline_angle2: baselineAngle2,
        current_angle1: currentAngle1,
        current_angle2: currentAngle2,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Analyzer returned ${res.status}`);
        }
        return res.json() as Promise<BackendResponse>;
      })
      .then((data) => {
        // Map backend schema to UI DifferenceResult
        const mapped: DifferenceResult[] = Array.isArray(data?.differences)
          ? data.differences.map((d: BackendDifference) => ({
              location: `${d?.view ? `${d.view.replace("_", " ")} - ` : ""}${d?.region || "Unknown region"}`,
              severity: (String(d?.severity || "LOW").toLowerCase() ===
              "critical"
                ? "high"
                : String(d?.severity || "LOW").toLowerCase() === "high"
                ? "high"
                : String(d?.severity || "LOW").toLowerCase() === "medium"
                ? "medium"
                : "low") as "low" | "medium" | "high",
              description: d?.description || "",
            }))
          : [];

        // Extract trust score data with enhanced metadata
        const trustScoreData: TrustScoreData = {
          aggregate_tis: data?.aggregate_tis || 100,
          overall_assessment: data?.overall_assessment || "SAFE",
          confidence_overall: data?.confidence_overall || 0.8,
          notes: data?.notes || "Analysis completed",
        };

        // Log analysis metadata for debugging
        if (data?.analysis_metadata) {
          console.log("Analysis Metadata:", data.analysis_metadata);
        }

        setDifferences(mapped);
        setTrustScore(trustScoreData);
        // Enhanced toast with risk assessment
        const riskLevel = String(trustScoreData.overall_assessment || "").toUpperCase().includes("SAFE")
          ? "SAFE"
          : String(trustScoreData.overall_assessment || "").toUpperCase().includes("MODERATE")
          ? "MODERATE RISK"
          : "HIGH RISK";

        toast({
          title: "Analysis complete",
          description: `Found ${mapped.length} differences. Trust Score: ${trustScoreData.aggregate_tis}% (${riskLevel})`,
          variant:
            trustScoreData.aggregate_tis < 40
              ? "destructive"
              : trustScoreData.aggregate_tis < 80
              ? "default"
              : "default",
        });
      })
      .catch((err) => {
        console.error(err);
        toast({
          title: "Analysis failed",
          description: "Could not analyze images. Check backend URL/API.",
          variant: "destructive",
        });
      })
      .finally(() => setIsAnalyzing(false));
  };

  return (
    <ClickSpark
      sparkColor="#fff"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
    >
      <div className="min-h-screen bg-background pt-8 pb-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-8"
          >
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"
            >
              Box Integrity Checker
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-muted-foreground text-base mb-4"
            >
              Upload 2 baseline images and 2 current images (2 angles each) to detect tampering and damage
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Button
                onClick={loadDemoMode}
                variant="outline"
                size="sm"
                className="border-primary/50 hover:bg-primary/10 transition-all duration-300 hover:scale-105"
              >
                Load Demo Mode
              </Button>
            </motion.div>
          </motion.div>

          {isDemoMode ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="grid md:grid-cols-2 gap-6 mb-8"
            >
              {/* Before Section */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <GlassCard
                  className="p-5 hover:shadow-xl transition-all duration-300"
                  id="before-upload"
                >
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Before (Baseline)
                  </h3>
                  <div className="aspect-[4/3] bg-secondary/20 rounded-lg border-2 border-dashed border-primary/30 flex flex-col items-center justify-center mb-4 overflow-hidden group hover:border-primary/50 transition-all duration-300">
                    {beforeImage ? (
                      <motion.img
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        src={beforeImage}
                        alt="Before"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center p-6"
                      >
                        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                        <p className="text-muted-foreground text-sm">
                          Upload baseline image
                        </p>
                      </motion.div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "before")}
                    className="hidden"
                    id="before-input"
                  />
                  <Button
                    onClick={() =>
                      document.getElementById("before-input")?.click()
                    }
                    variant="outline"
                    size="sm"
                    className="w-full hover:bg-primary/10 transition-all duration-300"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Before Image
                  </Button>
                  <div className="h-40 mt-4">
                    <Box3D state="sealed" />
                  </div>
                </GlassCard>
              </motion.div>

              {/* After Section */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                <GlassCard
                  className="p-5 hover:shadow-xl transition-all duration-300"
                  id="after-upload"
                >
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    After (Current)
                  </h3>
                  <div className="aspect-[4/3] bg-secondary/20 rounded-lg border-2 border-dashed border-orange-500/30 flex flex-col items-center justify-center mb-4 overflow-hidden group hover:border-orange-500/50 transition-all duration-300">
                    {afterImage ? (
                      <motion.img
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        src={afterImage}
                        alt="After"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center p-6"
                      >
                        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-orange-500 transition-colors duration-300" />
                        <p className="text-muted-foreground text-sm">
                          Upload current image
                        </p>
                      </motion.div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "after")}
                    className="hidden"
                    id="after-input"
                  />
                  <Button
                    onClick={() =>
                      document.getElementById("after-input")?.click()
                    }
                    variant="outline"
                    size="sm"
                    className="w-full hover:bg-orange-500/10 transition-all duration-300"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload After Image
                  </Button>
                  <div className="h-40 mt-4">
                    <Box3D state={differences ? "damaged" : "in-transit"} />
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="grid md:grid-cols-2 gap-6 mb-8"
            >
              {/* Baseline Angle 1 */}
              <GlassCard className="p-5 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Baseline (Angle 1)
                </h3>
                <div className="aspect-[4/3] bg-secondary/20 rounded-lg border-2 border-dashed border-primary/30 flex flex-col items-center justify-center mb-4 overflow-hidden group hover:border-primary/50 transition-all duration-300">
                  {baselineAngle1 ? (
                    <motion.img
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      src={baselineAngle1}
                      alt="Baseline angle 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                      <p className="text-muted-foreground text-sm">Upload baseline angle 1</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleActualImageUpload(e, "baseline1")}
                  className="hidden"
                  id="baseline-1-input"
                />
                <Button
                  onClick={() => document.getElementById("baseline-1-input")?.click()}
                  variant="outline"
                  size="sm"
                  className="w-full hover:bg-primary/10 transition-all duration-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Baseline 1
                </Button>
              </GlassCard>

              {/* Baseline Angle 2 */}
              <GlassCard className="p-5 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Baseline (Angle 2)
                </h3>
                <div className="aspect-[4/3] bg-secondary/20 rounded-lg border-2 border-dashed border-primary/30 flex flex-col items-center justify-center mb-4 overflow-hidden group hover:border-primary/50 transition-all duration-300">
                  {baselineAngle2 ? (
                    <motion.img
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      src={baselineAngle2}
                      alt="Baseline angle 2"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                      <p className="text-muted-foreground text-sm">Upload baseline angle 2</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleActualImageUpload(e, "baseline2")}
                  className="hidden"
                  id="baseline-2-input"
                />
                <Button
                  onClick={() => document.getElementById("baseline-2-input")?.click()}
                  variant="outline"
                  size="sm"
                  className="w-full hover:bg-primary/10 transition-all duration-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Baseline 2
                </Button>
              </GlassCard>

              {/* Current Angle 1 */}
              <GlassCard className="p-5 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Current (Angle 1)
                </h3>
                <div className="aspect-[4/3] bg-secondary/20 rounded-lg border-2 border-dashed border-orange-500/30 flex flex-col items-center justify-center mb-4 overflow-hidden group hover:border-orange-500/50 transition-all duration-300">
                  {currentAngle1 ? (
                    <motion.img
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      src={currentAngle1}
                      alt="Current angle 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-orange-500 transition-colors duration-300" />
                      <p className="text-muted-foreground text-sm">Upload current angle 1</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleActualImageUpload(e, "current1")}
                  className="hidden"
                  id="current-1-input"
                />
                <Button
                  onClick={() => document.getElementById("current-1-input")?.click()}
                  variant="outline"
                  size="sm"
                  className="w-full hover:bg-orange-500/10 transition-all duration-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Current 1
                </Button>
              </GlassCard>

              {/* Current Angle 2 */}
              <GlassCard className="p-5 hover:shadow-xl transition-all duration-300">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Current (Angle 2)
                </h3>
                <div className="aspect-[4/3] bg-secondary/20 rounded-lg border-2 border-dashed border-orange-500/30 flex flex-col items-center justify-center mb-4 overflow-hidden group hover:border-orange-500/50 transition-all duration-300">
                  {currentAngle2 ? (
                    <motion.img
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      src={currentAngle2}
                      alt="Current angle 2"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground group-hover:text-orange-500 transition-colors duration-300" />
                      <p className="text-muted-foreground text-sm">Upload current angle 2</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleActualImageUpload(e, "current2")}
                  className="hidden"
                  id="current-2-input"
                />
                <Button
                  onClick={() => document.getElementById("current-2-input")?.click()}
                  variant="outline"
                  size="sm"
                  className="w-full hover:bg-orange-500/10 transition-all duration-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Current 2
                </Button>
                <div className="h-40 mt-4">
                  <Box3D state={differences ? "damaged" : "in-transit"} />
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Check Integrity Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="text-center mb-6"
            id="check-integrity-btn"
          >
            <Button
              onClick={checkIntegrity}
              disabled={isAnalyzing}
              size="lg"
              className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-600 text-white px-10 py-4 text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {isAnalyzing ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  Analyzing...
                </motion.div>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Check Integrity
                </>
              )}
            </Button>
          </motion.div>

          {/* Trust Score Display */}
          {trustScore && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6"
            >
              <GlassCard className="p-5 hover:shadow-xl transition-all duration-300">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">
                    <CheckCircle className="w-6 h-6" />
                    Trust Identity Score
                  </h3>

                  {/* Score Circle */}
                  <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 rounded-full border-6 border-secondary/20 flex items-center justify-center">
                      <svg
                        className="w-24 h-24 absolute inset-0 transform -rotate-90"
                        viewBox="0 0 120 120"
                      >
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-secondary/20"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 50}`}
                          strokeDashoffset={`${
                            2 *
                            Math.PI *
                            50 *
                            (1 - trustScore.aggregate_tis / 100)
                          }`}
                          className={
                            trustScore.aggregate_tis >= 80
                              ? "text-green-500"
                              : trustScore.aggregate_tis >= 40
                              ? "text-orange-500"
                              : "text-red-500"
                          }
                          strokeLinecap="round"
                        />
                      </svg>
                      <div
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
                          trustScore.aggregate_tis >= 80
                            ? "bg-green-500/20 text-green-400 border-3 border-green-500/30"
                            : trustScore.aggregate_tis >= 40
                            ? "bg-orange-500/20 text-orange-400 border-3 border-orange-500/30"
                            : "bg-red-500/20 text-red-400 border-3 border-red-500/30"
                        }`}
                      >
                        {trustScore.aggregate_tis}%
                      </div>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className="space-y-2">
                    <div
                      className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                        trustScore.aggregate_tis >= 80
                          ? "bg-green-500/20 text-green-300 border border-green-500/30"
                          : trustScore.aggregate_tis >= 40
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {String(trustScore.overall_assessment || "").toUpperCase().includes("SAFE") ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          SAFE - Product integrity maintained
                        </>
                      ) : String(trustScore.overall_assessment || "").toUpperCase().includes("MODERATE") ? (
                        <>
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          MODERATE RISK - Review required
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          HIGH RISK - Immediate quarantine required
                        </>
                      )}
                    </div>

                    {trustScore.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        {trustScore.notes}
                      </p>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Results */}
          {differences && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <GlassCard className="p-5 hover:shadow-xl transition-all duration-300">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Detected Differences
                </h3>
                <div className="space-y-3">
                  {differences.map((diff, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`p-3 rounded-lg border-l-4 ${
                        diff.severity === "high"
                          ? "bg-red-500/10 border-red-500"
                          : diff.severity === "medium"
                          ? "bg-orange-500/10 border-orange-500"
                          : "bg-yellow-500/10 border-yellow-500"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold mb-1">
                            {diff.location}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {diff.description}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            diff.severity === "high"
                              ? "bg-red-500/20 text-red-300"
                              : diff.severity === "medium"
                              ? "bg-orange-500/20 text-orange-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {diff.severity.toUpperCase()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </div>
      </div>
    </ClickSpark>
  );
}
