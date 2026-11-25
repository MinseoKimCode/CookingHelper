import React from 'react';
import { Image, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, ui } from '../theme';

export function SectionCover({title, detail, image, icon}: {
  title: string; detail: string; image?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return <View style={ui.masthead}>
    <View style={ui.mastheadCopy}><Text accessibilityRole="header" style={ui.title}>{title}</Text><Text style={ui.muted}>{detail}</Text></View>
    {image ? <Image accessible={false} source={require('../../src/main/resources/static/recipe-images/tomato-egg-ai.jpg')} resizeMode="cover" style={{width:'31%',maxWidth:240,height:96}}/> :
      <View style={{width:72,alignItems:'center',justifyContent:'center',backgroundColor:colors.light}}><Ionicons name={icon} size={32} color={colors.green}/></View>}
  </View>;
}
