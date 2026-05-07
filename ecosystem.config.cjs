module.exports = {
  apps: [
    {
      name: "vietutor-studio",
      cwd: "/var/www/VietTutor-Studio",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
