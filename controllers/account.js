const ActivityLog = require('../models/activitylog.model')
const Report = require('../models/report.model')
const Users = require('../models/user.model')
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
