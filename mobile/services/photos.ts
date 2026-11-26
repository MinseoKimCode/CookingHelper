import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

export async function pickPhoto(camera = false, maxBytes = 5 * 1024 * 1024) {
  if (Platform.OS !== 'web') {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      throw new Error(`${camera ? '카메라' : '사진'} 접근 권한을 설정에서 허용해주세요.`);
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: false,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1440)
    context.resize(asset.width >= asset.height ? { width: 1440 } : { height: 1440 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.78, base64: true });
  if (!image.base64 || (image.base64.length * 3) / 4 > maxBytes)
    throw new Error('사진 용량이 커요. 더 작은 사진을 선택해주세요.');
  return `data:image/jpeg;base64,${image.base64}`;
}
