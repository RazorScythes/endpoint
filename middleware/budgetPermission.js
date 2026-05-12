const BudgetShare = require('../models/budgetShare.model')

const budgetPermission = async (req, res, next) => {
    const currentUserId = req.token.id
    const budgetOwnerId = req.query.budgetOwnerId || req.body.budgetOwnerId

    if (!budgetOwnerId || budgetOwnerId === currentUserId) {
        req.budgetUserId = currentUserId
        req.budgetRole = 'owner'
        return next()
    }

    try {
        const share = await BudgetShare.findOne({ owner: budgetOwnerId, sharedWith: currentUserId }).lean()

        if (!share) {
            return res.status(403).json({ alert: { variant: 'danger', message: 'You do not have access to this budget' } })
        }

        const method = req.method.toUpperCase()
        if (share.role === 'viewer' && method !== 'GET') {
            return res.status(403).json({ alert: { variant: 'danger', message: 'You have view-only access to this budget' } })
        }

        req.budgetUserId = budgetOwnerId
        req.budgetRole = share.role
        return next()
    } catch (err) {
        console.log('budgetPermission error:', err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

module.exports = { budgetPermission }
