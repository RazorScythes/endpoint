const Game = require('../models/game.model')
const User = require('../models/user.model')
const Comment = require('../models/comment.model')
const db = require('../plugins/database')

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
                return res.status(200).json({ result: {}, forbiden: 'strict' })
            }
        }

        if (game.privacy && !isOwner) {
            if (access_key && game.access_key?.length > 0) {
                const ak = game.access_key.find(k => k.key === access_key)
                if (!ak) {
                    return res.status(200).json({ result: {}, forbiden: 'access_invalid' })
                }
                if (ak.download_limit > 0 && ak.user_downloaded.length >= ak.download_limit) {
                    return res.status(200).json({ result: {}, forbiden: 'access_limit' })
                }
                if (cookie_id && !ak.user_downloaded.includes(cookie_id)) {
                    await Game.updateOne(
                        { _id: gameId, 'access_key.key': access_key },
                        { $addToSet: { 'access_key.$.user_downloaded': cookie_id } }
                    )
                }
            } else {
                return res.status(200).json({ result: {}, forbiden: 'private' })
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

        return res.status(200).json({ result, forbiden: access_key ? 'access_granted' : false })
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
        if (!cat && gameId) {
            const source = await Game.findById(gameId).select('category').lean()
            cat = source?.category
        }

        const filter = { _id: { $ne: gameId }, deleted_at: null }
        if (cat) filter.category = cat

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

        const query = id
            ? { tags: { $in: [new RegExp(tag, 'i')] }, $or: [{ privacy: false }, { user: id }], deleted_at: null }
            : { tags: { $in: [new RegExp(tag, 'i')] }, privacy: false, deleted_at: null }

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

        const conditions = [{ 'details.developer': { $regex: developer, $options: 'i' }, deleted_at: null }]

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

        const regex = new RegExp(searchKey, 'i')

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
        const { id, gameId, likes, userId } = req.body

        const targetId = gameId || id

        const game = await Game.findById(targetId)
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        if (likes) {
            game.likes = likes
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
