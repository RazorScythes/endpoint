const Community = require('../models/community.model')
const CommunityBan = require('../models/communityBan.model')
const ForumPost = require('../models/forumPost.model')
const ForumComment = require('../models/forumComment.model')
const ForumVote = require('../models/forumVote.model')
const Notification = require('../models/notification.model')
const ActivityLog = require('../models/activitylog.model')

const crypto = require('crypto')

const slugify = (text) => {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
}

const generateInviteCode = () => crypto.randomBytes(4).toString('hex')

exports.getCommunities = async (req, res) => {
    try {
        const { page = 1, limit = 12, search, sort = 'popular', joined } = req.query
        const query = {}

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        }

        if (joined === 'true' && req.token?.id) {
            query.members = req.token.id
        } else {
            query.isPrivate = { $ne: true }
        }

        let sortObj = { memberCount: -1 }
        if (sort === 'new') sortObj = { createdAt: -1 }
        if (sort === 'name') sortObj = { name: 1 }

        const total = await Community.countDocuments(query)
        const communities = await Community.find(query)
            .sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .select('-inviteCode')
            .populate('creator', 'username avatar')
            .lean()

        res.json({
            result: communities,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit), limit: Number(limit) }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getCommunityBySlug = async (req, res) => {
    try {
        const community = await Community.findOne({ slug: req.params.slug })
            .populate('creator', 'username avatar')
            .populate('moderators', 'username avatar')
            .lean()

        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        const userId = req.token?.id
        const isMember = userId && community.members.some(m => m.toString() === userId)
        const isMod = userId && (community.creator?._id?.toString() === userId || community.moderators?.some(m => (m._id || m).toString() === userId))
        const isAdmin = req.token?.role === 'Admin'

        if (community.isPrivate && !isMember && !isMod && !isAdmin) {
            return res.json({
                result: {
                    _id: community._id,
                    name: community.name,
                    slug: community.slug,
                    icon: community.icon,
                    banner: community.banner,
                    isPrivate: true,
                    memberCount: community.memberCount,
                    _restricted: true,
                }
            })
        }

        const result = { ...community }
        if (isMod || isAdmin) {
            result._inviteCode = community.inviteCode
        }
        delete result.inviteCode

        res.json({ result })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.createCommunity = async (req, res) => {
    try {
        const { name, description, isPrivate, rules, banner, icon, tags } = req.body
        const userId = req.token.id

        if (!name || !name.trim()) return res.status(400).json({ alert: { message: 'Community name is required', variant: 'danger' } })

        let slug = slugify(name)
        const existing = await Community.findOne({ slug })
        if (existing) slug = slug + '-' + Date.now().toString(36)

        const communityData = {
            name: name.trim(),
            slug,
            description: description || '',
            isPrivate: isPrivate || false,
            rules: rules || [],
            banner: banner || '',
            icon: icon || '',
            creator: userId,
            moderators: [userId],
            members: [userId],
            memberCount: 1,
            tags: tags || [],
        }
        if (communityData.isPrivate) communityData.inviteCode = generateInviteCode()

        const community = await Community.create(communityData)

        await ActivityLog.create({ user_id: userId, description: `Created community "${community.name}"`, category: 'community', method: 'POST' })

        const result = community.toObject()
        if (result.inviteCode) {
            result._inviteCode = result.inviteCode
        }
        delete result.inviteCode

        res.json({ result, alert: { message: 'Community created successfully', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.updateCommunity = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const { name, description, isPrivate, rules, banner, icon, tags } = req.body

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        const isMod = community.creator.toString() === userId || community.moderators.some(m => m.toString() === userId) || req.token.role === 'Admin'
        if (!isMod) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        if (name) community.name = name.trim()
        if (description !== undefined) community.description = description
        if (isPrivate !== undefined) {
            community.isPrivate = isPrivate
            if (isPrivate && !community.inviteCode) community.inviteCode = generateInviteCode()
        }
        if (rules) community.rules = rules
        if (banner !== undefined) community.banner = banner
        if (icon !== undefined) community.icon = icon
        if (tags) community.tags = tags

        await community.save()

        const result = community.toObject()
        if (result.inviteCode) {
            result._inviteCode = result.inviteCode
        }
        delete result.inviteCode

        res.json({ result, alert: { message: 'Community updated', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.deleteCommunity = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        if (community.creator.toString() !== userId && req.token.role !== 'Admin') {
            return res.status(403).json({ alert: { message: 'Only the creator or admin can delete', variant: 'danger' } })
        }

        const postIds = await ForumPost.find({ community: id }).distinct('_id')
        await ForumComment.deleteMany({ post: { $in: postIds } })
        await ForumVote.deleteMany({ target: { $in: [...postIds, ...(await ForumComment.find({ post: { $in: postIds } }).distinct('_id'))] } })
        await ForumPost.deleteMany({ community: id })
        await CommunityBan.deleteMany({ community: id })
        await Community.findByIdAndDelete(id)

        res.json({ alert: { message: 'Community deleted', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.joinCommunity = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const { inviteCode } = req.body || {}

        const ban = await CommunityBan.findOne({ user: userId, community: id })
        if (ban) {
            const isBanned = !ban.expiresAt || new Date(ban.expiresAt) > new Date()
            if (isBanned) return res.status(403).json({ alert: { message: 'You are banned from this community', variant: 'danger' } })
        }

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        if (community.isPrivate) {
            if (!inviteCode || inviteCode.trim().toLowerCase() !== community.inviteCode.toLowerCase()) {
                return res.status(403).json({ alert: { message: 'Invalid invitation code', variant: 'danger' } })
            }
        }

        if (community.members.some(m => m.toString() === userId)) {
            return res.status(400).json({ alert: { message: 'Already a member', variant: 'danger' } })
        }

        community.members.push(userId)
        community.memberCount = community.members.length
        await community.save()

        res.json({ result: community, alert: { message: `Joined ${community.name}`, variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.joinByInviteCode = async (req, res) => {
    try {
        const { code } = req.params
        const userId = req.token.id

        const community = await Community.findOne({ inviteCode: { $regex: new RegExp(`^${code}$`, 'i') } })
        if (!community) return res.status(404).json({ alert: { message: 'Invalid invitation code', variant: 'danger' } })

        const ban = await CommunityBan.findOne({ user: userId, community: community._id })
        if (ban) {
            const isBanned = !ban.expiresAt || new Date(ban.expiresAt) > new Date()
            if (isBanned) return res.status(403).json({ alert: { message: 'You are banned from this community', variant: 'danger' } })
        }

        if (community.members.some(m => m.toString() === userId)) {
            return res.json({ result: community, alert: { message: 'Already a member', variant: 'info' } })
        }

        community.members.push(userId)
        community.memberCount = community.members.length
        await community.save()

        res.json({ result: community, alert: { message: `Joined ${community.name}`, variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.regenerateInviteCode = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        const isMod = community.creator.toString() === userId || community.moderators.some(m => m.toString() === userId) || req.token.role === 'Admin'
        if (!isMod) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        community.inviteCode = generateInviteCode()
        await community.save()

        res.json({ result: { inviteCode: community.inviteCode }, alert: { message: 'Invite code regenerated', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.leaveCommunity = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        if (community.creator.toString() === userId) {
            return res.status(400).json({ alert: { message: 'Creator cannot leave. Transfer or delete instead.', variant: 'danger' } })
        }

        community.members = community.members.filter(m => m.toString() !== userId)
        community.moderators = community.moderators.filter(m => m.toString() !== userId)
        community.memberCount = community.members.length
        await community.save()

        res.json({ result: community, alert: { message: `Left ${community.name}`, variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.addModerator = async (req, res) => {
    try {
        const { id } = req.params
        const { userId: targetId } = req.body
        const requesterId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        if (community.creator.toString() !== requesterId && req.token.role !== 'Admin') {
            return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })
        }

        if (!community.members.some(m => m.toString() === targetId)) {
            return res.status(400).json({ alert: { message: 'User must be a member first', variant: 'danger' } })
        }

        if (community.moderators.some(m => m.toString() === targetId)) {
            return res.status(400).json({ alert: { message: 'Already a moderator', variant: 'danger' } })
        }

        community.moderators.push(targetId)
        await community.save()

        await Notification.create({
            recipient: targetId, sender: requesterId, type: 'system',
            message: `You were made a moderator of ${community.name}`,
            link: `/forum/c/${community.slug}`
        })

        const io = req.app.get('io')
        io.to(`user:${targetId}`).emit('new_notification', { type: 'system' })

        res.json({ result: community, alert: { message: 'Moderator added', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.removeModerator = async (req, res) => {
    try {
        const { id, userId: targetId } = req.params
        const requesterId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        if (community.creator.toString() !== requesterId && req.token.role !== 'Admin') {
            return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })
        }

        community.moderators = community.moderators.filter(m => m.toString() !== targetId)
        await community.save()

        res.json({ result: community, alert: { message: 'Moderator removed', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.banFromCommunity = async (req, res) => {
    try {
        const { id } = req.params
        const { userId: targetId, reason, duration } = req.body
        const requesterId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        const isMod = community.creator.toString() === requesterId || community.moderators.some(m => m.toString() === requesterId) || req.token.role === 'Admin'
        if (!isMod) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        if (community.creator.toString() === targetId) {
            return res.status(400).json({ alert: { message: 'Cannot ban the creator', variant: 'danger' } })
        }

        let expiresAt = null
        if (duration) expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000)

        await CommunityBan.findOneAndUpdate(
            { user: targetId, community: id },
            { reason: reason || '', bannedBy: requesterId, expiresAt },
            { upsert: true, new: true }
        )

        community.members = community.members.filter(m => m.toString() !== targetId)
        community.moderators = community.moderators.filter(m => m.toString() !== targetId)
        community.memberCount = community.members.length
        await community.save()

        res.json({ result: community, alert: { message: 'User banned from community', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.unbanFromCommunity = async (req, res) => {
    try {
        const { id, userId: targetId } = req.params
        const requesterId = req.token.id

        const community = await Community.findById(id)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        const isMod = community.creator.toString() === requesterId || community.moderators.some(m => m.toString() === requesterId) || req.token.role === 'Admin'
        if (!isMod) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        await CommunityBan.findOneAndDelete({ user: targetId, community: id })

        res.json({ alert: { message: 'User unbanned', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}
