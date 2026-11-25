import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, ui } from '../theme';
import { assetUrl } from '../services/api';
import { cuisineOptions, levelLabels, missingCount, type Recipe } from '../types';
import { useApp } from '../state/AppProvider';

export function RecipeCard({ recipe, saved, onOpen, onSave }: { recipe: Recipe; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const needed = missingCount(recipe);
  const { tutorial } = useApp();
  return <View style={[ui.card, { padding: 14, borderColor: tutorial?.id === 'recipe' ? colors.green : colors.line }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${recipe.name} 레시피 보기`} onPress={onOpen} style={{ gap: 10 }}>
      {recipe.photo ? <Image source={{ uri: assetUrl(recipe.photo.url) }} style={{ width: "100%", height: 156, borderRadius: 8, backgroundColor: colors.light }} /> :
        <View style={{ width: "100%", height: 74, borderRadius: 13, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="restaurant-outline" size={28} color={colors.green} /></View>}
      <View style={{ flex: 1, gap: 5 }}><Text style={ui.heading}>{recipe.name}</Text>
        <Text style={ui.muted}>{cuisineOptions.find(c => c.value === recipe.cuisine)?.label} · {recipe.time}분 · {levelLabels[recipe.level]} · {recipe.servings}인분</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: needed ? colors.amber : colors.green }}>{needed ? `재료·양념 ${needed}개 필요` : '바로 조리 가능'}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${recipe.name} ${saved ? '저장 취소' : '저장'}`} accessibilityState={{ selected: saved }} onPress={onSave} hitSlop={6} style={tutorial?.id === 'save' && !saved ? { borderWidth: 2, borderColor: colors.green, padding: 9, borderRadius: 12, backgroundColor: colors.light } : {position:"absolute",right:20,top:20,padding:8,backgroundColor:colors.surface,borderRadius:18}}>
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={colors.green} /></Pressable>
  </View>;
}
