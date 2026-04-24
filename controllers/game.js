const Game = require('../models/game.model')
const Comment = require('../models/comment.model')

const TRASH_DAYS = 10

const purgeExpired = async (userId) => {
    const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000)
    await Game.deleteMany({ user: userId, deleted_at: { $ne: null, $lte: cutoff } })
}

const activeFilter = (userId) => ({ user: userId, deleted_at: null })

exports.getGames = async (req, res) => {
    try {
        const userId = req.token.id
        await purgeExpired(userId)
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameById = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const game = await Game.findOne({ _id: id, user: userId }).populate({ path: 'user', select: 'username avatar' }).lean()
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })
        return res.status(200).json({ result: game })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.createGame = async (req, res) => {
    try {
        const userId = req.token.id
        const data = req.body

        if (!data.title) return res.status(400).json({ message: 'Title is required', variant: 'danger' })

        const { user: _u, _id, ...safeData } = data
        await new Game({ ...safeData, user: userId }).save()
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: 'Game uploaded successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateGame = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const data = req.body

        const { user: _u, _id, deleted_at: _d, ...safeData } = data
        await Game.findOneAndUpdate({ _id: id, user: userId, deleted_at: null }, { $set: safeData })
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: 'Game updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteGame = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        await Game.findOneAndUpdate({ _id: id, user: userId }, { $set: { deleted_at: new Date() } })
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: 'Game moved to trash', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.bulkDeleteGames = async (req, res) => {
    try {
        const userId = req.token.id
        const { ids } = req.body

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No games selected', variant: 'danger' })
        }

        await Game.updateMany({ _id: { $in: ids }, user: userId }, { $set: { deleted_at: new Date() } })
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: `${ids.length} game(s) moved to trash`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.bulkUpdateGames = async (req, res) => {
    try {
        const userId = req.token.id
        const { ids, update } = req.body

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No games selected', variant: 'danger' })
        }

        const allowed = {}
        if (update.status) allowed.status = update.status
        if (update.category) allowed.category = update.category
        if (typeof update.privacy === 'boolean') allowed.privacy = update.privacy
        if (typeof update.strict === 'boolean') allowed.strict = update.strict

        if (Object.keys(allowed).length === 0) {
            return res.status(400).json({ message: 'No valid update fields', variant: 'danger' })
        }

        await Game.updateMany({ _id: { $in: ids }, user: userId, deleted_at: null }, { $set: allowed })
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: `${ids.length} game(s) updated`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getTrash = async (req, res) => {
    try {
        const userId = req.token.id
        await purgeExpired(userId)
        const games = await Game.find({ user: userId, deleted_at: { $ne: null } }).sort({ deleted_at: -1 }).lean()
        return res.status(200).json({ result: games })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.restoreGame = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        await Game.findOneAndUpdate({ _id: id, user: userId, deleted_at: { $ne: null } }, { $set: { deleted_at: null } })
        const games = await Game.find({ user: userId, deleted_at: { $ne: null } }).sort({ deleted_at: -1 }).lean()

        return res.status(200).json({ result: games, alert: 'Game restored', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.permanentDeleteGame = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        await Game.findOneAndDelete({ _id: id, user: userId, deleted_at: { $ne: null } })
        await Comment.deleteMany({ parent_id: id })
        const games = await Game.find({ user: userId, deleted_at: { $ne: null } }).sort({ deleted_at: -1 }).lean()

        return res.status(200).json({ result: games, alert: 'Game permanently deleted', variant: 'warning' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.emptyTrash = async (req, res) => {
    try {
        const userId = req.token.id

        const trashed = await Game.find({ user: userId, deleted_at: { $ne: null } }).select('_id').lean()
        const trashedIds = trashed.map(g => g._id)
        if (trashedIds.length > 0) {
            await Comment.deleteMany({ parent_id: { $in: trashedIds } })
        }
        const result = await Game.deleteMany({ user: userId, deleted_at: { $ne: null } })

        return res.status(200).json({ result: [], alert: `${result.deletedCount} game(s) permanently deleted`, variant: 'warning' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.togglePrivacy = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const game = await Game.findOne({ _id: id, user: userId, deleted_at: null })
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        game.privacy = !game.privacy
        await game.save()
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: `Privacy ${game.privacy ? 'enabled' : 'disabled'}`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.toggleStrict = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const game = await Game.findOne({ _id: id, user: userId, deleted_at: null })
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        game.strict = !game.strict
        await game.save()
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: `Strict mode ${game.strict ? 'enabled' : 'disabled'}`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getGameAnalytics = async (req, res) => {
    try {
        const userId = req.token.id
        const { gameId } = req.body

        const game = await Game.findOne({ _id: gameId, user: userId }).lean()
        if (!game) return res.status(404).json({ message: 'Game not found', variant: 'danger' })

        const commentCount = await Comment.countDocuments({ parent_id: gameId })

        return res.status(200).json({
            result: {
                views: game.views?.length || 0,
                likes: game.likes?.length || 0,
                downloads: game.download_count?.length || 0,
                bookmarks: game.bookmarks?.length || 0,
                comments: commentCount,
                ratings: game.ratings?.length || 0,
                avgRating: game.ratings?.length > 0
                    ? (game.ratings.reduce((s, r) => s + r.rating, 0) / game.ratings.length).toFixed(1)
                    : '0.0',
                reviews: game.reviews?.length || 0,
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}
