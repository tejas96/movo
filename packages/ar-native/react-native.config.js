/** Autolinking hints. iOS comes from MovoArNative.podspec, Android from android/ (package com.movo.ar). */
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.movo.ar.MovoArPackage;',
        packageInstance: 'new MovoArPackage()',
      },
    },
  },
};
