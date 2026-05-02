const jwt = require('jsonwebtoken');
const { User } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';


const authenticate = async (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findOne({
            where: { id: decoded.userId, is_active: true },
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user;
        req.tenantId = user.tenant_id;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

module.exports = { authenticate, authorize, generateToken };
