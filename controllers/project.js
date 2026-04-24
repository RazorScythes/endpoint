const Project = require('../models/project.model')
const Category = require('../models/category.model')
const User = require('../models/user.model')
const Comment = require('../models/comment.model')
const db = require('../plugins/database')
const { createNotification } = require('./notification')

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function attachCommentCounts(projects) {
    if (!projects || projects.length === 0) return projects
    const ids = projects.map(p => p._id)
    const counts = await Comment.aggregate([
        { $match: { parent_id: { $in: ids } } },
        { $group: { _id: '$parent_id', count: { $sum: 1 } } }
    ])
    const countMap = {}
    counts.forEach(c => { countMap[String(c._id)] = c.count })
    return projects.map(p => ({ ...p, commentCount: countMap[String(p._id)] || 0 }))
}

// ==================== USER PROJECTS ====================

exports.getUserProject = async (req, res) => {
    try {
        const { id } = req.body
        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== CATEGORIES ====================

exports.getAdminCategory = async (req, res) => {
    try {
        const categories = await Category.find({ type: 'project' }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: categories })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addCategory = async (req, res) => {
    try {
        const { id, name, image, description } = req.body
        if (!name) return res.status(400).json({ message: 'Category name is required', variant: 'danger' })

        const exists = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, type: 'project' })
        if (exists) return res.status(400).json({ message: 'Category already exists', variant: 'danger' })

        await new Category({ name, image: image || '', description: description || '', type: 'project', user: id }).save()
        const categories = await Category.find({ type: 'project' }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: categories, message: 'Category added successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.editCategory = async (req, res) => {
    try {
        const { category_id, name, image, description } = req.body
        if (!category_id || !name) return res.status(400).json({ message: 'Category ID and name are required', variant: 'danger' })

        const duplicate = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, type: 'project', _id: { $ne: category_id } })
        if (duplicate) return res.status(400).json({ message: 'Category name already exists', variant: 'danger' })

        await Category.findByIdAndUpdate(category_id, { $set: { name, image: image || '', description: description || '' } })
        const categories = await Category.find({ type: 'project' }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: categories, message: 'Category updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.removeCategory = async (req, res) => {
    try {
        const { category_id } = req.body
        if (!category_id) return res.status(400).json({ message: 'Category ID is required', variant: 'danger' })

        await Project.updateMany({ categories: category_id }, { $set: { categories: '' } })
        await Category.findByIdAndDelete(category_id)
        const categories = await Category.find({ type: 'project' }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: categories, message: 'Category removed successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== PROJECT CRUD ====================

exports.uploadProject = async (req, res) => {
    try {
        const { id, data } = req.body
        if (!id) return res.status(400).json({ message: 'User ID is required', variant: 'danger' })
        if (!data || !data.post_title) return res.status(400).json({ message: 'Title is required', variant: 'danger' })

        await new Project({ ...data, user: id }).save()
        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: projects, message: 'Project uploaded successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.editUserProject = async (req, res) => {
    try {
        const { id, data } = req.body
        if (!data._id) return res.status(400).json({ message: 'Project ID is required', variant: 'danger' })

        const isOwner = await Project.findOne({ _id: data._id, user: id })
        const isCollaborator = !isOwner ? await Project.findOne({ _id: data._id, 'collaborators.user': id, 'collaborators.role': 'editor' }) : null

        if (!isOwner && !isCollaborator) return res.status(403).json({ message: 'Not authorized', variant: 'danger' })

        await Project.findByIdAndUpdate(data._id, { $set: {
            featured_image: data.featured_image,
            post_title: data.post_title,
            date_start: data.date_start || null,
            date_end: data.date_end || null,
            created_for: data.created_for,
            categories: data.categories,
            privacy: data.privacy || false,
            access_key: data.access_key || [],
            documentation_link: data.documentation_link || '',
            tags: data.tags,
            content: data.content,
            status: data.status || 'draft',
            attachments: data.attachments || [],
            changelog: data.changelog || [],
        }})

        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: projects, message: 'Project updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.removeUserProject = async (req, res) => {
    try {
        const { id, project_id } = req.body
        if (!project_id) return res.status(400).json({ message: 'Project ID is required', variant: 'danger' })

        await Comment.deleteMany({ parent_id: project_id })
        await Project.findOneAndDelete({ _id: project_id, user: id })

        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: projects, message: 'Project removed successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.bulkDeleteProjects = async (req, res) => {
    try {
        const { id, project_ids } = req.body
        if (!project_ids || !Array.isArray(project_ids) || project_ids.length === 0) {
            return res.status(400).json({ message: 'No projects selected', variant: 'danger' })
        }

        await Comment.deleteMany({ parent_id: { $in: project_ids } })
        await Project.deleteMany({ _id: { $in: project_ids }, user: id })

        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: projects, message: `${project_ids.length} project(s) deleted`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.bulkUpdateProjects = async (req, res) => {
    try {
        const { id, project_ids, updates } = req.body
        if (!project_ids || !Array.isArray(project_ids) || project_ids.length === 0) {
            return res.status(400).json({ message: 'No projects selected', variant: 'danger' })
        }

        const allowed = {}
        if (updates.status) allowed.status = updates.status
        if (updates.categories !== undefined) allowed.categories = updates.categories

        await Project.updateMany({ _id: { $in: project_ids }, user: id }, { $set: allowed })

        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: projects, message: `${project_ids.length} project(s) updated`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== PROJECT READ ====================

exports.getProjectByID = async (req, res) => {
    try {
        const { id, access_key, userId } = req.body
        const project = await Project.findById(id)
            .populate({ path: 'user', select: 'username avatar' })
            .populate({ path: 'collaborators.user', select: 'username avatar' })
            .lean()
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger', notFound: true })

        if (project.privacy) {
            const isOwner = userId && String(project.user._id || project.user) === String(userId)
            const isCollab = userId && project.collaborators?.some(c => String(c.user?._id || c.user) === String(userId))
            if (!isOwner && !isCollab) {
                if (!access_key) {
                    return res.status(200).json({ message: 'This project is private', variant: 'danger', forbidden: 'private' })
                }
                const validKey = project.access_key?.find(k => k.key === access_key)
                if (!validKey) {
                    return res.status(200).json({ message: 'Invalid access key', variant: 'danger', forbidden: 'invalid_key' })
                }
            }
        }

        const commentCount = await Comment.countDocuments({ parent_id: project._id })
        project.commentCount = commentCount

        return res.status(200).json({ result: project })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.viewProject = async (req, res) => {
    try {
        const { projectId, uid } = req.body
        if (!projectId || !uid) return res.status(400).json({ message: 'Missing required fields', variant: 'danger' })

        const project = await Project.findByIdAndUpdate(
            projectId,
            { $addToSet: { views: uid } },
            { new: true }
        )
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger' })

        return res.status(200).json({ result: { views: project.views } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getCategory = async (req, res) => {
    try {
        const { type } = req.body
        const categories = await Category.find({ type: type || 'project' }).lean()

        const counts = await Project.aggregate([
            { $match: { categories: { $ne: '' }, privacy: { $ne: true } } },
            { $group: { _id: '$categories', count: { $sum: 1 } } }
        ])
        const countMap = {}
        counts.forEach(c => { countMap[c._id] = c.count })

        const result = categories.map(cat => ({
            ...cat,
            count: countMap[String(cat._id)] || 0
        }))

        return res.status(200).json({ result })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProjects = async (req, res) => {
    try {
        const { id } = req.body
        const query = id ? { user: id } : { privacy: { $ne: true } }
        let projects = await Project.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        projects = await attachCommentCounts(projects)
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProjectsByCategories = async (req, res) => {
    try {
        const { category } = req.body
        let projects = await Project.find({ categories: category, privacy: { $ne: true } })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        projects = await attachCommentCounts(projects)

        const tags = await Project.aggregate([
            { $match: { categories: category } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ])

        return res.status(200).json({ result: projects, tags })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProjectsBySearchKey = async (req, res) => {
    try {
        const { key } = req.body
        if (!key) return res.status(400).json({ message: 'Search key required', variant: 'danger' })

        const regex = new RegExp(escapeRegex(key), 'i')
        let projects = await Project.find({
            privacy: { $ne: true },
            $or: [
                { post_title: regex },
                { tags: regex },
                { created_for: regex }
            ]
        })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        projects = await attachCommentCounts(projects)

        const tags = await Project.aggregate([
            { $match: { $or: [{ post_title: regex }, { tags: regex }] } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ])

        return res.status(200).json({ result: projects, tags })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.projectCountTags = async (req, res) => {
    try {
        const tags = await Project.aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ])
        return res.status(200).json({ result: tags })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== RELATED PROJECTS ====================

exports.getRelatedProjects = async (req, res) => {
    try {
        const { projectId, tags, category } = req.body
        if (!projectId) return res.status(400).json({ message: 'Project ID required', variant: 'danger' })

        const or = []
        if (tags && tags.length > 0) or.push({ tags: { $in: tags } })
        if (category) or.push({ categories: category })

        const query = {
            _id: { $ne: projectId },
            privacy: { $ne: true },
        }
        if (or.length > 0) query.$or = or

        let projects = await Project.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean()

        projects = await attachCommentCounts(projects)
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== COMMENTS ====================

exports.getProjectComments = async (req, res) => {
    try {
        const { projectId } = req.body
        const comments = await db.getComments(projectId)
        return res.status(200).json({ result: comments })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadProjectComment = async (req, res) => {
    const existing = await Project.findById(req.body.parent_id)
    if (!existing) {
        return res.status(200).json({ alert: { variant: 'danger', message: 'Project not found' } })
    }

    try {
        const newComment = new Comment(req.body)
        await newComment.save()

        const comments = await db.getComments(req.body.parent_id)

        const io = req.app.get('io')
        io.to(`project:${req.body.parent_id}`).emit('project_comments_updated', { projectId: req.body.parent_id, comments })

        if (existing.user && req.body.user) {
            createNotification({
                recipientId: existing.user,
                senderId: req.body.user,
                type: 'comment',
                message: `commented on your project "${existing.title || 'Untitled'}"`,
                link: `/projects/${req.body.parent_id}`,
                referenceId: req.body.parent_id,
                referenceModel: 'Project',
                io
            })
        }

        res.status(200).json({
            result: comments,
            alert: { variant: 'success', message: 'Commented!' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateProjectComment = async (req, res) => {
    const { id, data } = req.body

    try {
        await Comment.findByIdAndUpdate(data._id, data, { new: true })

        const comments = await db.getComments(id)

        const io = req.app.get('io')
        io.to(`project:${id}`).emit('project_comments_updated', { projectId: id, comments })

        return res.status(200).json({ result: comments })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.removeProjectComment = async (req, res) => {
    const { id, project_id } = req.params

    try {
        if (!id) {
            return res.status(403).json({ alert: { variant: 'danger', message: 'Invalid parameter' } })
        }

        await Comment.findByIdAndDelete(id)

        const comments = await db.getComments(project_id)

        const io = req.app.get('io')
        io.to(`project:${project_id}`).emit('project_comments_updated', { projectId: project_id, comments })

        return res.status(200).json({
            result: comments,
            alert: { variant: 'warning', message: 'Deleted comment' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== LIKES / BOOKMARKS ====================

exports.toggleProjectLike = async (req, res) => {
    try {
        const { projectId, userId } = req.body
        if (!projectId || !userId) return res.status(400).json({ message: 'Missing data', variant: 'danger' })

        const project = await Project.findById(projectId)
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger' })

        const idx = project.likes.indexOf(userId)
        if (idx === -1) {
            project.likes.push(userId)
        } else {
            project.likes.splice(idx, 1)
        }
        await project.save()

        return res.status(200).json({ result: project.likes })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.toggleBookmark = async (req, res) => {
    try {
        const { projectId, userId } = req.body
        if (!projectId || !userId) return res.status(400).json({ message: 'Missing data', variant: 'danger' })

        const project = await Project.findById(projectId)
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger' })

        const idx = project.bookmarks.findIndex(b => String(b) === String(userId))
        if (idx === -1) {
            project.bookmarks.push(userId)
        } else {
            project.bookmarks.splice(idx, 1)
        }
        await project.save()

        return res.status(200).json({ result: project.bookmarks, bookmarked: idx === -1 })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getBookmarkedProjects = async (req, res) => {
    try {
        const { userId } = req.body
        if (!userId) return res.status(400).json({ message: 'User ID required', variant: 'danger' })

        let projects = await Project.find({ bookmarks: userId, privacy: { $ne: true } })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

        projects = await attachCommentCounts(projects)
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== COLLABORATORS ====================

exports.addCollaborator = async (req, res) => {
    try {
        const { id, project_id, targetUserId, role } = req.body
        if (!project_id || !targetUserId) return res.status(400).json({ message: 'Project ID and user ID required', variant: 'danger' })

        const project = await Project.findOne({ _id: project_id, user: id })
        if (!project) return res.status(404).json({ message: 'Project not found or not owner', variant: 'danger' })

        const existing = project.collaborators.find(c => String(c.user) === String(targetUserId))
        if (existing) return res.status(400).json({ message: 'User is already a collaborator', variant: 'danger' })

        project.collaborators.push({ user: targetUserId, role: role || 'viewer' })
        await project.save()

        const updated = await Project.findById(project_id).populate({ path: 'collaborators.user', select: 'username avatar' }).lean()
        return res.status(200).json({ result: updated.collaborators, message: 'Collaborator added', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.removeCollaborator = async (req, res) => {
    try {
        const { id, project_id, targetUserId } = req.body
        if (!project_id || !targetUserId) return res.status(400).json({ message: 'Project ID and user ID required', variant: 'danger' })

        await Project.findOneAndUpdate(
            { _id: project_id, user: id },
            { $pull: { collaborators: { user: targetUserId } } }
        )

        const updated = await Project.findById(project_id).populate({ path: 'collaborators.user', select: 'username avatar' }).lean()
        return res.status(200).json({ result: updated?.collaborators || [], message: 'Collaborator removed', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== ANALYTICS ====================

exports.getProjectAnalytics = async (req, res) => {
    try {
        const { project_id, id } = req.body
        if (!project_id) return res.status(400).json({ message: 'Project ID required', variant: 'danger' })

        const project = await Project.findOne({ _id: project_id, $or: [{ user: id }, { 'collaborators.user': id }] }).lean()
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger' })

        const commentCount = await Comment.countDocuments({ parent_id: project_id })

        return res.status(200).json({
            result: {
                views: project.views?.length || 0,
                likes: project.likes?.length || 0,
                bookmarks: project.bookmarks?.length || 0,
                comments: commentCount,
                status: project.status,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== LATEST ====================

exports.getLatestProjects = async (req, res) => {
    try {
        let projects = await Project.find({ privacy: { $ne: true } })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()

        projects = await attachCommentCounts(projects)
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}
