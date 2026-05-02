const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('./logger');

const dialect = process.env.DB_DIALECT || 'sqlite';

let sequelize;

if (dialect === 'sqlite') {
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../techanalysis.sqlite');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: (msg) => logger.debug(msg),
        define: {
            timestamps: true,
            underscored: true,
        },
    });
    logger.info(`📂 Using SQLite database: ${dbPath}`);
} else {
    // PostgreSQL for production
    sequelize = new Sequelize(
        process.env.DB_NAME || 'techanalysis_db',
        process.env.DB_USER || 'postgres',
        process.env.DB_PASSWORD || 'postgres',
        {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            dialect: 'postgres',
            logging: (msg) => logger.debug(msg),
            pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
            define: { timestamps: true, underscored: true },
        }
    );
    logger.info(`🐘 Using PostgreSQL database: ${process.env.DB_HOST}/${process.env.DB_NAME}`);
}

module.exports = { sequelize, Sequelize };
