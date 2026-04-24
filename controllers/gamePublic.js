const Game = require('../models/game.model')
const User = require('../models/user.model')
const Comment = require('../models/comment.model')
const db = require('../plugins/database')
const { createNotification } = require('./notification')

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const getUserSafeContent = async (userId) => {
    if (!userId) return true
    const userDoc = await User.findById(userId).populate('settings_id').lean()
    return userDoc?.settings_id?.safe_content !== true
}

exports.getGames = async (req, res) => {
    try {
        const { id } = req.body

        const safeContent = await getUserSafeContent(id)

        const conditions = [{ deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = conditions.length > 1 ? { $and: conditions } : conditions[0]

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameByID = async (req, res) => {
    try {
        const { id, gameId, access_key, cookie_id } = req.body

        const game = await Game.findOne({ _id: gameId, deleted_at: null })
            .populate({ path: 'user', select: 'username avatar' })
            .lean()

        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger', notFound: true })

        const isOwner = id && game.user._id.toString() === id

        if (game.strict && !isOwner) {
            const safeContent = await getUserSafeContent(id)
            if (safeContent) {
                return res.status(200).json({ result: {}, forbidden: 'strict' })
            }
        }

        if (game.privacy && !isOwner) {
            if (access_key && game.access_key?.length > 0) {
                const ak = game.access_key.find(k => k.key === access_key)
                if (!ak) {
                    return res.status(200).json({ result: {}, forbidden: 'access_invalid' })
                }
                if (ak.download_limit > 0 && ak.user_downloaded.length >= ak.download_limit) {
                    return res.status(200).json({ result: {}, forbidden: 'access_limit' })
                }
                if (cookie_id && !ak.user_downloaded.includes(cookie_id)) {
                    await Game.updateOne(
                        { _id: gameId, 'access_key.key': access_key },
                        { $addToSet: { 'access_key.$.user_downloaded': cookie_id } }
                    )
                }
            } else {
                return res.status(200).json({ result: {}, forbidden: 'private' })
            }
        }

        if (cookie_id) {
            await Game.findByIdAndUpdate(gameId, { $addToSet: { views: cookie_id } })
        }

        const result = {
            game: game,
            avatar: game.user?.avatar || '',
            username: game.user?.username || ''
        }

        return res.status(200).json({ result, forbidden: access_key ? 'access_granted' : false })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getRelatedGames = async (req, res) => {
    try {
        const { id, gameId, category } = req.body

        const safeContent = await getUserSafeContent(id)

        let cat = category
        let sourceTags = []
        let sourceDev = ''
        if (gameId) {
            const source = await Game.findById(gameId).select('category tags details.developer').lean()
            if (!cat) cat = source?.category
            sourceTags = source?.tags || []
            sourceDev = source?.details?.developer || ''
        }

        const matchOr = []
        if (cat) matchOr.push({ category: cat })
        if (sourceTags.length > 0) matchOr.push({ tags: { $in: sourceTags } })
        if (sourceDev) matchOr.push({ 'details.developer': sourceDev })

        const filter = { _id: { $ne: gameId }, deleted_at: null }
        if (matchOr.length > 0) filter.$or = matchOr

        const conditions = [filter]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = { $and: conditions }

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean()

        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addRatings = async (req, res) => {
    try {
        const { gameId, ratings, uid } = req.body

        const game = await Game.findById(gameId)
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const identifier = uid || 'anonymous'
        const existingIdx = game.ratings.findIndex(r => String(r.user) === identifier)

        if (existingIdx !== -1) {
            if (ratings === 0) {
                game.ratings.splice(existingIdx, 1)
            } else {
                game.ratings[existingIdx].rating = ratings
            }
        } else if (ratings > 0) {
            game.ratings.push({ user: identifier, rating: ratings })
        }

        await game.save()

        const updated = await Game.findById(gameId)
            .populate({ path: 'user', select: 'username avatar' })
            .lean()

        const io = req.app.get('io')
        io.to(`game:${gameId}`).emit('game_ratings_updated', { gameId, ratings: updated.ratings })

        return res.status(200).json({ result: updated })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addOneDownload = async (req, res) => {
    try {
        const { id, gameId } = req.body

        if (!id) return res.status(400).json({ message: 'ID required', variant: 'danger' })

        await Game.findByIdAndUpdate(gameId, { $addToSet: { download_count: id } })

        return res.status(200).json({ result: 'Download counted' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateGameAccessKey = async (req, res) => {
    try {
        const { gameId, key, access_key, uid, cookie_id } = req.body

        const keyValue = key || access_key
        const identifier = uid || cookie_id

        const game = await Game.findById(gameId)
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const ak = game.access_key.find(k => k.key === keyValue)
        if (!ak) return res.status(404).json({ message: 'Invalid access key', variant: 'danger' })

        if (ak.download_limit > 0 && ak.user_downloaded.length >= ak.download_limit) {
            return res.status(400).json({ message: 'Access key limit reached', variant: 'danger' })
        }

        if (identifier && !ak.user_downloaded.includes(identifier)) {
            ak.user_downloaded.push(identifier)
            await game.save()
        }

        return res.status(200).json({ result: game, message: 'Access granted', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.countTags = async (req, res) => {
    try {
        const { id } = req.body

        const safeContent = await getUserSafeContent(id)

        const conditions = [{ deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = conditions.length > 1 ? { $and: conditions } : conditions[0]

        const games = await Game.find(query).select('tags').lean()

        const tagMap = {}
        games.forEach(g => {
            g.tags?.forEach(tag => {
                const t = tag.trim()
                if (t) tagMap[t] = (tagMap[t] || 0) + 1
            })
        })

        const result = Object.entries(tagMap)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)

        return res.status(200).json({ result })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.categoriesCount = async (req, res) => {
    try {
        const { id } = req.body

        const safeContent = await getUserSafeContent(id)

        const conditions = [{ deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = conditions.length > 1 ? { $and: conditions } : conditions[0]

        const games = await Game.find(query).select('category').lean()

        const catMap = {}
        games.forEach(g => {
            const c = g.category || 'Uncategorized'
            catMap[c] = (catMap[c] || 0) + 1
        })

        const result = Object.entries(catMap)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)

        return res.status(200).json({ result })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameByTag = async (req, res) => {
    try {
        const { id, tag } = req.body

        const safeContent = await getUserSafeContent(id)
        const safeTag = new RegExp(escapeRegex(tag), 'i')

        const conditions = [{ tags: { $in: [safeTag] }, deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = { $and: conditions }

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameByDeveloper = async (req, res) => {
    try {
        const { id, developer } = req.body

        const safeContent = await getUserSafeContent(id)

        const conditions = [{ 'details.developer': { $regex: escapeRegex(developer), $options: 'i' }, deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = { $and: conditions }

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        const tagMap = {}
        games.forEach(g => {
            g.tags?.forEach(tag => {
                const t = tag.trim()
                if (t) tagMap[t] = (tagMap[t] || 0) + 1
            })
        })

        const tags = Object.entries(tagMap)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)

        return res.status(200).json({ result: games, tags })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameBySearchKey = async (req, res) => {
    try {
        const { id, searchKey } = req.body

        const safeContent = await getUserSafeContent(id)

        const regex = new RegExp(escapeRegex(searchKey), 'i')

        const baseQuery = {
            $or: [
                { title: regex },
                { category: regex },
                { description: regex },
                { tags: { $in: [regex] } },
                { 'details.developer': regex }
            ]
        }

        const conditions = [baseQuery, { deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = { $and: conditions }

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        const tagMap = {}
        games.forEach(g => {
            g.tags?.forEach(tag => {
                const t = tag.trim()
                if (t) tagMap[t] = (tagMap[t] || 0) + 1
            })
        })

        const tags = Object.entries(tagMap)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)

        return res.status(200).json({ result: games, tags })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getRecentGameBlog = async (req, res) => {
    try {
        const { id } = req.body

        const safeContent = await getUserSafeContent(id)

        const conditions = [{ deleted_at: null }]

        if (id) {
            conditions.push({ $or: [{ privacy: false }, { user: id }] })
        } else {
            conditions.push({ privacy: false })
        }

        if (safeContent) {
            conditions.push({ strict: { $ne: true } })
        }

        const query = conditions.length > 1 ? { $and: conditions } : conditions[0]

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()

        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addRecentGamingBlogLikes = async (req, res) => {
    try {
        const { id, gameId, uid, userId } = req.body

        const targetId = gameId || id
        const likerId = uid || userId

        if (!likerId) return res.status(400).json({ message: 'User ID required', variant: 'danger' })

        const game = await Game.findById(targetId)
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const idx = game.likes.indexOf(likerId)
        if (idx === -1) {
            game.likes.push(likerId)
        } else {
            game.likes.splice(idx, 1)
        }
        await game.save()

        const viewerId = userId || ''
        const query = viewerId
            ? { $or: [{ privacy: false }, { user: viewerId }], deleted_at: null }
            : { privacy: false, deleted_at: null }

        const games = await Game.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()

        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameComments = async (req, res) => {
    try {
        const { gameId } = req.body

        const game = await Game.findById(gameId).select('_id').lean()
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const comments = await db.getComments(gameId)

        return res.status(200).json({ result: comments })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadGameComment = async (req, res) => {
    const existing = await Game.findById(req.body.parent_id)

    if (!existing) {
        return res.status(200).json({
            alert: {
                variant: 'danger',
                message: 'Game not found'
            }
        })
    }

    try {
        const newComment = new Comment(req.body)
        await newComment.save()

        const comments = await db.getComments(req.body.parent_id)

        const io = req.app.get('io')
        io.to(`game:${req.body.parent_id}`).emit('game_comments_updated', { gameId: req.body.parent_id, comments })

        if (existing.user && req.body.user) {
            createNotification({
                recipientId: existing.user,
                senderId: req.body.user,
                type: 'comment',
                message: `commented on your game "${existing.title || 'Untitled'}"`,
                link: `/games/${req.body.parent_id}`,
                referenceId: req.body.parent_id,
                referenceModel: 'Game',
                io
            })
        }

        res.status(200).json({
            result: comments,
            alert: {
                variant: 'success',
                message: 'Commented!'
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: {
                variant: 'danger',
                message: 'internal server error'
            }
        })
    }
}

exports.updateGameComment = async (req, res) => {
    const { id, data } = req.body

    try {
        await Comment.findByIdAndUpdate(data._id, data, { new: true })

        const comments = await db.getComments(id)

        const io = req.app.get('io')
        io.to(`game:${id}`).emit('game_comments_updated', { gameId: id, comments })

        return res.status(200).json({ result: comments })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: {
                variant: 'danger',
                message: 'internal server error'
            }
        })
    }
}

exports.removeGameComment = async (req, res) => {
    const { id, game_id } = req.params

    try {
        if (!id) {
            return res.status(403).json({ alert: {
                variant: 'danger',
                message: 'invalid parameter'
            } })
        }

        await Comment.findByIdAndDelete(id)

        const comments = await db.getComments(game_id)

        const io = req.app.get('io')
        io.to(`game:${game_id}`).emit('game_comments_updated', { gameId: game_id, comments })

        return res.status(200).json({
            result: comments,
            alert: {
                variant: 'warning',
                heading: '',
                message: 'Deleted comment'
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: {
                variant: 'danger',
                message: 'internal server error'
            }
        })
    }
}

exports.toggleBookmark = async (req, res) => {
    try {
        const { userId, gameId } = req.body
        if (!userId || !gameId) return res.status(400).json({ message: 'Missing userId or gameId', variant: 'danger' })

        const game = await Game.findById(gameId)
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const idx = game.bookmarks.indexOf(userId)
        if (idx === -1) {
            game.bookmarks.push(userId)
        } else {
            game.bookmarks.splice(idx, 1)
        }
        await game.save()

        return res.status(200).json({ result: game.bookmarks, bookmarked: idx === -1 })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getBookmarkedGames = async (req, res) => {
    try {
        const { userId } = req.body
        if (!userId) return res.status(200).json({ result: [] })

        const games = await Game.find({ bookmarks: userId, deleted_at: null })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addReview = async (req, res) => {
    try {
        const { userId, gameId, rating, text } = req.body
        if (!userId || !gameId) return res.status(400).json({ message: 'Missing required fields', variant: 'danger' })

        const game = await Game.findById(gameId)
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const existingIdx = game.reviews.findIndex(r => String(r.user) === userId)
        if (existingIdx !== -1) {
            game.reviews[existingIdx].rating = rating || 0
            game.reviews[existingIdx].text = text || ''
            game.reviews[existingIdx].createdAt = new Date()
        } else {
            game.reviews.push({ user: userId, rating: rating || 0, text: text || '', createdAt: new Date() })
        }

        await game.save()

        const updated = await Game.findById(gameId)
            .populate({ path: 'reviews.user', select: 'username avatar' })
            .lean()

        return res.status(200).json({ result: updated.reviews, alert: 'Review submitted', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteReview = async (req, res) => {
    try {
        const { userId, gameId } = req.body
        if (!userId || !gameId) return res.status(400).json({ message: 'Missing required fields', variant: 'danger' })

        await Game.findByIdAndUpdate(gameId, { $pull: { reviews: { user: userId } } })

        const updated = await Game.findById(gameId)
            .populate({ path: 'reviews.user', select: 'username avatar' })
            .lean()

        return res.status(200).json({ result: updated?.reviews || [], alert: 'Review deleted', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameReviews = async (req, res) => {
    try {
        const { gameId } = req.body

        const game = await Game.findById(gameId)
            .populate({ path: 'reviews.user', select: 'username avatar' })
            .select('reviews')
            .lean()

        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        return res.status(200).json({ result: game.reviews || [] })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.toggleFavoriteGame = async (req, res) => {
    try {
        const { userId, gameId } = req.body
        if (!userId || !gameId) return res.status(400).json({ message: 'Missing userId or gameId', variant: 'danger' })

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: 'User not found', variant: 'danger' })

        const idx = user.favorite_games.indexOf(gameId)
        if (idx === -1) {
            user.favorite_games.push(gameId)
        } else {
            user.favorite_games.splice(idx, 1)
        }

        await user.save()
        return res.status(200).json({ result: user.favorite_games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getFavoriteGames = async (req, res) => {
    try {
        const { userId, populate } = req.body
        if (!userId) return res.status(200).json({ result: [] })

        const user = await User.findById(userId).select('favorite_games').lean()
        if (!user) return res.status(200).json({ result: [] })

        if (populate) {
            const games = await Game.find({ _id: { $in: user.favorite_games || [] }, deleted_at: null })
                .populate({ path: 'user', select: 'username avatar' })
                .sort({ createdAt: -1 })
                .lean()
            return res.status(200).json({ result: games })
        }

        return res.status(200).json({ result: user.favorite_games || [] })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getCollections = async (req, res) => {
    try {
        const { userId } = req.body
        if (!userId) return res.status(200).json({ result: [] })

        const user = await User.findById(userId).select('game_collections').lean()
        return res.status(200).json({ result: user?.game_collections || [] })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.createCollection = async (req, res) => {
    try {
        const { userId, name } = req.body
        if (!userId || !name) return res.status(400).json({ message: 'Missing fields', variant: 'danger' })

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: 'User not found', variant: 'danger' })

        user.game_collections.push({ name, games: [], createdAt: new Date() })
        await user.save()

        return res.status(200).json({ result: user.game_collections, alert: 'Collection created', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteCollection = async (req, res) => {
    try {
        const { userId, collectionId } = req.body
        if (!userId || !collectionId) return res.status(400).json({ message: 'Missing fields', variant: 'danger' })

        await User.findByIdAndUpdate(userId, { $pull: { game_collections: { _id: collectionId } } })
        const user = await User.findById(userId).select('game_collections').lean()

        return res.status(200).json({ result: user?.game_collections || [], alert: 'Collection deleted', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.toggleGameInCollection = async (req, res) => {
    try {
        const { userId, collectionId, gameId } = req.body
        if (!userId || !collectionId || !gameId) return res.status(400).json({ message: 'Missing fields', variant: 'danger' })

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: 'User not found', variant: 'danger' })

        const col = user.game_collections.id(collectionId)
        if (!col) return res.status(404).json({ message: 'Collection not found', variant: 'danger' })

        const idx = col.games.indexOf(gameId)
        if (idx === -1) {
            col.games.push(gameId)
        } else {
            col.games.splice(idx, 1)
        }
        await user.save()

        return res.status(200).json({ result: user.game_collections })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getCollectionGames = async (req, res) => {
    try {
        const { userId, collectionId } = req.body
        if (!userId || !collectionId) return res.status(200).json({ result: [] })

        const user = await User.findById(userId).select('game_collections').lean()
        const col = user?.game_collections?.find(c => String(c._id) === collectionId)
        if (!col) return res.status(200).json({ result: [] })

        const games = await Game.find({ _id: { $in: col.games }, deleted_at: null })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: games, collection: col })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}
