// next.config.js
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.wgsl$/,
      use: "raw-loader",
    });

    // Add rule to handle images
    config.module.rules.push({
      test: /\.(png|jpg|jpeg|gif|svg)$/i,
      type: "asset/resource", // Use Webpack's built-in asset module
    });

    return config;
  },
};

module.exports = nextConfig;
