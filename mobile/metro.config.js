const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (process.env.NODE_ENV === "production") {
    if (
      moduleName.endsWith("dev-quick-login") ||
      moduleName.endsWith("dev-quick-login.tsx")
    ) {
      return {
        filePath: path.resolve(__dirname, "src/components/dev-quick-login.prod.tsx"),
        type: "sourceFile",
      };
    }
  }
  if (defaultResolve) {
    return defaultResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
