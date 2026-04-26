const Community = require('../models/community.model')
const CommunityBan = require('../models/communityBan.model')
const ForumPost = require('../models/forumPost.model')
const ForumComment = require('../models/forumComment.model')
const ForumVote = require('../models/forumVote.model')
const Notification = require('../models/notification.model')

const emitNotification = async (io, notif) => {
    const populated = await Notification.findById(notif._id).populate('sender', 'username avatar').lean()
    io.to(`user:${notif.recipient}`).emit('new_notification', populated)
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

        const query = communityIds.length > 0 ? { community: { $in: communityIds } } : {}

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
        const { page = 1, limit = 15, community, tag, sort = 'new', search } = req.query
        const query = {}

        if (community) query.community = community
        if (tag) query.tags = tag
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
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
        const post = await ForumPost.findById(req.params.id)
            .populate('author', 'username avatar')
            .populate('community', 'name slug icon description memberCount moderators creator')

        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })

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
        const { title, content, communityId, tags, images } = req.body

        if (!title || !title.trim()) return res.status(400).json({ alert: { message: 'Title is required', variant: 'danger' } })

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
        const { title, content, tags, images } = req.body

        const post = await ForumPost.findById(id)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })
        if (post.author.toString() !== userId) return res.status(403).json({ alert: { message: 'Unauthorized', variant: 'danger' } })
        if (post.isLocked) return res.status(400).json({ alert: { message: 'Post is locked', variant: 'danger' } })

        if (title) post.title = title.trim()
        if (content !== undefined) post.content = content
        if (tags) post.tags = tags
        if (images) post.images = images

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

        res.json({ result: post, alert: { message: post.isPinned ? 'Post pinned' : 'Post unpinned', variant: 'success' } })
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

        res.json({ result: post, alert: { message: post.isLocked ? 'Post locked' : 'Post unlocked', variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.votePost = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.token.id
        const { value } = req.body

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

        const upvotes = await ForumVote.countDocuments({ target: id, value: 1 })
        const downvotes = await ForumVote.countDocuments({ target: id, value: -1 })
        const upvoterIds = await ForumVote.find({ target: id, value: 1 }).distinct('user')
        const downvoterIds = await ForumVote.find({ target: id, value: -1 }).distinct('user')

        post.upvotes = upvoterIds
        post.downvotes = downvoterIds
        post.score = upvotes - downvotes
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
        const { id } = req.params
        const { sort = 'top', page = 1, limit = 30 } = req.query

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

        const post = await ForumPost.findById(postId)
        if (!post) return res.status(404).json({ alert: { message: 'Post not found', variant: 'danger' } })
        if (post.isLocked) return res.status(400).json({ alert: { message: 'Post is locked', variant: 'danger' } })

        let depth = 0
        let parentComment = null
        if (parentId) {
            parentComment = await ForumComment.findById(parentId)
            if (parentComment) depth = parentComment.depth + 1
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
        }

        if (post) {
            post.commentCount = Math.max(0, post.commentCount - 1)
            await post.save()
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
        const { value } = req.body

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

        const upvotes = await ForumVote.countDocuments({ target: id, value: 1 })
        const downvotes = await ForumVote.countDocuments({ target: id, value: -1 })
        const upvoterIds = await ForumVote.find({ target: id, value: 1 }).distinct('user')
        const downvoterIds = await ForumVote.find({ target: id, value: -1 }).distinct('user')

        comment.upvotes = upvoterIds
        comment.downvotes = downvoterIds
        comment.score = upvotes - downvotes
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

        const regex = { $regex: q, $options: 'i' }

        if (type === 'communities') {
            const total = await Community.countDocuments({ $or: [{ name: regex }, { description: regex }] })
            const result = await Community.find({ $or: [{ name: regex }, { description: regex }] })
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

        const total = await ForumPost.countDocuments({ $or: [{ title: regex }, { content: regex }] })
        const result = await ForumPost.find({ $or: [{ title: regex }, { content: regex }] })
            .sort({ score: -1, createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
            .populate('author', 'username avatar').populate('community', 'name slug icon').lean()
        res.json({ result, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}
