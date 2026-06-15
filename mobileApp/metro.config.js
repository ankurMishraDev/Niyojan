const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ensure SQLite .db files are bundled into the APK for expo-sqlite.
// Without this, standalone builds may fail to locate the database asset.
config.resolver.assetExts.push("db");

module.exports = withNativeWind(config, { input: "./global.css" });