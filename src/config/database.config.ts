export default () => ({
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!, 10) || 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    name: process.env.DB_NAME,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
});
