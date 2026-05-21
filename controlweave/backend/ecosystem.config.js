module.exports = {
  apps: [{
    name: 'controlweaver',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
