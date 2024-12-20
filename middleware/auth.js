const jwt                   = require('jsonwebtoken');
const users                 = require('../models/user.model')

require('dotenv').config();

exports.authenticateToken = async (req, res, next) => {
    const header = req.headers['authorization'];
    const token = header?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            alert : { message: 'Unauthorized', variant: 'danger', type: 0 }
        });
    }
  
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.token = decoded;

        next();
    } catch (error) {
        return res.status(403).json({
            alert : { message: 'Session Expired', variant: 'danger', type: 0 }
        });
    }
}

exports.adminAccess = async (req, res, next) => {
    const role = req.token.role

    try {
        if (role !== 'Admin') { throw new Error('Unauthorized'); }

        next()
    } catch (error) {
        return res.status(401).json({
            alert : { message: error.message, variant: 'danger', type: 0 }
        });
    }
}

exports.userRequired = async (req, res, next) => {
    const id = req.token.id

    try {
        if(!id) { throw new Error('User not found') }

        const user = await users.findById(id).populate('profile_id').populate('settings_id')

        if (!user) { throw new Error('User not found') }

        req.token.user = user;
        
        next()
    } catch (error) {
        return res.status(401).json({
            alert : { message: error.message, variant: 'danger', type: 0 }
        });
    }
}

exports.allowCors = (fn) => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    return await fn(req, res)
}
