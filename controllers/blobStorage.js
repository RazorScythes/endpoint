const { list, del } = require('@vercel/blob')
const mongoose = require('mongoose')

const User = require('../models/user.model')
const Video = require('../models/video.model')
const Game = require('../models/game.model')
const Project = require('../models/project.model')
const Community = require('../models/community.model')
const ForumPost = require('../models/forumPost.model')
const Page = require('../models/page.model')
const Category = require('../models/category.model')
const Portfolio = require('../models/portfolio.model')
const UserImage = require('../models/userImage.model')
const MapDefinition = require('../models/mapEditor.model')
const Message = require('../models/message.model')

const collectUrlsFromDoc = (doc, fields) => {
    const urls = []
    for (const f of fields) {
        const val = doc[f]
        if (!val) continue
        if (typeof val === 'string' && val.startsWith('http')) urls.push(val)
        if (Array.isArray(val)) {
            for (const item of val) {
                if (typeof item === 'string' && item.startsWith('http')) urls.push(item)
                if (item?.url && typeof item.url === 'string') urls.push(item.url)
                if (item?.image && typeof item.image === 'string') urls.push(item.image)
            }
        }
        if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
            if (val.image && typeof val.image === 'string') urls.push(val.image)
            if (val.url && typeof val.url === 'string') urls.push(val.url)
        }
    }
    return urls
}

const getAllReferencedUrls = async () => {
    const urls = new Set()

    const users = await User.find({}, 'avatar').lean()
    users.forEach(d => { if (d.avatar) urls.add(d.avatar) })

    const videos = await Video.find({}, 'thumbnail thumbnailLink').lean()
    videos.forEach(d => {
        if (d.thumbnail) urls.add(d.thumbnail)
        if (d.thumbnailLink) urls.add(d.thumbnailLink)
    })

    const games = await Game.find({}, 'featured_image gallery').lean()
    games.forEach(d => {
        collectUrlsFromDoc(d, ['featured_image', 'gallery']).forEach(u => urls.add(u))
    })

    const projects = await Project.find({}, 'featured_image attachments').lean()
    projects.forEach(d => {
        collectUrlsFromDoc(d, ['featured_image', 'attachments']).forEach(u => urls.add(u))
    })

    const communities = await Community.find({}, 'banner icon').lean()
    communities.forEach(d => {
        if (d.banner) urls.add(d.banner)
        if (d.icon) urls.add(d.icon)
    })

    const forumPosts = await ForumPost.find({}, 'images').lean()
    forumPosts.forEach(d => {
        if (d.images?.length) d.images.forEach(u => { if (u) urls.add(u) })
    })

    const pages = await Page.find({}, 'thumbnail').lean()
    pages.forEach(d => { if (d.thumbnail) urls.add(d.thumbnail) })

    const categories = await Category.find({}, 'image').lean()
    categories.forEach(d => { if (d.image) urls.add(d.image) })

    const portfolios = await Portfolio.find({}, 'hero skills services experience projects').lean()
    portfolios.forEach(d => {
        collectUrlsFromDoc(d, ['hero', 'skills', 'services', 'experience', 'projects']).forEach(u => urls.add(u))
    })

    const userImages = await UserImage.find({}, 'url').lean()
    userImages.forEach(d => { if (d.url) urls.add(d.url) })

    const maps = await MapDefinition.find({}, 'spriteAssets').lean()
    maps.forEach(d => {
        if (d.spriteAssets?.length) {
            d.spriteAssets.forEach(a => { if (a.url) urls.add(a.url) })
        }
    })

    const messages = await Message.find({ fileUrl: { $exists: true, $ne: '' } }, 'fileUrl').lean()
    messages.forEach(d => { if (d.fileUrl) urls.add(d.fileUrl) })

    return urls
}

exports.listBlobs = async (req, res) => {
    try {
        const { cursor, limit = 100, prefix } = req.query
        const opts = { limit: Math.min(Number(limit), 1000) }
        if (cursor) opts.cursor = cursor
        if (prefix) opts.prefix = prefix

        const result = await list(opts)

        res.json({
            result: {
                blobs: result.blobs,
                cursor: result.cursor,
                hasMore: result.hasMore,
            }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getBlobStats = async (req, res) => {
    try {
        const allBlobs = []
        let cursor = undefined

        do {
            const opts = { limit: 1000 }
            if (cursor) opts.cursor = cursor
            const result = await list(opts)
            allBlobs.push(...result.blobs)
            cursor = result.hasMore ? result.cursor : undefined
        } while (cursor)

        const totalSize = allBlobs.reduce((sum, b) => sum + (b.size || 0), 0)
        const totalCount = allBlobs.length

        const byType = {}
        for (const b of allBlobs) {
            const ext = (b.pathname?.split('.').pop() || 'unknown').toLowerCase()
            if (!byType[ext]) byType[ext] = { count: 0, size: 0 }
            byType[ext].count += 1
            byType[ext].size += b.size || 0
        }

        const storageLimitMB = parseInt(process.env.BLOB_STORAGE_LIMIT_MB || '500', 10)
        const storageLimit = storageLimitMB * 1024 * 1024
        const remaining = Math.max(0, storageLimit - totalSize)
        const usagePercent = storageLimit > 0 ? Math.min(100, (totalSize / storageLimit) * 100) : 0

        res.json({
            result: { totalSize, totalCount, byType, storageLimit, remaining, usagePercent: Math.round(usagePercent * 10) / 10 }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getUnusedBlobs = async (req, res) => {
    try {
        const allBlobs = []
        let cursor = undefined

        do {
            const opts = { limit: 1000 }
            if (cursor) opts.cursor = cursor
            const result = await list(opts)
            allBlobs.push(...result.blobs)
            cursor = result.hasMore ? result.cursor : undefined
        } while (cursor)

        const referencedUrls = await getAllReferencedUrls()

        const unused = allBlobs.filter(b => !referencedUrls.has(b.url))

        res.json({
            result: {
                unused: unused.map(b => ({
                    url: b.url,
                    pathname: b.pathname,
                    size: b.size,
                    uploadedAt: b.uploadedAt,
                    contentType: b.contentType,
                })),
                totalBlobs: allBlobs.length,
                usedCount: allBlobs.length - unused.length,
                unusedCount: unused.length,
            }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.deleteBlobs = async (req, res) => {
    try {
        const { urls } = req.body
        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ alert: { message: 'No URLs provided', variant: 'danger' } })
        }

        if (urls.length > 500) {
            return res.status(400).json({ alert: { message: 'Max 500 blobs per request', variant: 'danger' } })
        }

        const results = { deleted: 0, failed: 0, errors: [] }

        const batchSize = 50
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize)
            const promises = batch.map(async (url) => {
                try {
                    await del(url)
                    results.deleted += 1
                } catch (e) {
                    results.failed += 1
                    results.errors.push({ url, error: e.message })
                }
            })
            await Promise.all(promises)
        }

        res.json({
            result: results,
            alert: { message: `Deleted ${results.deleted} blob(s)${results.failed ? `, ${results.failed} failed` : ''}`, variant: results.failed ? 'warning' : 'success' }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}
