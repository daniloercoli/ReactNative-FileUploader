// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          // enables: import X from '@/src/...'
          '@/src': './src',
        },
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      },
    ],
    'react-native-worklets/plugin', // MUST be last (Reanimated 4)
  ],
};
