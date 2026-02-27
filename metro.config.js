// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);
const path = require('node:path');

const ALIASES = {
    tslib: path.resolve(__dirname, 'node_modules/tslib/tslib.es6.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
    return context.resolveRequest(context, ALIASES[moduleName] ?? moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
