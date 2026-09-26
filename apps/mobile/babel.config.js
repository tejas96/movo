module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    // zod 4 ships `export * as ns from` in its ESM build
    '@babel/plugin-transform-export-namespace-from',
    // worklets must stay last
    'react-native-worklets/plugin',
  ],
};
