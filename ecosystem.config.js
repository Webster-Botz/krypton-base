module.exports = {
  apps: [
    {
      name: "Binx Bot",
      script: "./src/krypton.js",
      instances: "1",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
