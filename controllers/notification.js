const Notification = require('../models/notification.model')
const Users = require('../models/user.model')

exports.getNotifications = async (req, res) => {
    const { user } = req.token
    const { page = 1, limit = 20 } = req.query

    try {
        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find({ recipient: user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('sender', 'username avatar')
                .lean(),
            Notification.countDocuments({ recipient: user._id }),
            Notification.countDocuments({ recipient: user._id, read: false })
        ])

        return res.status(200).json({
            result: notifications,
            total,
            unreadCount,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Failed to fetch notifications' })
    }
}

exports.getUnreadCount = async (req, res) => {
    const { user } = req.token

    try {
        const unreadCount = await Notification.countDocuments({ recipient: user._id, read: false })
        return res.status(200).json({ unreadCount })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Failed to fetch unread count' })
    }
}

exports.markAsRead = async (req, res) => {
    const { user } = req.token
    const { id } = req.params

    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: user._id },
            { read: true },
            { new: true }
        )

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' })
        }

        const unreadCount = await Notification.countDocuments({ recipient: user._id, read: false })

        return res.status(200).json({ result: notification, unreadCount })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Failed to mark notification as read' })
    }
}

exports.markAllAsRead = async (req, res) => {
    const { user } = req.token

    try {
        await Notification.updateMany(
            { recipient: user._id, read: false },
            { read: true }
        )

        return res.status(200).json({ message: 'All notifications marked as read', unreadCount: 0 })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Failed to mark all as read' })
    }
}

exports.deleteNotification = async (req, res) => {
    const { user } = req.token
    const { id } = req.params

    try {
        const notification = await Notification.findOneAndDelete({ _id: id, recipient: user._id })

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' })
        }

        const unreadCount = await Notification.countDocuments({ recipient: user._id, read: false })

        return res.status(200).json({ message: 'Notification deleted', unreadCount })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Failed to delete notification' })
    }
}

exports.clearAll = async (req, res) => {
    const { user } = req.token

    try {
        await Notification.deleteMany({ recipient: user._id })
        return res.status(200).json({ message: 'All notifications cleared', unreadCount: 0 })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Failed to clear notifications' })
    }
}

exports.createNotification = async ({ recipientId, senderId, type, message, link, referenceId, referenceModel, io }) => {
    try {
        if (recipientId.toString() === senderId?.toString()) return null

        const notification = await Notification.create({
            recipient: recipientId,
            sender: senderId,
            type,
            message,
            link,
            referenceId,
            referenceModel
        })

        const populated = await Notification.findById(notification._id)
            .populate('sender', 'username avatar')
            .lean()

        if (io) {
            const unreadCount = await Notification.countDocuments({ recipient: recipientId, read: false })
            io.to(`user:${recipientId}`).emit('new_notification', { notification: populated, unreadCount })
        }

        return populated
    } catch (err) {
        console.log('Error creating notification:', err)
        return null
    }
}
