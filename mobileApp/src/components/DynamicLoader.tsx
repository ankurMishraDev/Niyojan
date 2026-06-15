import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

type DynamicLoaderProps = {
  currentStage?: string;
  stages: string[];
  label?: string;
};

/**
 * DynamicLoader — pipeline-stage stepper for mobile AI operations.
 * Renders a horizontal list of stages highlighting the active one.
 * Used by surveys/new.tsx, forms/builder.tsx.
 */
export function DynamicLoader({ currentStage, stages, label = 'Processing...' }: DynamicLoaderProps) {
  const currentIndex = currentStage
    ? stages.findIndex((s) => s.toLowerCase() === currentStage.toLowerCase())
    : -1;
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <View className="flex-1 items-center justify-center p-6 bg-canvas-soft-2">
      {/* Spinner */}
      <View className="mb-6">
        <ActivityIndicator size="large" color="#171717" />
      </View>

      {/* Label */}
      <Text className="text-lg font-semibold text-ink mb-2 text-center">{label}</Text>
      <Text className="text-sm text-mute mb-8 text-center">
        Please wait while we process the data through our AI pipeline.
      </Text>

      {/* Stage stepper */}
      <View className="w-full max-w-sm">
        {/* Progress line background */}
        <View className="flex-row items-center justify-between relative mb-6">
          {/* Track */}
          <View className="absolute left-0 right-0 top-3 h-1 bg-hairline rounded-full" />
          {/* Active track */}
          {stages.length > 1 && (
            <View
              className="absolute left-0 top-3 h-1 bg-ink rounded-full"
              style={{ width: `${(activeIndex / (stages.length - 1)) * 100}%` }}
            />
          )}

          {stages.map((stage, i) => (
            <View key={stage} className="items-center z-10">
              {/* Dot */}
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  i < activeIndex
                    ? 'bg-ink'
                    : i === activeIndex
                    ? 'bg-ink ring-4 ring-ink/20'
                    : 'bg-canvas border-2 border-hairline'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    i <= activeIndex ? 'text-white' : 'text-mute'
                  }`}
                >
                  {i < activeIndex ? '✓' : `${i + 1}`}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Stage labels below dots */}
        <View className="flex-row justify-between">
          {stages.map((stage, i) => (
            <View key={stage} className="items-center" style={{ flex: 1 }}>
              <Text
                className={`text-xs text-center ${i <= activeIndex ? 'text-ink font-medium' : 'text-mute'}`}
                numberOfLines={1}
              >
                {stage}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Skeleton placeholder rows */}
      <View className="w-full max-w-sm mt-8 space-y-3">
        {[0, 1, 2].map((row) => (
          <View key={row} className="h-10 bg-canvas rounded-md opacity-40" />
        ))}
      </View>
    </View>
  );
}
