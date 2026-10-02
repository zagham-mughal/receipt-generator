// PM2 process definition for the production server.
// Start with `pm2 start ecosystem.config.js`; after changing this file, run
// `pm2 delete receipt-generator && pm2 start ecosystem.config.js && pm2 save`.
// Non-secret settings live here; secrets live in .env (loaded by the app itself).
module.exports = {
  apps: [{
    name: 'receipt-generator',
    script: './dist/server.js',
    cwd: __dirname,
    // Must stay 1: sessions are in memory and the DB is rebuilt on every start.
    // fork (not cluster) so startup errors reach logs/ before the process exits.
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8792,          // registered in the VPS inventory — change both together
      HOST: '127.0.0.1'    // loopback only; Nginx is the public entry point
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
