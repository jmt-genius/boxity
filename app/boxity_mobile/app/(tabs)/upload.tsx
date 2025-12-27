import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { CheckCircle, AlertCircle } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/constants/theme';
import { ipfsService } from '@/services/ipfs';
import { databaseService } from '@/services/database';
import * as Haptics from 'expo-haptics';

export default function UploadScreen() {
  const { currentBatch, capturedImages, clearCapturedImages } = useApp();
  const { user } = useAuth();
  
  const [firstViewIpfs, setFirstViewIpfs] = useState('');
  const [secondViewIpfs, setSecondViewIpfs] = useState('');
  const [batchId, setBatchId] = useState('');
  
  const [isUploadingFirst, setIsUploadingFirst] = useState(false);
  const [isUploadingSecond, setIsUploadingSecond] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentBatch) {
      setBatchId(currentBatch.batchId);
    }
  }, [currentBatch]);

  const handleImageClick = async (viewType: 'first_view' | 'second_view') => {
    const image = capturedImages.find(img => img.viewType === viewType);
    if (!image) {
      Alert.alert('Error', `No ${viewType === 'first_view' ? 'first' : 'second'} view image captured`);
      return;
    }

    // If already uploaded, don't upload again
    const currentIpfs = viewType === 'first_view' ? firstViewIpfs : secondViewIpfs;
    if (currentIpfs) {
      Alert.alert('Already Uploaded', 'This image has already been uploaded to IPFS');
      return;
    }

    const setUploading = viewType === 'first_view' ? setIsUploadingFirst : setIsUploadingSecond;
    const setIpfs = viewType === 'first_view' ? setFirstViewIpfs : setSecondViewIpfs;

    try {
      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      console.log(`Uploading ${viewType} to IPFS...`);
      const ipfsUrl = await ipfsService.uploadImage(image.uri);
      
      setIpfs(ipfsUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert('Success', `${viewType === 'first_view' ? 'First' : 'Second'} view uploaded to IPFS!`);
    } catch (error) {
      console.error(`Failed to upload ${viewType}:`, error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to upload ${viewType} to IPFS`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!batchId) {
      Alert.alert('Error', 'Batch ID is required');
      return;
    }

    if (!firstViewIpfs || !secondViewIpfs) {
      Alert.alert('Error', 'Please upload both images to IPFS first');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Submit to database using Insforge SDK
      await databaseService.submitBatchImages({
        batchId,
        firstViewIpfs,
        secondViewIpfs,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        'Data submitted successfully to database!',
        [
          {
            text: 'OK',
            onPress: () => {
              clearCapturedImages();
              router.push('/(tabs)/history');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Submit failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to submit data to database'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstViewImage = capturedImages.find(img => img.viewType === 'first_view');
  const secondViewImage = capturedImages.find(img => img.viewType === 'second_view');

  if (!currentBatch || capturedImages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text style={styles.errorTitle}>No Images to Upload</Text>
          <Text style={styles.errorText}>
            Please capture images first
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/capture')}
          >
            <Text style={styles.buttonText}>Go to Capture</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload to IPFS</Text>
          <Text style={styles.headerSubtitle}>
            Upload images and submit to database
          </Text>
        </View>

        {/* Batch ID Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Batch ID *</Text>
          <TextInput
            style={styles.input}
            value={batchId}
            onChangeText={setBatchId}
            placeholder="Enter batch ID"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* First View Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>First View</Text>
          
          {firstViewImage && (
            <TouchableOpacity
              style={styles.imageCard}
              onPress={() => handleImageClick('first_view')}
              disabled={isUploadingFirst || !!firstViewIpfs}
              activeOpacity={0.8}
            >
              {isUploadingFirst && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.uploadingText}>Uploading to IPFS...</Text>
                </View>
              )}
              {firstViewIpfs && (
                <View style={styles.uploadedBadge}>
                  <CheckCircle size={24} color={theme.colors.success} />
                  <Text style={styles.uploadedText}>Uploaded</Text>
                </View>
              )}
              <Image 
                source={{ uri: firstViewImage.uri }} 
                style={styles.image} 
                contentFit="cover" 
              />
            </TouchableOpacity>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>IPFS URL</Text>
            <TextInput
              style={[styles.input, styles.ipfsInput]}
              value={firstViewIpfs}
              onChangeText={setFirstViewIpfs}
              placeholder="Click image to upload and get IPFS URL"
              placeholderTextColor={theme.colors.textTertiary}
              editable={false}
              multiline
            />
          </View>
        </View>

        {/* Second View Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Second View</Text>
          
          {secondViewImage && (
            <TouchableOpacity
              style={styles.imageCard}
              onPress={() => handleImageClick('second_view')}
              disabled={isUploadingSecond || !!secondViewIpfs}
              activeOpacity={0.8}
            >
              {isUploadingSecond && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.uploadingText}>Uploading to IPFS...</Text>
                </View>
              )}
              {secondViewIpfs && (
                <View style={styles.uploadedBadge}>
                  <CheckCircle size={24} color={theme.colors.success} />
                  <Text style={styles.uploadedText}>Uploaded</Text>
                </View>
              )}
              <Image 
                source={{ uri: secondViewImage.uri }} 
                style={styles.image} 
                contentFit="cover" 
              />
            </TouchableOpacity>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>IPFS URL</Text>
            <TextInput
              style={[styles.input, styles.ipfsInput]}
              value={secondViewIpfs}
              onChangeText={setSecondViewIpfs}
              placeholder="Click image to upload and get IPFS URL"
              placeholderTextColor={theme.colors.textTertiary}
              editable={false}
              multiline
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!batchId || !firstViewIpfs || !secondViewIpfs || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!batchId || !firstViewIpfs || !secondViewIpfs || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color={theme.colors.background} size="small" />
              <Text style={styles.submitButtonText}>Submitting...</Text>
            </>
          ) : (
            <>
              <CheckCircle size={24} color={theme.colors.background} />
              <Text style={styles.submitButtonText}>Submit to Database</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Click on images to upload to IPFS. Submit button will upload batch ID and both IPFS URLs to database.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
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
    textAlign: 'center',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600' as const,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600' as const,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ipfsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  imageCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    position: 'relative',
    minHeight: 200,
  },
  image: {
    width: '100%',
    height: 200,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    gap: theme.spacing.sm,
  },
  uploadingText: {
    color: theme.colors.background,
    fontSize: theme.fontSize.sm,
    fontWeight: '600' as const,
  },
  uploadedBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    zIndex: 1,
  },
  uploadedText: {
    color: theme.colors.success,
    fontSize: theme.fontSize.sm,
    fontWeight: '600' as const,
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
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold' as const,
    color: theme.colors.background,
  },
  infoCard: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.lg,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
