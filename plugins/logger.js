const ActivityLog = require('../models/activitylog.model')

const logActivity = async (req, { action, category, message, method }) => {
    try {
        const userId = req.token?.id || req.token?.user?._id

        if (!userId) return

        await ActivityLog.create({
            user: userId,
            action,
            category: category || 'account',
            message,
            method: method || req.method,
            ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent']
        })
    } catch (error) {
        console.log('Activity log error:', error.message)
    }
}

module.exports = { logActivity }
