const fs = require('fs');
const file = 'D:/AI Projects/Technical report/backend/app/middleware/auth.js';
let content = fs.readFileSync(file, 'utf8');

const prefix = `const jwt = require('jsonwebtoken');
const { User } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

`;

content = content.replace("const jwt = require('jsonwebtoken');\n", '');
content = content.replace("const jwt = require('jsonwebtoken');\r\n", '');
fs.writeFileSync(file, prefix + content);
