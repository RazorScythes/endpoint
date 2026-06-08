const Community = require('../models/community.model')
const CommunityBan = require('../models/communityBan.model')
const ForumPost = require('../models/forumPost.model')
const ForumComment = require('../models/forumComment.model')
const ForumVote = require('../models/forumVote.model')
const Notification = require('../models/notification.model')
const User = require('../models/user.model')

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const MAX_TITLE_LENGTH = 300
const MAX_CONTENT_LENGTH = 50000
const MAX_TAGS = 20
const MAX_IMAGES = 20
const MAX_COMMENT_DEPTH = 8

const emitNotification = async (io, notif) => {
    const populated = await Notification.findById(notif._id).populate('sender', 'username avatar').lean()
    io.to(`user:${notif.recipient}`).emit('new_notification', populated)
}

const getPrivateCommunityIds = async () => {
    const privates = await Community.find({ isPrivate: true }).select('_id').lean()
    return privates.map(c => c._id)
}

const canAccessCommunity = async (communityId, userId) => {
    if (!communityId) return true
    const community = await Community.findById(communityId).select('isPrivate members').lean()
    if (!community) return false
    if (!community.isPrivate) return true
    if (!userId) return false
    return community.members.some(m => m.toString() === userId)
}

exports.getFeed = async (req, res) => {
    try {
        const userId = req.token?.id
        const { page = 1, limit = 15, sort = 'new' } = req.query

        let communityIds = []
        if (userId) {
            const joined = await Community.find({ members: userId }).select('_id').lean()
            communityIds = joined.map(c => c._id)
        }

        const privateCommunityIds = await getPrivateCommunityIds()

        let query
        if (communityIds.length > 0) {
            query = { community: { $in: communityIds } }
        } else {
            query = privateCommunityIds.length > 0 ? { community: { $nin: privateCommunityIds } } : {}
        }

        let sortObj = { createdAt: -1 }
        if (sort === 'top') sortObj = { score: -1, createdAt: -1 }
        if (sort === 'trending') sortObj = { commentCount: -1, score: -1, createdAt: -1 }
        if (sort === 'most_commented') sortObj = { commentCount: -1, createdAt: -1 }

        const total = await ForumPost.countDocuments(query)
        const posts = await ForumPost.find(query)
            .sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon')
            .lean()

        res.json({
            result: posts,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit), limit: Number(limit) }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getPosts = async (req, res) => {
    try {
        const userId = req.token?.id
        const { page = 1, limit = 15, community, tag, sort = 'new', search } = req.query
        const query = {}

        if (community) {
            const hasAccess = await canAccessCommunity(community, userId)
            if (!hasAccess) return res.status(403).json({ alert: { message: 'You do not have access to this community', variant: 'danger' } })
            query.community = community
        } else {
            const privateCommunityIds = await getPrivateCommunityIds()
            if (privateCommunityIds.length > 0) query.community = { $nin: privateCommunityIds }
        }
        if (tag) query.tags = tag
        if (search) {
            const escaped = escapeRegex(search)
            query.$or = [
                { title: { $regex: escaped, $options: 'i' } },
                { content: { $regex: escaped, $options: 'i' } }
            ]
        }

        let sortObj = { createdAt: -1 }
        if (sort === 'top') sortObj = { score: -1, createdAt: -1 }
        if (sort === 'trending') sortObj = { commentCount: -1, score: -1 }
        if (sort === 'most_commented') sortObj = { commentCount: -1, createdAt: -1 }

        const total = await ForumPost.countDocuments(query)
        const posts = await ForumPost.find(query)
            .sort({ isPinned: -1, ...sortObj })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon')
            .lean()

        res.json({
            result: posts,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit), limit: Number(limit) }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getPost = async (req, res) => {
    try {
        const userId = req.token?.id
        const post = await ForumPost.findById(req.params.id)
            .populate('author', 'username avatar')
            .populate({
                path: 'community',
                select: 'name slug icon description memberCount moderators creator isPrivate members',
                populate: [
                    { path: 'creator', select: 'username avatar' },
                    { path: 'moderators', select: 'username avatar' },
                    { path: 'members', select: 'username avatar' }
                ]
            })

        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })

        if (post.community?.isPrivate) {
            const isMember = userId && post.community.members?.some(m => (m._id || m).toString() === userId)
            if (!isMember) return res.status(403).json({ alert: { message: 'You do not have access to this post', variant: 'danger' } })
        }

        post.viewCount += 1
        await post.save()

        res.json({ result: post })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.createPost = async (req, res) => {
    try {
        const userId = req.token.id
        const { title, content, communityId, tags, images, isNSFW } = req.body

        if (!title || !title.trim()) return res.status(400).json({ alert: { message: 'Title is required', variant: 'danger' } })
        if (title.length > MAX_TITLE_LENGTH) return res.status(400).json({ alert: { message: `Title cannot exceed ${MAX_TITLE_LENGTH} characters`, variant: 'danger' } })
        if (content && content.length > MAX_CONTENT_LENGTH) return res.status(400).json({ alert: { message: `Content is too long`, variant: 'danger' } })
        if (tags && tags.length > MAX_TAGS) return res.status(400).json({ alert: { message: `Maximum ${MAX_TAGS} tags allowed`, variant: 'danger' } })
        if (images && images.length > MAX_IMAGES) return res.status(400).json({ alert: { message: `Maximum ${MAX_IMAGES} images allowed`, variant: 'danger' } })

        const community = await Community.findById(communityId)
        if (!community) return res.status(404).json({ alert: { message: 'Community not found', variant: 'danger' } })

        if (!community.members.some(m => m.toString() === userId)) {
            return res.status(403).json({ alert: { message: 'Join the community first', variant: 'danger' } })
        }

        const ban = await CommunityBan.findOne({ user: userId, community: communityId })
        if (ban && (!ban.expiresAt || new Date(ban.expiresAt) > new Date())) {
            return res.status(403).json({ alert: { message: 'You are banned from this community', variant: 'danger' } })
        }

        const post = await ForumPost.create({
            title: title.trim(),
            content: content || '',
            author: userId,
            community: communityId,
            tags: tags || [],
            images: images || [],
            isNSFW: Boolean(isNSFW),
        })

        community.postCount += 1
        await community.save()

        const populated = await ForumPost.findById(post._id)
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon')

        const io = req.app.get('io')
        io.to(`community:${communityId}`).emit('new_forum_post', populated)

        // Parse @mentions
        const mentions = (content || '').match(/@(\w+)/g)
        if (mentions) {
            const User = require('../models/user.model')
            const usernames = [...new Set(mentions.map(m => m.slice(1)))]
            const mentionedUsers = await User.find({ username: { $in: usernames } }).select('_id').lean()
            for (const mu of mentionedUsers) {
                if (mu._id.toString() !== userId) {
                    const notif = await Notification.create({
                        recipient: mu._id, sender: userId, type: 'mention',
                        message: `mentioned you in "${title}"`,
                        link: `/forum/post/${post._id}`, referenceId: post._id, referenceModel: 'ForumPost'
                    })
                    emitNotification(io, notif)
                }
            }
        }

        res.json({ result: populated, alert: { message: 'Post created', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.updatePost = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const { title, content, tags, images, isNSFW } = req.body

        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })
        if (post.author.toString() !== userId) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })
        if (post.isLocked) return res.status(400).json({ alert: { message: 'Post is locked', variant: 'danger' } })

        if (title !== undefined && (!title || !title.trim())) return res.status(400).json({ alert: { message: 'Title is required', variant: 'danger' } })
        if (title && title.length > MAX_TITLE_LENGTH) return res.status(400).json({ alert: { message: `Title cannot exceed ${MAX_TITLE_LENGTH} characters`, variant: 'danger' } })
        if (content && content.length > MAX_CONTENT_LENGTH) return res.status(400).json({ alert: { message: 'Content is too long', variant: 'danger' } })
        if (tags && tags.length > MAX_TAGS) return res.status(400).json({ alert: { message: `Maximum ${MAX_TAGS} tags allowed`, variant: 'danger' } })
        if (images && images.length > MAX_IMAGES) return res.status(400).json({ alert: { message: `Maximum ${MAX_IMAGES} images allowed`, variant: 'danger' } })

        if (title) post.title = title.trim()
        if (content !== undefined) post.content = content
        if (tags) post.tags = tags
        if (images) post.images = images
        if (isNSFW !== undefined) post.isNSFW = Boolean(isNSFW)

        await post.save()
        const populated = await ForumPost.findById(id).populate('author', 'username avatar').populate('community', 'name slug icon')

        res.json({ result: populated, alert: { message: 'Post updated', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.deletePost = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })

        const community = await Community.findById(post.community)
        const isMod = community && (community.creator.toString() === userId || community.moderators.some(m => m.toString() === userId))
        const isAuthor = post.author.toString() === userId
        const isAdmin = req.token.role === 'Admin'

        if (!isAuthor && !isMod && !isAdmin) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        const commentIds = await ForumComment.find({ post: id }).distinct('_id')
        await ForumVote.deleteMany({ target: { $in: [post._id, ...commentIds] } })
        await ForumComment.deleteMany({ post: id })
        await ForumPost.findByIdAndDelete(id)

        if (community) {
            community.postCount = Math.max(0, community.postCount - 1)
            await community.save()
        }

        res.json({ deletedId: id, alert: { message: 'Post deleted', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.togglePin = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })

        const community = await Community.findById(post.community)
        const isMod = community && (community.creator.toString() === userId || community.moderators.some(m => m.toString() === userId)) || req.token.role === 'Admin'
        if (!isMod) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        post.isPinned = !post.isPinned
        await post.save()

        const populated = await ForumPost.findById(id)
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon description memberCount moderators creator isPrivate members')

        res.json({ result: populated, alert: { message: populated.isPinned ? 'Post pinned' : 'Post unpinned', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.toggleLock = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })

        const community = await Community.findById(post.community)
        const isMod = community && (community.creator.toString() === userId || community.moderators.some(m => m.toString() === userId)) || req.token.role === 'Admin'
        if (!isMod) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        post.isLocked = !post.isLocked
        await post.save()

        const populated = await ForumPost.findById(id)
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon description memberCount moderators creator isPrivate members')

        res.json({ result: populated, alert: { message: populated.isLocked ? 'Post locked' : 'Post unlocked', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.votePost = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const value = Number(req.body.value)

        if (![1, -1, 0].includes(value)) return res.status(400).json({ alert: { message: 'Invalid vote', variant: 'danger' } })

        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })

        if (value === 0) {
            await ForumVote.findOneAndDelete({ user: userId, target: id })
        } else {
            await ForumVote.findOneAndUpdate(
                { user: userId, target: id },
                { value, targetModel: 'ForumPost' },
                { upsert: true }
            )
        }

        const votes = await ForumVote.find({ target: id }).select('user value').lean()
        const upvoterIds = votes.filter(v => v.value === 1).map(v => v.user)
        const downvoterIds = votes.filter(v => v.value === -1).map(v => v.user)

        post.upvotes = upvoterIds
        post.downvotes = downvoterIds
        post.score = upvoterIds.length - downvoterIds.length
        await post.save()

        const io = req.app.get('io')
        io.to(`community:${post.community}`).emit('post_votes_updated', { postId: id, score: post.score, upvotes: upvoterIds, downvotes: downvoterIds })

        if (value === 1 && post.author.toString() !== userId) {
            const existing = await Notification.findOne({ recipient: post.author, sender: userId, type: 'like', referenceId: post._id })
            if (!existing) {
                const notif = await Notification.create({
                    recipient: post.author, sender: userId, type: 'like',
                    message: `upvoted your post "${post.title}"`,
                    link: `/forum/post/${post._id}`, referenceId: post._id, referenceModel: 'ForumPost'
                })
                emitNotification(io, notif)
            }
        }

        res.json({ result: { score: post.score, upvotes: upvoterIds, downvotes: downvoterIds } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getComments = async (req, res) => {
    try {
        const userId = req.token?.id
        const { id } = req.params
        const { sort = 'top', page = 1, limit = 30 } = req.query

        const post = await ForumPost.findById(id).select('community').lean()
        if (post) {
            const hasAccess = await canAccessCommunity(post.community, userId)
            if (!hasAccess) return res.status(403).json({ alert: { message: 'You do not have access', variant: 'danger' } })
        }

        let sortObj = { score: -1, createdAt: -1 }
        if (sort === 'new') sortObj = { createdAt: -1 }
        if (sort === 'old') sortObj = { createdAt: 1 }

        const total = await ForumComment.countDocuments({ post: id })
        const comments = await ForumComment.find({ post: id })
            .sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('author', 'username avatar')
            .lean()

        res.json({
            result: comments,
            pagination: { total, page: Number(page), pages: Math.ceil(total / limit) }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.createComment = async (req, res) => {
    try {
        const postId = req.params.id
        const userId = req.token.id
        const { content, parentId } = req.body

        if (!content || !content.trim()) return res.status(400).json({ alert: { message: 'Comment cannot be empty', variant: 'danger' } })
        if (content.length > MAX_CONTENT_LENGTH) return res.status(400).json({ alert: { message: 'Comment is too long', variant: 'danger' } })

        const post = await ForumPost.findById(postId)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })
        if (post.isLocked) return res.status(400).json({ alert: { message: 'Post is locked', variant: 'danger' } })

        const community = await Community.findById(post.community)
        if (community && !community.members.some(m => m.toString() === userId)) {
            return res.status(403).json({ alert: { message: 'Join the community first', variant: 'danger' } })
        }

        const ban = await CommunityBan.findOne({ user: userId, community: post.community })
        if (ban && (!ban.expiresAt || new Date(ban.expiresAt) > new Date())) {
            return res.status(403).json({ alert: { message: 'You are banned from this community', variant: 'danger' } })
        }

        let depth = 0
        let parentComment = null
        if (parentId) {
            parentComment = await ForumComment.findById(parentId)
            if (!parentComment) return res.status(404).json({ alert: { message: 'Parent comment not found', variant: 'danger' } })
            if (parentComment.post.toString() !== postId) return res.status(400).json({ alert: { message: 'Parent comment does not belong to this post', variant: 'danger' } })
            depth = parentComment.depth + 1
            if (depth > MAX_COMMENT_DEPTH) return res.status(400).json({ alert: { message: 'Maximum comment depth reached', variant: 'danger' } })
        }

        const comment = await ForumComment.create({
            content: content.trim(), author: userId, post: postId,
            parent: parentId || null, depth,
        })

        post.commentCount += 1
        await post.save()

        const populated = await ForumComment.findById(comment._id).populate('author', 'username avatar')

        const io = req.app.get('io')
        io.to(`community:${post.community}`).emit('new_forum_comment', { postId, comment: populated })

        if (parentComment && parentComment.author.toString() !== userId) {
            const notif = await Notification.create({
                recipient: parentComment.author, sender: userId, type: 'reply',
                message: `replied to your comment`,
                link: `/forum/post/${postId}`, referenceId: postId, referenceModel: 'ForumPost'
            })
            emitNotification(io, notif)
        } else if (post.author.toString() !== userId) {
            const notif = await Notification.create({
                recipient: post.author, sender: userId, type: 'comment',
                message: `commented on your post "${post.title}"`,
                link: `/forum/post/${postId}`, referenceId: postId, referenceModel: 'ForumPost'
            })
            emitNotification(io, notif)
        }

        // Parse @mentions
        const mentions = content.match(/@(\w+)/g)
        if (mentions) {
            const User = require('../models/user.model')
            const usernames = [...new Set(mentions.map(m => m.slice(1)))]
            const mentionedUsers = await User.find({ username: { $in: usernames } }).select('_id').lean()
            for (const mu of mentionedUsers) {
                if (mu._id.toString() !== userId) {
                    const notif = await Notification.create({
                        recipient: mu._id, sender: userId, type: 'mention',
                        message: `mentioned you in a comment`,
                        link: `/forum/post/${postId}`, referenceId: postId, referenceModel: 'ForumPost'
                    })
                    emitNotification(io, notif)
                }
            }
        }

        res.json({ result: populated, alert: { message: 'Comment added', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.updateComment = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const { content } = req.body

        if (!content || !content.trim()) return res.status(400).json({ alert: { message: 'Comment cannot be empty', variant: 'danger' } })
        if (content.length > MAX_CONTENT_LENGTH) return res.status(400).json({ alert: { message: 'Comment is too long', variant: 'danger' } })

        const comment = await ForumComment.findById(id)
        if (!comment) return res.status(404).json({ alert: { message: 'Comment not found', variant: 'danger' } })
        if (comment.author.toString() !== userId) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        comment.content = content.trim()
        await comment.save()

        const populated = await ForumComment.findById(id).populate('author', 'username avatar')
        res.json({ result: populated, alert: { message: 'Comment updated', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id

        const comment = await ForumComment.findById(id)
        if (!comment) return res.status(404).json({ alert: { message: 'Comment not found', variant: 'danger' } })

        const post = await ForumPost.findById(comment.post)
        let isMod = false
        if (post) {
            const community = await Community.findById(post.community)
            isMod = community && (community.creator.toString() === userId || community.moderators.some(m => m.toString() === userId))
        }
        const isAuthor = comment.author.toString() === userId
        const isAdmin = req.token.role === 'Admin'

        if (!isAuthor && !isMod && !isAdmin) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })

        const hasChildren = await ForumComment.exists({ parent: id })
        if (hasChildren) {
            comment.content = '[deleted]'
            comment.isDeleted = true
            await comment.save()
        } else {
            await ForumVote.deleteMany({ target: id })
            await ForumComment.findByIdAndDelete(id)
            if (post) {
                post.commentCount = Math.max(0, post.commentCount - 1)
                await post.save()
            }
        }

        res.json({ deletedId: id, alert: { message: 'Comment deleted', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.voteComment = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const value = Number(req.body.value)

        if (![1, -1, 0].includes(value)) return res.status(400).json({ alert: { message: 'Invalid vote', variant: 'danger' } })

        const comment = await ForumComment.findById(id)
        if (!comment) return res.status(404).json({ alert: { message: 'Comment not found', variant: 'danger' } })

        if (value === 0) {
            await ForumVote.findOneAndDelete({ user: userId, target: id })
        } else {
            await ForumVote.findOneAndUpdate(
                { user: userId, target: id },
                { value, targetModel: 'ForumComment' },
                { upsert: true }
            )
        }

        const votes = await ForumVote.find({ target: id }).select('user value').lean()
        const upvoterIds = votes.filter(v => v.value === 1).map(v => v.user)
        const downvoterIds = votes.filter(v => v.value === -1).map(v => v.user)

        comment.upvotes = upvoterIds
        comment.downvotes = downvoterIds
        comment.score = upvoterIds.length - downvoterIds.length
        await comment.save()

        res.json({ result: { commentId: id, score: comment.score, upvotes: upvoterIds, downvotes: downvoterIds } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getForumTags = async (req, res) => {
    try {
        const tags = await ForumPost.aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 }
        ])
        res.json({ result: tags.map(t => ({ name: t._id, count: t.count })) })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.searchForum = async (req, res) => {
    try {
        const { q, type = 'posts', page = 1, limit = 15 } = req.query
        if (!q) return res.json({ result: [], pagination: { total: 0 } })

        const escaped = escapeRegex(q)
        const regex = { $regex: escaped, $options: 'i' }

        if (type === 'communities') {
            const communityQuery = { $or: [{ name: regex }, { description: regex }], isPrivate: { $ne: true } }
            const total = await Community.countDocuments(communityQuery)
            const result = await Community.find(communityQuery)
                .sort({ memberCount: -1 }).skip((page - 1) * limit).limit(Number(limit))
                .populate('creator', 'username avatar').lean()
            return res.json({ result, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } })
        }

        if (type === 'users') {
            const User = require('../models/user.model')
            const total = await User.countDocuments({ username: regex })
            const result = await User.find({ username: regex })
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
                .select('username avatar createdAt').lean()
            return res.json({ result, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } })
        }

        const privateCommunityIds = await getPrivateCommunityIds()
        const postQuery = {
            $text: { $search: q },
            ...(privateCommunityIds.length > 0 ? { community: { $nin: privateCommunityIds } } : {})
        }
        const total = await ForumPost.countDocuments(postQuery)
        const result = await ForumPost.find(postQuery, { textScore: { $meta: 'textScore' } })
            .sort({ textScore: { $meta: 'textScore' }, score: -1 }).skip((page - 1) * limit).limit(Number(limit))
            .populate('author', 'username avatar').populate('community', 'name slug icon').lean()
        res.json({ result, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.reportContent = async (req, res) => {
    try {
        const Report = require('../models/report.model')
        const User = require('../models/user.model')
        const userId = req.token.id
        const { contentId, type, reason, details } = req.body

        if (!contentId || !type) return res.status(400).json({ alert: { message: 'Missing required fields', variant: 'danger' } })
        if (!['forum_post', 'forum_comment'].includes(type)) return res.status(400).json({ alert: { message: 'Invalid report type', variant: 'danger' } })

        const validReasons = ['Spam', 'Harassment', 'Misinformation', 'Not Appropriate', 'Other']
        if (reason && !validReasons.includes(reason)) return res.status(400).json({ alert: { message: 'Invalid reason', variant: 'danger' } })

        const existing = await Report.findOne({ user: userId, content_id: contentId, type })
        if (existing) return res.status(400).json({ alert: { message: 'You have already reported this', variant: 'warning' } })

        const reporter = await User.findById(userId).select('username email').lean()

        await Report.create({
            user: userId,
            content_id: contentId,
            type,
            reason: reason || 'Other',
            details: (details || '').trim().slice(0, 1000) || 'No additional details',
            name: reporter?.username || 'Unknown',
            email: reporter?.email || 'unknown@unknown.com',
        })

        res.json({ alert: { message: 'Report submitted. Thank you.', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.savePost = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })
        await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: id } })
        res.json({ result: { saved: true, postId: id }, alert: { message: 'Post saved', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.unsavePost = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await User.findByIdAndUpdate(userId, { $pull: { savedPosts: id } })
        res.json({ result: { saved: false, postId: id }, alert: { message: 'Post removed from saved', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getSavedPosts = async (req, res) => {
    try {
        const userId = req.token.id
        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(50, parseInt(req.query.limit) || 15)
        const user = await User.findById(userId).select('savedPosts').lean()
        const total = user?.savedPosts?.length || 0
        const ids = (user?.savedPosts || []).slice((page - 1) * limit, page * limit)
        const posts = await ForumPost.find({ _id: { $in: ids } })
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon')
            .sort({ createdAt: -1 })
            .lean()
        res.json({ result: posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getForumReports = async (req, res) => {
    try {
        const role = req.token.role
        if (role !== 'Admin' && role !== 'Moderator') {
            return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })
        }
        const Report = require('../models/report.model')
        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(50, parseInt(req.query.limit) || 10)
        const query = { type: { $in: ['forum_post', 'forum_comment'] } }
        if (req.query.status && req.query.status !== 'all') query.status = req.query.status
        const total = await Report.countDocuments(query)
        const reports = await Report.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('user', 'username avatar')
            .lean()
        res.json({ result: reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.dismissReport = async (req, res) => {
    try {
        const role = req.token.role
        if (role !== 'Admin' && role !== 'Moderator') {
            return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })
        }
        const Report = require('../models/report.model')
        const report = await Report.findByIdAndUpdate(req.params.id, { status: 'dismissed' }, { new: true })
        if (!report) return res.status(404).json({ alert: { message: 'Report not found', variant: 'danger' } })
        res.json({ result: report, alert: { message: 'Report dismissed', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}
