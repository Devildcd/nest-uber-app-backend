export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
});
