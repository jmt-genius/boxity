import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Clock, CheckCircle, Package, AlertCircle } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { theme } from '@/constants/theme';
import { databaseService } from '@/services/database';

interface BatchRecord {
  id: string;
  batch_id: string;
  first_view_ipfs: string;
  second_view_ipfs: string;
  created_at: string;
  approved: boolean;
}

export default function HistoryScreen() {
  const { uploads } = useApp();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBatches = async () => {
    try {
      setError(null);
      const data = await databaseService.getAllBatches();
      setBatches(data);
    } catch (err: any) {
      console.error('Failed to load batches:', err);
      setError(err.message || 'Failed to load batches from database');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadBatches();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading batches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Error Loading Batches</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBatches}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Batch History</Text>
        <Text style={styles.headerSubtitle}>
          {batches.length} total batch{batches.length !== 1 ? 'es' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {batches.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color={theme.colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Batches Yet</Text>
            <Text style={styles.emptyText}>
              Your batch history will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {batches.map((batch) => (
              <TouchableOpacity key={batch.id} style={styles.uploadCard}>
                <View style={styles.uploadHeader}>
                  <View style={styles.uploadIcon}>
                    <Package size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.uploadInfo}>
                    <Text style={styles.uploadBatchId}>{batch.batch_id}</Text>
                    <Text style={styles.uploadProduct}>
                      Created {new Date(batch.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      batch.approved ? styles.status_synced : styles.status_pending,
                    ]}
                  >
                    {batch.approved && (
                      <CheckCircle size={12} color={theme.colors.background} />
                    )}
                    <Text style={styles.statusText}>
                      {batch.approved ? 'Approved' : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={styles.uploadDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created At</Text>
                    <Text style={styles.detailValue}>
                      {new Date(batch.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>
                      {batch.approved ? 'Approved' : 'Pending Approval'}
                    </Text>
                  </View>
                </View>

                <View style={styles.imagesContainer}>
                  <View style={styles.imageSection}>
                    <Text style={styles.imageLabel}>First View</Text>
                    <Image
                      source={{ uri: batch.first_view_ipfs }}
                      style={styles.previewImage}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.imageSection}>
                    <Text style={styles.imageLabel}>Second View</Text>
                    <Image
                      source={{ uri: batch.second_view_ipfs }}
                      style={styles.previewImage}
                      contentFit="cover"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  errorTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold' as const,
    color: theme.colors.text,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  retryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600' as const,
    color: theme.colors.background,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl * 2,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold' as const,
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: theme.spacing.md,
  },
  uploadCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  uploadBatchId: {
    fontSize: theme.fontSize.md,
    fontWeight: '600' as const,
    color: theme.colors.text,
  },
  uploadProduct: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  status_uploaded: {
    backgroundColor: theme.colors.primary,
  },
  status_pending: {
    backgroundColor: theme.colors.warning,
  },
  status_synced: {
    backgroundColor: theme.colors.success,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600' as const,
    color: theme.colors.background,
  },
  uploadDetails: {
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500' as const,
    color: theme.colors.text,
  },
  imagesContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  imageSection: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  imageLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600' as const,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase' as const,
  },
  ipfsPreview: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
  },
  previewImage: {
    width: '100%',
    height: 120,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
  },
});
