const Page = require('../models/page.model')
const UserImage = require('../models/userImage.model')

const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 80)
}

const ensureUniqueSlug = async (baseSlug, excludeId = null) => {
    let slug = baseSlug
    let counter = 0
    while (true) {
        const query = { slug }
        if (excludeId) query._id = { $ne: excludeId }
        const existing = await Page.findOne(query)
        if (!existing) return slug
        counter++
        slug = `${baseSlug}-${counter}`
    }
}

const PAGE_SELECT = 'title slug description thumbnail status privacy deleted deletedAt createdAt updatedAt'

const purgeExpiredTrash = async (userId) => {
    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    await Page.deleteMany({ user: userId, deleted: true, deletedAt: { $lte: cutoff } })
}

exports.getPages = async (req, res) => {
    try {
        const userId = req.token.id
        await purgeExpiredTrash(userId)
        const pages = await Page.find({ user: userId, deleted: false })
            .select(PAGE_SELECT)
            .sort({ updatedAt: -1 })
            .lean()
        return res.status(200).json({ result: pages })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load pages' } })
    }
}

exports.getTrash = async (req, res) => {
    try {
        const userId = req.token.id
        await purgeExpiredTrash(userId)
        const pages = await Page.find({ user: userId, deleted: true })
            .select(PAGE_SELECT)
            .sort({ deletedAt: -1 })
            .lean()
        return res.status(200).json({ result: pages })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load trash' } })
    }
}

exports.getPageBySlug = async (req, res) => {
    try {
        const { slug } = req.params
        const page = await Page.findOne({ slug, status: 'published', privacy: false, deleted: false }).lean()
        if (!page) return res.status(404).json({ alert: { variant: 'danger', message: 'Page not found' } })
        return res.status(200).json({ result: page })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load page' } })
    }
}

exports.getPageForEdit = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const page = await Page.findOne({ _id: id, user: userId, deleted: false }).lean()
        if (!page) return res.status(404).json({ alert: { variant: 'danger', message: 'Page not found' } })
        return res.status(200).json({ result: page })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load page' } })
    }
}

exports.createPage = async (req, res) => {
    try {
        const userId = req.token.id
        const { title } = req.body
        if (!title) return res.status(400).json({ alert: { variant: 'danger', message: 'Page title is required' } })

        const baseSlug = generateSlug(title)
        const slug = await ensureUniqueSlug(baseSlug || 'untitled')

        const page = await new Page({
            user: userId,
            title,
            slug,
            layout: [],
            globalStyles: {},
        }).save()

        return res.status(200).json({
            result: page.toObject(),
            alert: { variant: 'success', message: 'Page created' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to create page' } })
    }
}

exports.updatePage = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, title, description, slug, thumbnail, status, privacy, layout, globalStyles } = req.body
        if (!id) return res.status(400).json({ alert: { variant: 'danger', message: 'Page ID is required' } })

        const updateData = {}
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description
        if (thumbnail !== undefined) updateData.thumbnail = thumbnail
        if (status !== undefined) updateData.status = status
        if (privacy !== undefined) updateData.privacy = privacy
        if (layout !== undefined) updateData.layout = layout
        if (globalStyles !== undefined) updateData.globalStyles = globalStyles

        if (slug !== undefined) {
            const baseSlug = generateSlug(slug)
            updateData.slug = await ensureUniqueSlug(baseSlug || 'untitled', id)
        }

        const page = await Page.findOneAndUpdate(
            { _id: id, user: userId, deleted: false },
            { $set: updateData },
            { new: true }
        ).lean()

        if (!page) return res.status(404).json({ alert: { variant: 'danger', message: 'Page not found' } })

        return res.status(200).json({
            result: page,
            alert: { variant: 'success', message: 'Page saved' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to update page' } })
    }
}

exports.deletePage = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await Page.findOneAndUpdate(
            { _id: id, user: userId, deleted: false },
            { $set: { deleted: true, deletedAt: new Date() } }
        )
        const pages = await Page.find({ user: userId, deleted: false })
            .select(PAGE_SELECT)
            .sort({ updatedAt: -1 })
            .lean()
        return res.status(200).json({
            result: pages,
            alert: { variant: 'success', message: 'Page moved to trash' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete page' } })
    }
}

exports.restorePage = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await Page.findOneAndUpdate(
            { _id: id, user: userId, deleted: true },
            { $set: { deleted: false, deletedAt: null } }
        )
        const pages = await Page.find({ user: userId, deleted: true })
            .select(PAGE_SELECT)
            .sort({ deletedAt: -1 })
            .lean()
        return res.status(200).json({
            result: pages,
            alert: { variant: 'success', message: 'Page restored' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to restore page' } })
    }
}

exports.permanentDelete = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await Page.findOneAndDelete({ _id: id, user: userId, deleted: true })
        const pages = await Page.find({ user: userId, deleted: true })
            .select(PAGE_SELECT)
            .sort({ deletedAt: -1 })
            .lean()
        return res.status(200).json({
            result: pages,
            alert: { variant: 'success', message: 'Page permanently deleted' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete page' } })
    }
}

exports.emptyTrash = async (req, res) => {
    try {
        const userId = req.token.id
        await Page.deleteMany({ user: userId, deleted: true })
        return res.status(200).json({
            result: [],
            alert: { variant: 'success', message: 'Trash emptied' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to empty trash' } })
    }
}

exports.togglePrivacy = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const page = await Page.findOne({ _id: id, user: userId, deleted: false })
        if (!page) return res.status(404).json({ alert: { variant: 'danger', message: 'Page not found' } })

        page.privacy = !page.privacy
        await page.save()

        const pages = await Page.find({ user: userId, deleted: false })
            .select(PAGE_SELECT)
            .sort({ updatedAt: -1 })
            .lean()
        return res.status(200).json({
            result: pages,
            alert: { variant: 'success', message: page.privacy ? 'Page set to private' : 'Page set to public' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to toggle privacy' } })
    }
}

exports.duplicatePage = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.body
        if (!id) return res.status(400).json({ alert: { variant: 'danger', message: 'Page ID is required' } })

        const original = await Page.findOne({ _id: id, user: userId }).lean()
        if (!original) return res.status(404).json({ alert: { variant: 'danger', message: 'Page not found' } })

        const baseSlug = generateSlug(original.title + ' copy')
        const slug = await ensureUniqueSlug(baseSlug)

        await new Page({
            user: userId,
            title: original.title + ' (Copy)',
            slug,
            description: original.description,
            status: 'draft',
            privacy: original.privacy,
            layout: original.layout,
            globalStyles: original.globalStyles,
        }).save()

        const pages = await Page.find({ user: userId, deleted: false })
            .select(PAGE_SELECT)
            .sort({ updatedAt: -1 })
            .lean()

        return res.status(200).json({
            result: pages,
            alert: { variant: 'success', message: 'Page duplicated' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to duplicate page' } })
    }
}

exports.getImages = async (req, res) => {
    try {
        const userId = req.token.id
        const images = await UserImage.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: images })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load images' } })
    }
}

exports.uploadImages = async (req, res) => {
    try {
        const userId = req.token.id
        const { images } = req.body
        if (!images?.length) return res.status(400).json({ alert: { variant: 'danger', message: 'No images provided' } })

        const docs = images.map(url => ({ user: userId, url, name: url.split('/').pop() || '' }))
        await UserImage.insertMany(docs)

        const all = await UserImage.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({
            result: all,
            alert: { variant: 'success', message: `${images.length} image(s) uploaded` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to upload images' } })
    }
}

exports.deleteImage = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await UserImage.findOneAndDelete({ _id: id, user: userId })

        const all = await UserImage.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({
            result: all,
            alert: { variant: 'success', message: 'Image removed' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to remove image' } })
    }
}
