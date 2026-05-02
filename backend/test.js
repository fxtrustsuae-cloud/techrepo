const http = require('http');

require('dotenv').config();

const { User } = require('./app/models');
const jwt = require('jsonwebtoken');

async function run() {
    const user = await User.findOne();
    if (!user) { console.log('No user'); return; }

    const token = jwt.sign(
        { sub: user.id, tenantId: user.tenant_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    console.log('Testing as:', user.email, 'tenant:', user.tenant_id);

    const opts = {
        hostname: 'localhost', port: 5000,
        path: '/api/reports?limit=3',
        headers: { Authorization: `Bearer ${token}` }
    };
    http.get(opts, (res) => {
        let b = '';
        res.on('data', d => b += d);
        res.on('end', () => {
            const data = JSON.parse(b);
            if (data.reports && data.reports.length > 0) {
                const r = data.reports[0];
                console.log('First report fields:', Object.keys(r).join(', '));
                console.log('created_at:', r.created_at);
                console.log('status:', r.status, '| filename:', r.filename?.substring(0, 40));
            } else {
                console.log('Response:', b.substring(0, 400));
            }
        });
    }).on('error', e => console.error('HTTP error:', e.message));
}

run().catch(console.error);
