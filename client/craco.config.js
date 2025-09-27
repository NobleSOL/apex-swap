const path = require("path");

function recursivelyUpdateSourceMapLoader(rules) {
  if (!Array.isArray(rules)) return;
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    if (rule.loader && rule.loader.includes("source-map-loader")) {
      const excludes = [/@keetanetwork[\\/]/, /keetanet-client[\\/]/];
      if (Array.isArray(rule.exclude)) {
        rule.exclude.push(...excludes);
      } else if (rule.exclude) {
        rule.exclude = [rule.exclude, ...excludes];
      } else {
        rule.exclude = excludes;
      }
    }
    if (rule.oneOf) recursivelyUpdateSourceMapLoader(rule.oneOf);
    if (rule.rules) recursivelyUpdateSourceMapLoader(rule.rules);
    if (rule.use) recursivelyUpdateSourceMapLoader(Array.isArray(rule.use) ? rule.use : [rule.use]);
  }
}

module.exports = {
  webpack: {
    configure: (config) => {
      if (config && config.module && Array.isArray(config.module.rules)) {
        recursivelyUpdateSourceMapLoader(config.module.rules);
      }
      return config;
    },
  },
};
