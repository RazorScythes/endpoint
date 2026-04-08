const Project = require('../models/project.model')
const Category = require('../models/category.model')
const User = require('../models/user.model')
const Comment = require('../models/comment.model')
const db = require('../plugins/database')

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

        const exists = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, type: 'project' })
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

        const duplicate = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, type: 'project', _id: { $ne: category_id } })
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

        await Category.findByIdAndDelete(category_id)
        const categories = await Category.find({ type: 'project' }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: categories, message: 'Category removed successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

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

        await Project.findOneAndUpdate(
            { _id: data._id, user: id },
            { $set: {
                featured_image: data.featured_image,
                post_title: data.post_title,
                date_start: data.date_start,
                date_end: data.date_end,
                created_for: data.created_for,
                categories: data.categories,
                privacy: data.privacy || false,
                access_key: data.access_key || [],
                documentation_link: data.documentation_link || '',
                tags: data.tags,
                content: data.content
            }}
        )

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
        await Project.findOneAndDelete({ _id: project_id, user: id })

        const projects = await Project.find({ user: id }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: projects, message: 'Project removed successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProjectByID = async (req, res) => {
    try {
        const { id, access_key, userId } = req.body
        const project = await Project.findById(id)
            .populate({ path: 'user', select: 'username avatar' })
            .lean()
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger', notFound: true })

        if (project.privacy) {
            const isOwner = userId && String(project.user._id || project.user) === String(userId)
            if (!isOwner) {
                if (!access_key) {
                    return res.status(200).json({ message: 'This project is private', variant: 'danger', forbiden: 'private' })
                }
                const validKey = project.access_key?.find(k => k.key === access_key)
                if (!validKey) {
                    return res.status(200).json({ message: 'Invalid access key', variant: 'danger', forbiden: 'invalid_key' })
                }
            }
        }

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
        const projects = await Project.find(query)
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProjectsByCategories = async (req, res) => {
    try {
        const { category } = req.body
        const projects = await Project.find({ categories: category, privacy: { $ne: true } })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .lean()

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

        const regex = new RegExp(key, 'i')
        const projects = await Project.find({
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

exports.getLatestProjects = async (req, res) => {
    try {
        const projects = await Project.find({ privacy: { $ne: true } })
            .populate({ path: 'user', select: 'username avatar' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()
        return res.status(200).json({ result: projects })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}
