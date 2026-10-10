import { Link } from 'expo-router';
import { CircleCheck, Database, TriangleAlert } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Notice } from '@/components/notice';
import { useDatasetStatus } from '@/contexts/dataset-status-context';
import { colors, spacing } from '@/theme';

export function DatasetStatusNotice() {
  const { status, error } = useDatasetStatus();
  if (!status) {
    return (
      <View style={{ paddingVertical: spacing.xs }}>
        <ActivityIndicator color={colors.forest} size="small" />
      </View>
    );
  }

  if (status.state === 'missing') {
    return (
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button">
          <Notice
            title="Place dataset not installed"
            detail="Search needs the official compact dataset. Import it in Settings."
            tone="warning"
            icon={Database}
          />
        </Pressable>
      </Link>
    );
  }

  if (status.state === 'invalid' || error) {
    const detail = status.state === 'invalid' ? status.message : error;
    return (
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button">
          <Notice
            title="Place dataset needs attention"
            detail={detail ?? 'Database could not be read.'}
            tone="danger"
            icon={TriangleAlert}
          />
        </Pressable>
      </Link>
    );
  }

  return (
    <Notice
      title={`${status.metadata.recordCount.toLocaleString()} places ready offline`}
      detail={`Dataset ${status.metadata.datasetVersion} · installed ${new Date(status.installedAt).toLocaleDateString()}`}
      tone="success"
      icon={CircleCheck}
    />
  );
}