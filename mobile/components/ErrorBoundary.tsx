import React from 'react';
import { View, Text, Button } from 'react-native';

export class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error(error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{ flex: 1, padding: 32, justifyContent: 'center', gap: 16 }}>
      <Text accessibilityRole="alert">화면을 표시하지 못했어요. 다시 시도해 주세요.</Text>
      <Button title="다시 시도" onPress={() => this.setState({ failed: false })} />
    </View>;
  }
}
