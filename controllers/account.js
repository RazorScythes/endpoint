const crypto = require('crypto')
const ActivityLog = require('../models/activitylog.model')
const Report = require('../models/report.model')
const Users = require('../models/user.model')
const Profile = require('../models/profile.model')
const { logActivity } = require('../plugins/logger')

exports.getLogs = async (req, res) => {
    const { user } = req.token
    const { page = 1, limit = 20, category, search } = req.query

    try {
        const query = { user: user._id }

        if (category && category !== 'all') {
            query.category = category
        }

        if (search) {
            query.message = { $regex: search, $options: 'i' }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'avatar username'),
            ActivityLog.countDocuments(query)
        ])

        res.status(200).json({
            result: logs,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: {
                variant: 'danger',
                message: 'internal server error'
            }
        })
    }
}

exports.clearLogs = async (req, res) => {
    const { user } = req.token

    try {
        await ActivityLog.deleteMany({ user: user._id })

        res.status(200).json({
            result: [],
            pagination: { total: 0, page: 1, limit: 20, pages: 0 },
            alert: {
                variant: 'success',
                message: 'Activity logs cleared'
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: {
                variant: 'danger',
                message: 'internal server error'
            }
        })
    }
}

exports.createReport = async (req, res) => {
    const { user } = req.token
    const { content_id, type, name, email, reason, details } = req.body

    if (!content_id || !name || !email || !details) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'All fields are required' }
        })
    }

    try {
        await Report.create({
            user: user._id,
            content_id,
            type: type || 'video',
            name,
            email,
            reason: reason || 'Other',
            details
        })

        await logActivity(req, {
            action: 'create_report',
            category: 'account',
            message: `Submitted a ${type || 'video'} report: ${reason}`,
            method: 'POST'
        })

        res.status(200).json({
            alert: { variant: 'success', message: 'Report submitted successfully' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.getReports = async (req, res) => {
    const { user } = req.token
    const { page = 1, limit = 20, type, status } = req.query

    try {
        const query = { user: user._id }

        if (type && type !== 'all') query.type = type
        if (status && status !== 'all') query.status = status

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [reports, total] = await Promise.all([
            Report.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Report.countDocuments(query)
        ])

        res.status(200).json({
            result: reports,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.updateReportStatus = async (req, res) => {
    const { user } = req.token
    const { id, status } = req.body

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed']

    if (!id || !status || !validStatuses.includes(status)) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'Invalid status' }
        })
    }

    try {
        const report = await Report.findOneAndUpdate(
            { _id: id, user: user._id },
            { status },
            { new: true }
        )

        if (!report) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Report not found' }
            })
        }

        res.status(200).json({
            result: report,
            alert: { variant: 'success', message: `Report marked as ${status}` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteReport = async (req, res) => {
    const { user } = req.token
    const { id } = req.params

    try {
        const report = await Report.findOneAndDelete({ _id: id, user: user._id })

        if (!report) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Report not found' }
            })
        }

        res.status(200).json({
            alert: { variant: 'success', message: 'Report deleted' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.toggle2FA = async (req, res) => {
    const { user } = req.token

    try {
        const fullUser = await Users.findById(user._id)
        const isEnabled = fullUser.two_factor?.enabled || false

        if (!isEnabled) {
            const secret = crypto.randomBytes(20).toString('hex')
            const backupCodes = Array.from({ length: 8 }, () =>
                crypto.randomBytes(4).toString('hex').toUpperCase()
            )

            fullUser.two_factor = { enabled: true, secret, backup_codes: backupCodes }
            await fullUser.save()

            logActivity(req, { action: 'enable_2fa', category: 'account', message: '2FA enabled' })

            return res.status(200).json({
                result: { enabled: true, backup_codes: backupCodes },
                alert: { variant: 'success', message: '2FA has been enabled. Save your backup codes.' }
            })
        }

        fullUser.two_factor = { enabled: false, secret: '', backup_codes: [] }
        await fullUser.save()

        logActivity(req, { action: 'disable_2fa', category: 'account', message: '2FA disabled' })

        res.status(200).json({
            result: { enabled: false, backup_codes: [] },
            alert: { variant: 'success', message: '2FA has been disabled' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.get2FAStatus = async (req, res) => {
    const { user } = req.token
    try {
        const fullUser = await Users.findById(user._id).select('two_factor')
        res.status(200).json({
            result: {
                enabled: fullUser.two_factor?.enabled || false,
                has_backup_codes: (fullUser.two_factor?.backup_codes?.length || 0) > 0
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.getSessions = async (req, res) => {
    const { user } = req.token
    try {
        const fullUser = await Users.findById(user._id).select('sessions')
        const sessions = (fullUser.sessions || []).map(s => ({
            _id: s._id,
            device: s.device || 'Unknown',
            ip: s.ip || 'Unknown',
            last_active: s.last_active,
            created_at: s.created_at,
        }))
        res.status(200).json({ result: sessions })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.revokeSession = async (req, res) => {
    const { user } = req.token
    const { sessionId } = req.params
    try {
        await Users.findByIdAndUpdate(user._id, { $pull: { sessions: { _id: sessionId } } })
        logActivity(req, { action: 'revoke_session', category: 'account', message: 'Session revoked' })
        const fullUser = await Users.findById(user._id).select('sessions')
        res.status(200).json({
            result: (fullUser.sessions || []).map(s => ({
                _id: s._id, device: s.device || 'Unknown', ip: s.ip || 'Unknown',
                last_active: s.last_active, created_at: s.created_at,
            })),
            alert: { variant: 'success', message: 'Session revoked' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.revokeAllSessions = async (req, res) => {
    const { user } = req.token
    try {
        await Users.findByIdAndUpdate(user._id, { sessions: [] })
        logActivity(req, { action: 'revoke_all_sessions', category: 'account', message: 'All sessions revoked' })
        res.status(200).json({
            result: [],
            alert: { variant: 'success', message: 'All sessions revoked' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.exportAccountData = async (req, res) => {
    const { user } = req.token
    try {
        const fullUser = await Users.findById(user._id)
            .select('-password -two_factor.secret -two_factor.backup_codes -sessions')
            .populate('profile_id')
            .lean()

        const logs = await ActivityLog.find({ user: user._id })
            .sort({ createdAt: -1 }).limit(500).lean()

        const reports = await Report.find({ user: user._id })
            .sort({ createdAt: -1 }).lean()

        const exportData = {
            exported_at: new Date().toISOString(),
            account: {
                username: fullUser.username,
                email: fullUser.email,
                role: fullUser.role,
                avatar: fullUser.avatar,
                created_at: fullUser.createdAt,
                verified: fullUser.verification?.verified || false,
                social_links: fullUser.social_links || {},
                notification_prefs: fullUser.notification_prefs || {},
            },
            profile: fullUser.profile_id || {},
            activity_logs: logs,
            reports,
        }

        logActivity(req, { action: 'export_data', category: 'account', message: 'Account data exported' })

        res.status(200).json({ result: exportData })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.getNotificationPrefs = async (req, res) => {
    const { user } = req.token
    try {
        const fullUser = await Users.findById(user._id).select('notification_prefs')
        res.status(200).json({
            result: fullUser.notification_prefs || {
                email_updates: true, security_alerts: true, marketing: false,
                comment_replies: true, new_followers: true,
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.updateNotificationPrefs = async (req, res) => {
    const { user } = req.token
    const updates = req.body

    try {
        const allowed = ['email_updates', 'security_alerts', 'marketing', 'comment_replies', 'new_followers']
        const filtered = {}
        for (const key of allowed) {
            if (updates[key] !== undefined) filtered[`notification_prefs.${key}`] = updates[key]
        }

        if (Object.keys(filtered).length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No valid preferences' } })
        }

        const updated = await Users.findByIdAndUpdate(user._id, { $set: filtered }, { new: true }).select('notification_prefs')

        logActivity(req, { action: 'update_notification_prefs', category: 'settings', message: 'Notification preferences updated' })

        res.status(200).json({
            result: updated.notification_prefs,
            alert: { variant: 'success', message: 'Notification preferences updated' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.getSocialLinks = async (req, res) => {
    const { user } = req.token
    try {
        const fullUser = await Users.findById(user._id).select('social_links')
        res.status(200).json({ result: fullUser.social_links || {} })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.updateSocialLinks = async (req, res) => {
    const { user } = req.token
    const updates = req.body

    try {
        const allowed = ['website', 'github', 'twitter', 'linkedin', 'youtube', 'discord']
        const filtered = {}
        for (const key of allowed) {
            if (updates[key] !== undefined) filtered[`social_links.${key}`] = String(updates[key]).slice(0, 200)
        }

        const updated = await Users.findByIdAndUpdate(user._id, { $set: filtered }, { new: true }).select('social_links')

        logActivity(req, { action: 'update_social_links', category: 'profile', message: 'Social links updated' })

        res.status(200).json({
            result: updated.social_links,
            alert: { variant: 'success', message: 'Social links updated' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.getSecurityLog = async (req, res) => {
    const { user } = req.token
    const { page = 1, limit = 20 } = req.query

    try {
        const query = {
            user: user._id,
            category: { $in: ['auth', 'account'] },
        }

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ActivityLog.countDocuments(query)
        ])

        const suspicious = logs.filter(l =>
            ['delete_account', 'change_password', 'revoke_all_sessions', 'disable_2fa'].includes(l.action)
        )

        res.status(200).json({
            result: logs,
            suspicious_count: suspicious.length,
            pagination: {
                total, page: parseInt(page), limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.getProfileCompleteness = async (req, res) => {
    const { user } = req.token
    try {
        const fullUser = await Users.findById(user._id).populate('profile_id').lean()
        const profile = fullUser.profile_id || {}

        const fields = [
            { name: 'Avatar', done: !!fullUser.avatar },
            { name: 'First Name', done: !!profile.first_name },
            { name: 'Last Name', done: !!profile.last_name },
            { name: 'Bio', done: !!profile.bio },
            { name: 'Birthday', done: !!profile.birthday },
            { name: 'Gender', done: !!profile.gender },
            { name: 'Contact', done: !!profile.contact_number },
            { name: 'Address', done: !!profile.address },
            { name: 'Email Verified', done: !!fullUser.verification?.verified },
            { name: 'Social Links', done: Object.values(fullUser.social_links || {}).some(v => !!v) },
        ]

        const completed = fields.filter(f => f.done).length
        const percentage = Math.round((completed / fields.length) * 100)

        res.status(200).json({
            result: { fields, completed, total: fields.length, percentage }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}
