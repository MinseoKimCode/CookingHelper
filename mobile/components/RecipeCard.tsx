import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, ui } from '../theme';
import { assetUrl } from '../services/api';
import { compactCount } from '../recipeTools';
import { cuisineOptions, missingCount, type Recipe } from '../types';
import { useApp } from '../state/AppProvider';

/** Photo card for carousels and grids. `list` renders the same recipe as a compact row. */
export function RecipeCard({
  recipe,
  saved,
  onOpen,
  onSave,
  width,
  list = false,
}: {
  recipe: Recipe;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  width?: number;
  list?: boolean;
}) {
  const needed = missingCount(recipe);
  const { tutorial, views } = useApp();
  const count = views[recipe.id] || recipe.video?.views || 0;
  const meta = [
    `${recipe.time}분`,
    cuisineOptions.find((c) => c.value === recipe.cuisine)?.label,
    recipe.calories ? `${recipe.calories}kcal` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const status = needed ? `재료 ${needed}개 더 필요` : '지금 바로 만들 수 있어요';
  const image = recipe.photo ? assetUrl(recipe.photo.url) : undefined;
  const save = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name} ${saved ? '저장 취소' : '저장'}`}
      accessibilityState={{ selected: saved }}
      onPress={onSave}
      hitSlop={10}
      style={[
        { padding: 6 },
        tutorial?.id === 'save' &&
          !saved && { borderWidth: 2, borderColor: colors.green, borderRadius: 16 },
      ]}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={20}
        color={saved ? colors.green : colors.muted}
      />
    </Pressable>
  );
  if (list)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recipe.name} 레시피 보기`}
        onPress={onOpen}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: pressed ? colors.fill : 'transparent',
          borderWidth: tutorial?.id === 'recipe' ? 2 : 0,
          borderColor: colors.green,
        })}
      >
        <View>
          <Image
            source={{ uri: image }}
            style={{ width: 76, height: 76, borderRadius: 14, backgroundColor: colors.fill }}
          />
          {!!recipe.video && (
            <View
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                backgroundColor: 'rgba(0,0,0,.7)',
                borderRadius: 6,
                padding: 2,
              }}
            >
              <Ionicons name="logo-youtube" size={12} color="white" />
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={[ui.label, { fontSize: 16 }]} numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
            {meta}
            {count ? ` · 조회 ${compactCount(count)}` : ''}
          </Text>
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: needed ? colors.amber : colors.green }}
            numberOfLines={1}
          >
            {status}
          </Text>
        </View>
        {save}
      </Pressable>
    );
  return (
    <View style={{ width, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recipe.name} 레시피 보기`}
        onPress={onOpen}
        style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.85 : 1 })}
      >
        <View
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.fill,
            borderWidth: tutorial?.id === 'recipe' ? 2 : 0,
            borderColor: colors.green,
          }}
        >
          <Image
            source={{ uri: image }}
            style={{ width: '100%', aspectRatio: 4 / 3 }}
            resizeMode="cover"
          />
          {!!recipe.video && (
            <View
              style={{
                position: 'absolute',
                left: 8,
                bottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(0,0,0,.65)',
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 3,
              }}
            >
              <Ionicons name="logo-youtube" size={12} color="white" />
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                {recipe.video.channel}
              </Text>
            </View>
          )}
        </View>
        <View style={{ gap: 2, paddingHorizontal: 2 }}>
          <Text style={[ui.label, { fontSize: 15 }]} numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
            {meta}
          </Text>
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: needed ? colors.amber : colors.green }}
            numberOfLines={1}
          >
            {status}
          </Text>
        </View>
      </Pressable>
      <View
        style={{
          position: 'absolute',
          right: 6,
          top: 6,
          backgroundColor: 'rgba(255,255,255,.9)',
          borderRadius: 16,
        }}
      >
        {save}
      </View>
    </View>
  );
}
