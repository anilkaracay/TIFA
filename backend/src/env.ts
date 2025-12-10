import 'dotenv/config';

export const env = {
    PORT: Number(process.env.PORT ?? 4000),
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db'
};
