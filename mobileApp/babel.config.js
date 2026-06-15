module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: jsxImportSource is all that's needed here.
      // Do NOT add "nativewind/babel" as a separate preset — it causes conflicts.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // Required for Expo Router to resolve the app/ directory in standalone/EAS builds.
      "expo-router/babel",
      // react-native-reanimated MUST be the last plugin.
      "react-native-reanimated/plugin",
    ],
  };
};