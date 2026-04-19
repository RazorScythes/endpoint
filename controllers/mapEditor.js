const MapDefinition = require('../models/mapEditor.model')
const { del } = require('@vercel/blob')

const TRASH_DAYS = 10

const purgeExpired = async () => {
    const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000)
    await MapDefinition.deleteMany({ deleted_at: { $ne: null, $lte: cutoff } })
}

const activeFilter = () => ({ deleted_at: null })

exports.getDefinitions = async (req, res) => {
    try {
        await purgeExpired()

        const { search, category } = req.query
        const filter = activeFilter()
        if (search) filter.title = { $regex: search, $options: 'i' }
        if (category) filter.category = category

        const definitions = await MapDefinition.find(filter)
            .select('-data')
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: definitions })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getDefinitionById = async (req, res) => {
    try {
        const { id } = req.params
        const definition = await MapDefinition.findById(id).lean()

        if (!definition) return res.status(404).json({ message: 'Definition not found', variant: 'danger' })
        return res.status(200).json({ result: definition })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.createDefinition = async (req, res) => {
    try {
        const data = req.body

        if (!data.title) return res.status(400).json({ message: 'Title is required', variant: 'danger' })

        const created = await new MapDefinition({ ...data }).save()
        const definitions = await MapDefinition.find(activeFilter())
            .select('-data')
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: definitions, createdId: created._id, alert: 'Definition created successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateDefinition = async (req, res) => {
    try {
        const { id } = req.params
        const data = req.body

        await MapDefinition.findOneAndUpdate({ _id: id, deleted_at: null }, { $set: data })
        const definitions = await MapDefinition.find(activeFilter())
            .select('-data')
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: definitions, alert: 'Definition updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteDefinition = async (req, res) => {
    try {
        const { id } = req.params

        await MapDefinition.findOneAndUpdate({ _id: id }, { $set: { deleted_at: new Date() } })
        const definitions = await MapDefinition.find(activeFilter())
            .select('-data')
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: definitions, alert: 'Definition moved to trash', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.duplicateDefinition = async (req, res) => {
    try {
        const { id } = req.params

        const original = await MapDefinition.findOne({ _id: id, deleted_at: null }).lean()
        if (!original) return res.status(404).json({ message: 'Definition not found', variant: 'danger' })

        const { _id, createdAt, updatedAt, ...rest } = original
        await new MapDefinition({ ...rest, title: `${original.title} (Copy)` }).save()

        const definitions = await MapDefinition.find(activeFilter())
            .select('-data')
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: definitions, alert: 'Definition duplicated', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getTrash = async (req, res) => {
    try {
        await purgeExpired()
        const definitions = await MapDefinition.find({ deleted_at: { $ne: null } })
            .select('-data')
            .sort({ deleted_at: -1 })
            .lean()

        return res.status(200).json({ result: definitions })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.restoreDefinition = async (req, res) => {
    try {
        const { id } = req.params

        await MapDefinition.findOneAndUpdate({ _id: id }, { $set: { deleted_at: null } })
        const definitions = await MapDefinition.find(activeFilter())
            .select('-data')
            .sort({ createdAt: -1 })
            .lean()

        return res.status(200).json({ result: definitions, alert: 'Definition restored', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteBlob = async (req, res) => {
    try {
        const { url } = req.body
        if (!url || !url.includes('vercel-storage')) {
            return res.status(400).json({ message: 'Invalid blob URL', variant: 'danger' })
        }
        await del(url)
        return res.status(200).json({ message: 'Blob deleted', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(200).json({ message: 'Blob deletion skipped', variant: 'warning' })
    }
}
