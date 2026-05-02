const logger = require('../core/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(err.message, { stack: err.stack, url: req.url, method: req.method });

    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.errors.map(e => e.message),
        });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Resource already exists' });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
