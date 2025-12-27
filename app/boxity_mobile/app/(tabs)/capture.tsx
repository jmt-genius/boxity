import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { ttsService } from '@/services/tts';

type ViewType = 'first_view' | 'second_view';
type VoiceFeedback = 'move_closer' | 'move_farther' | 'align_box' | 'hold_steady' | 'rotate_box' | 'ready';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { currentBatch, capturedImages, addCapturedImage, removeCapturedImage } = useApp();
  const cameraRef = useRef<CameraView>(null);
  const [isAligned, setIsAligned] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [currentFeedback, setCurrentFeedback] = useState<VoiceFeedback>('align_box');
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const alignmentPulse = useRef(new Animated.Value(1)).current;
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    ttsService.initialize();

    return () => {
      ttsService.cleanup();
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const performDetection = useCallback(() => {
    frameCountRef.current++;
    
    const variation = Math.random();
    let newConfidence = 0;
    let newFeedback: VoiceFeedback = 'align_box';
    let aligned = false;

    if (variation < 0.25) {
      newConfidence = Math.floor(Math.random() * 40 + 10);
      newFeedback = Math.random() > 0.5 ? 'move_closer' : 'align_box';
      aligned = false;
    } else if (variation < 0.45) {
      newConfidence = Math.floor(Math.random() * 25 + 50);
      newFeedback = Math.random() > 0.5 ? 'rotate_box' : 'move_farther';
      aligned = false;
    } else if (variation < 0.65) {
      newConfidence = Math.floor(Math.random() * 10 + 75);
      newFeedback = 'hold_steady';
      aligned = false;
    } else {
      newConfidence = Math.floor(Math.random() * 15 + 85);
      newFeedback = 'ready';
      aligned = newConfidence >= 85;
    }

    setConfidence(newConfidence);
    setIsAligned(aligned);

    if (currentFeedback !== newFeedback) {
      setCurrentFeedback(newFeedback);
      ttsService.playFeedback(newFeedback);
    }
  }, [currentFeedback]);

  useEffect(() => {
    const startLoop = () => {
      detectionIntervalRef.current = setInterval(() => {
        performDetection();
      }, 500);
    };

    startLoop();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [performDetection]);

  useEffect(() => {
    if (isAligned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(alignmentPulse, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(alignmentPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      alignmentPulse.setValue(1);
    }
  }, [isAligned, alignmentPulse]);

  const hasFirstView = capturedImages.some((img) => img.viewType === 'first_view');
  const hasSecondView = capturedImages.some((img) => img.viewType === 'second_view');

  const currentViewType: ViewType = !hasFirstView ? 'first_view' : 'second_view';

  const handleCapture = async () => {
    if (!isAligned && !showManualOverride) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowManualOverride(true);
      return;
    }

    if (isProcessing) return;

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.9,
      });

      if (photo) {
        console.log('Captured image:', photo.uri);
        addCapturedImage({
          uri: photo.uri,
          viewType: currentViewType,
          timestamp: new Date().toISOString(),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (hasFirstView && currentViewType === 'second_view') {
          await new Promise(resolve => setTimeout(resolve, 500));
          router.push('/(tabs)/upload');
        }
      }
    } catch (error) {
      console.error('Failed to capture image:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
      setShowManualOverride(false);
    }
  };

  const handleRetake = (viewType: ViewType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeCapturedImage(viewType);
  };

  const handleManualCapture = () => {
    setShowManualOverride(false);
    handleCapture();
  };

  if (!currentBatch) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text style={styles.errorTitle}>No Active Batch</Text>
          <Text style={styles.errorText}>
            Please scan a QR code first
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <Text style={styles.buttonText}>Go to Scan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text style={styles.errorTitle}>Camera Access Required</Text>
          <Text style={styles.errorText}>
            Please grant camera permission to capture images
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Capture Images</Text>
        <Text style={styles.headerSubtitle}>
          Batch: {currentBatch.batchId}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressItem}>
          {hasFirstView ? (
            <CheckCircle size={20} color={theme.colors.success} />
          ) : (
            <View style={styles.progressDot} />
          )}
          <Text style={[styles.progressText, hasFirstView && styles.progressTextActive]}>
            First View
          </Text>
        </View>
        <View style={styles.progressLine} />
        <View style={styles.progressItem}>
          {hasSecondView ? (
            <CheckCircle size={20} color={theme.colors.success} />
          ) : (
            <View style={styles.progressDot} />
          )}
          <Text style={[styles.progressText, hasSecondView && styles.progressTextActive]}>
            Second View
          </Text>
        </View>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.overlay}>
            <Animated.View
              style={[
                styles.alignmentBox,
                {
                  borderColor: isAligned ? theme.colors.success : theme.colors.error,
                  transform: [{ scale: isAligned ? alignmentPulse : 1 }],
                },
              ]}
            >
              <View style={[styles.corner, styles.cornerTopLeft, { borderColor: isAligned ? theme.colors.success : theme.colors.error }]} />
              <View style={[styles.corner, styles.cornerTopRight, { borderColor: isAligned ? theme.colors.success : theme.colors.error }]} />
              <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: isAligned ? theme.colors.success : theme.colors.error }]} />
              <View style={[styles.corner, styles.cornerBottomRight, { borderColor: isAligned ? theme.colors.success : theme.colors.error }]} />
            </Animated.View>
            
            <View style={styles.alignmentIndicator}>
              {isAligned ? (
                <>
                  <CheckCircle size={24} color={theme.colors.success} />
                  <Text style={[styles.alignmentText, { color: theme.colors.success }]}>
                    Ready to Capture
                  </Text>
                </>
              ) : (
                <>
                  <XCircle size={24} color={theme.colors.error} />
                  <Text style={[styles.alignmentText, { color: theme.colors.error }]}>
                    {currentFeedback === 'move_closer' && 'Move Closer'}
                    {currentFeedback === 'move_farther' && 'Move Farther'}
                    {currentFeedback === 'align_box' && 'Align Box'}
                    {currentFeedback === 'hold_steady' && 'Hold Steady'}
                    {currentFeedback === 'rotate_box' && 'Rotate Box'}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{confidence}%</Text>
            </View>
          </View>
        </CameraView>
      </View>

      <View style={styles.controls}>
        {hasFirstView && (
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => handleRetake('first_view')}
          >
            <Text style={styles.retakeButtonText}>Retake First</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.captureButton,
            (!isAligned && !isProcessing) && styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <Camera size={32} color={theme.colors.background} />
          )}
        </TouchableOpacity>

        {hasSecondView && (
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => handleRetake('second_view')}
          >
            <Text style={styles.retakeButtonText}>Retake Second</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showManualOverride}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualOverride(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AlertTriangle size={48} color={theme.colors.warning} />
            <Text style={styles.modalTitle}>Low Alignment Confidence</Text>
            <Text style={styles.modalText}>
              The box is not properly aligned. This may affect image quality and AI analysis.
            </Text>
            <Text style={styles.modalTextSecondary}>
              Current confidence: {confidence}%
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowManualOverride(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Keep Aligning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleManualCapture}
              >
                <Text style={styles.modalButtonPrimaryText}>Capture Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold' as const,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  progressText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  progressTextActive: {
    color: theme.colors.success,
    fontWeight: '600' as const,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: theme.colors.border,
  },
  cameraContainer: {
    flex: 1,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alignmentBox: {
    width: 300,
    height: 220,
    borderWidth: 3,
    borderRadius: theme.borderRadius.md,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  alignmentIndicator: {
    position: 'absolute',
    top: theme.spacing.xxl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  alignmentText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600' as const,
  },
  confidenceBadge: {
    position: 'absolute',
    bottom: theme.spacing.xxl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  confidenceText: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold' as const,
    color: theme.colors.text,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  captureButtonDisabled: {
    opacity: 0.4,
  },
  retakeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  retakeButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600' as const,
    color: theme.colors.text,
  },
  errorTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold' as const,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  buttonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600' as const,
    color: theme.colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold' as const,
    color: theme.colors.text,
  },
  modalText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  modalTextSecondary: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
    fontWeight: '600' as const,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: '100%',
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonSecondaryText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600' as const,
    color: theme.colors.text,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600' as const,
    color: theme.colors.background,
  },
});
