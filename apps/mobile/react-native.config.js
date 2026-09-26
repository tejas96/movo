module.exports = {
  project: {
    ios: {},
    android: {},
  },
  // Fonts are already wired: iOS has the Poppins files in the Xcode project and Info.plist (done once
  // with react-native-asset and committed); Android uses res/font/poppins.xml registered in
  // MainApplication.kt so `fontFamily: 'Poppins'` + fontWeight resolves to the right face.
  // Keep this empty so a stray `react-native-asset` run does not add duplicate Android copies.
  assets: [],
  dependencies: {},
};
