const Conversation = require('../models/conversation.model')
const Message = require('../models/message.model')
const Users = require('../models/user.model')
const BlockedUser = require('../models/blockeduser.model')

exports.getConversations = async (req, res) => {
    const { user } = req.token

    try {
        const conversations = await Conversation.find({
            participants: user._id,
            deletedBy: { $ne: user._id }
        })
            .populate('participants', 'avatar username')
            .populate('lastMessage')
            .sort({ updatedAt: -1 })

        res.status(200).json({ result: conversations })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.getOrCreateConversation = async (req, res) => {
    const { user } = req.token
    const { targetUserId } = req.body

    if (!targetUserId) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'Target user is required' }
        })
    }

    if (targetUserId === user._id.toString()) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'Cannot start a conversation with yourself' }
        })
    }

    try {
        const targetUser = await Users.findById(targetUserId)
        if (!targetUser) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'User not found' }
            })
        }

        const blocked = await BlockedUser.findOne({
            $or: [
                { blocker: user._id, blocked: targetUserId },
                { blocker: targetUserId, blocked: user._id }
            ]
        })

        if (blocked) {
            const youBlocked = blocked.blocker.toString() === user._id.toString()
            return res.status(403).json({
                alert: {
                    variant: 'danger',
                    message: youBlocked
                        ? 'You have blocked this user. Unblock them to start a conversation.'
                        : 'You cannot message this user.'
                }
            })
        }

        let conversation = await Conversation.findOne({
            participants: { $all: [user._id, targetUserId], $size: 2 }
        })
            .populate('participants', 'avatar username')
            .populate('lastMessage')

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [user._id, targetUserId]
            })
            conversation = await Conversation.findById(conversation._id)
                .populate('participants', 'avatar username')
                .populate('lastMessage')
        }

        res.status(200).json({ result: conversation })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.getMessages = async (req, res) => {
    const { user } = req.token
    const { conversationId } = req.params
    const { page = 1, limit = 50 } = req.query

    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: user._id
        })

        if (!conversation) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Conversation not found' }
            })
        }

        await Message.updateMany(
            { conversation: conversationId, sender: { $ne: user._id }, read: false },
            { read: true }
        )

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const msgFilter = { conversation: conversationId, deletedBy: { $ne: user._id } }

        const [messages, total] = await Promise.all([
            Message.find(msgFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('sender', 'avatar username'),
            Message.countDocuments(msgFilter)
        ])

        res.status(200).json({
            result: messages.reverse(),
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

exports.sendMessage = async (req, res) => {
    const { user } = req.token
    const { conversationId, content, fileUrl, fileName, fileType } = req.body

    if (!conversationId || (!content?.trim() && !fileUrl)) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'Conversation and content are required' }
        })
    }

    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: user._id
        })

        if (!conversation) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Conversation not found' }
            })
        }

        const recipientIdForBlock = conversation.participants.find(
            p => p.toString() !== user._id.toString()
        )

        const blocked = await BlockedUser.findOne({
            $or: [
                { blocker: user._id, blocked: recipientIdForBlock },
                { blocker: recipientIdForBlock, blocked: user._id }
            ]
        })

        if (blocked) {
            return res.status(403).json({
                alert: { variant: 'danger', message: 'You cannot send messages in this conversation.' }
            })
        }

        const messageData = {
            conversation: conversationId,
            sender: user._id,
            content: content?.trim() || ''
        }

        if (fileUrl) {
            messageData.fileUrl = fileUrl
            messageData.fileName = fileName || 'file'
            messageData.fileType = fileType || 'application/octet-stream'
        }

        const message = await Message.create(messageData)

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            $set: { deletedBy: [] }
        })

        const populated = await Message.findById(message._id)
            .populate('sender', 'avatar username')

        const recipientId = conversation.participants.find(
            p => p.toString() !== user._id.toString()
        )

        const io = req.app.get('io')
        io.to(`user:${recipientId}`).emit('new_message', {
            message: populated,
            conversationId
        })

        res.status(200).json({ result: populated })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.searchUsers = async (req, res) => {
    const { user } = req.token
    const { q } = req.query

    if (!q || q.trim().length < 2) {
        return res.status(200).json({ result: [] })
    }

    try {
        const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        const users = await Users.find({
            _id: { $ne: user._id },
            username: { $regex: escaped, $options: 'i' }
        })
            .select('avatar username')
            .limit(10)

        res.status(200).json({ result: users })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.getUnreadCount = async (req, res) => {
    const { user } = req.token

    try {
        const conversations = await Conversation.find({ participants: user._id })

        const count = await Message.countDocuments({
            conversation: { $in: conversations.map(c => c._id) },
            sender: { $ne: user._id },
            read: false
        })

        res.status(200).json({ result: count })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteMessage = async (req, res) => {
    const { user } = req.token
    const { messageId } = req.params

    try {
        const message = await Message.findById(messageId).populate('conversation')

        if (!message) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Message not found' }
            })
        }

        const conversation = await Conversation.findOne({
            _id: message.conversation._id || message.conversation,
            participants: user._id
        })

        if (!conversation) {
            return res.status(403).json({
                alert: { variant: 'danger', message: 'Not authorized' }
            })
        }

        await Message.findByIdAndUpdate(messageId, {
            $addToSet: { deletedBy: user._id }
        })

        res.status(200).json({
            result: messageId
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteMessageForAll = async (req, res) => {
    const { user } = req.token
    const { messageId } = req.params

    try {
        const message = await Message.findById(messageId)

        if (!message) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Message not found' }
            })
        }

        if (message.sender.toString() !== user._id.toString()) {
            return res.status(403).json({
                alert: { variant: 'danger', message: 'You can only delete your own messages for everyone' }
            })
        }

        const conversation = await Conversation.findOne({
            _id: message.conversation,
            participants: user._id
        })

        if (!conversation) {
            return res.status(403).json({
                alert: { variant: 'danger', message: 'Not authorized' }
            })
        }

        const conversationId = message.conversation.toString()
        await Message.findByIdAndDelete(messageId)

        const recipientId = conversation.participants.find(
            p => p.toString() !== user._id.toString()
        )

        const io = req.app.get('io')
        io.to(`user:${recipientId}`).emit('message_deleted', { messageId, conversationId })

        res.status(200).json({ result: messageId })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteConversationForMe = async (req, res) => {
    const { user } = req.token
    const { conversationId } = req.params

    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: user._id
        })

        if (!conversation) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Conversation not found' }
            })
        }

        await Promise.all([
            Conversation.findByIdAndUpdate(conversationId, {
                $addToSet: { deletedBy: user._id }
            }),
            Message.updateMany(
                { conversation: conversationId },
                { $addToSet: { deletedBy: user._id } }
            )
        ])

        res.status(200).json({
            result: conversationId,
            alert: { variant: 'success', message: 'Conversation deleted for you' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteConversationForAll = async (req, res) => {
    const { user } = req.token
    const { conversationId } = req.params

    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: user._id
        })

        if (!conversation) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Conversation not found' }
            })
        }

        await Message.deleteMany({ conversation: conversationId })
        await Conversation.findByIdAndDelete(conversationId)

        const recipientId = conversation.participants.find(
            p => p.toString() !== user._id.toString()
        )

        const io = req.app.get('io')
        io.to(`user:${recipientId}`).emit('conversation_deleted', { conversationId })

        res.status(200).json({
            result: conversationId,
            alert: { variant: 'success', message: 'Conversation deleted for everyone' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.blockUser = async (req, res) => {
    const { user } = req.token
    const { targetUserId } = req.body

    if (!targetUserId) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'Target user is required' }
        })
    }

    if (targetUserId === user._id.toString()) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'You cannot block yourself' }
        })
    }

    try {
        const targetUser = await Users.findById(targetUserId)
        if (!targetUser) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'User not found' }
            })
        }

        const existing = await BlockedUser.findOne({
            blocker: user._id,
            blocked: targetUserId
        })

        if (existing) {
            return res.status(400).json({
                alert: { variant: 'danger', message: 'User is already blocked' }
            })
        }

        await BlockedUser.create({
            blocker: user._id,
            blocked: targetUserId
        })

        res.status(200).json({
            result: targetUserId,
            alert: { variant: 'success', message: `${targetUser.username} has been blocked` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.unblockUser = async (req, res) => {
    const { user } = req.token
    const { targetUserId } = req.params

    try {
        const result = await BlockedUser.findOneAndDelete({
            blocker: user._id,
            blocked: targetUserId
        })

        if (!result) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Block record not found' }
            })
        }

        const targetUser = await Users.findById(targetUserId).select('username')

        res.status(200).json({
            result: targetUserId,
            alert: { variant: 'success', message: `${targetUser?.username || 'User'} has been unblocked` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.getBlockedUsers = async (req, res) => {
    const { user } = req.token

    try {
        const blockedEntries = await BlockedUser.find({ blocker: user._id })
            .populate('blocked', 'avatar username')
            .sort({ createdAt: -1 })

        const blockedUsers = blockedEntries.map(entry => ({
            _id: entry.blocked._id,
            username: entry.blocked.username,
            avatar: entry.blocked.avatar,
            blockedAt: entry.createdAt
        }))

        res.status(200).json({ result: blockedUsers })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.checkBlocked = async (req, res) => {
    const { user } = req.token
    const { targetUserId } = req.params

    try {
        const [iBlocked, theyBlocked] = await Promise.all([
            BlockedUser.findOne({ blocker: user._id, blocked: targetUserId }),
            BlockedUser.findOne({ blocker: targetUserId, blocked: user._id })
        ])

        res.status(200).json({
            result: {
                iBlocked: !!iBlocked,
                theyBlocked: !!theyBlocked,
                anyBlocked: !!(iBlocked || theyBlocked)
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}
