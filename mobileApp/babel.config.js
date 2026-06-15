module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: jsxImportSource is all that's needed here.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // expo-router/babel was deprecated in SDK 50 — babel-preset-expo handles it.
      // react-native-reanimated MUST be the last plugin.
      "react-native-reanimated/plugin",
    ],
  };
};