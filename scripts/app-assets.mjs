import sharp from 'sharp';

const background = '#F6F8EF';
await sharp('assets/app/wordmark.svg').resize(1080, 480).png().toFile('assets/app/wordmark.png');
await sharp('assets/app/icon.svg').flatten({ background }).png().toFile('assets/app/icon.png');
await sharp('assets/app/icon.svg')
  .resize(512)
  .flatten({ background })
  .png()
  .toFile('assets/app/splash.png');
await sharp('assets/app/icon.svg')
  .resize(432, 432)
  .flatten({ background })
  .extend({ top: 216, bottom: 216, left: 216, right: 216, background })
  .png()
  .toFile('assets/app/adaptive-icon.png');
