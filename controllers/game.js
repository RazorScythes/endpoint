const Game = require('../models/game.model')

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
        const { id } = req.params
        const game = await Game.findById(id).populate({ path: 'user', select: 'username avatar' }).lean()
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

        await new Game({ ...data, user: userId }).save()
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

        await Game.findOneAndUpdate({ _id: id, user: userId, deleted_at: null }, { $set: data })
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

        await Game.updateMany({ _id: { $in: ids }, user: userId }, { $set: { deleted_at: new Date() } })
        const games = await Game.find(activeFilter(userId)).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: games, alert: `${ids.length} game(s) moved to trash`, variant: 'success' })
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

        await Game.findOneAndDelete({ _id: id, user: userId })
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
