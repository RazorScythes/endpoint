const Project = require('../models/project.model')
const Category = require('../models/category.model')
const User = require('../models/user.model')

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
        const { id, name, image } = req.body
        if (!name) return res.status(400).json({ message: 'Category name is required', variant: 'danger' })

        const exists = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, type: 'project' })
        if (exists) return res.status(400).json({ message: 'Category already exists', variant: 'danger' })

        await new Category({ name, image: image || '', type: 'project', user: id }).save()
        const categories = await Category.find({ type: 'project' }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: categories, message: 'Category added successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.editCategory = async (req, res) => {
    try {
        const { category_id, name, image } = req.body
        if (!category_id || !name) return res.status(400).json({ message: 'Category ID and name are required', variant: 'danger' })

        const duplicate = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, type: 'project', _id: { $ne: category_id } })
        if (duplicate) return res.status(400).json({ message: 'Category name already exists', variant: 'danger' })

        await Category.findByIdAndUpdate(category_id, { $set: { name, image: image || '' } })
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
        const { id } = req.body
        const project = await Project.findById(id)
            .populate({ path: 'user', select: 'username avatar' })
            .lean()
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger', notFound: true })

        return res.status(200).json({ result: project })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getCategory = async (req, res) => {
    try {
        const { type } = req.body
        const categories = await Category.find({ type: type || 'project' }).lean()
        return res.status(200).json({ result: categories })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProjects = async (req, res) => {
    try {
        const { id } = req.body
        const query = id ? { user: id } : {}
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
        const projects = await Project.find({ categories: category })
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
        const { id } = req.body
        const project = await Project.findById(id)
            .populate({ path: 'comment.user_id', select: 'username avatar' })
            .populate({ path: 'comment.replies.user_id', select: 'username avatar' })
            .lean()
        if (!project) return res.status(404).json({ message: 'Project not found', variant: 'danger' })

        return res.status(200).json({ comments: project.comment || [] })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadProjectComment = async (req, res) => {
    try {
        const { id, user_id, text } = req.body
        if (!text) return res.status(400).json({ message: 'Comment text required', variant: 'danger' })

        await Project.findByIdAndUpdate(id, {
            $push: { comment: { user_id, text, date: new Date() } }
        })

        const project = await Project.findById(id)
            .populate({ path: 'comment.user_id', select: 'username avatar' })
            .populate({ path: 'comment.replies.user_id', select: 'username avatar' })
            .lean()

        return res.status(200).json({ comments: project.comment || [] })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.removeProjectComment = async (req, res) => {
    try {
        const { id, comment_id } = req.body
        await Project.findByIdAndUpdate(id, {
            $pull: { comment: { _id: comment_id } }
        })

        const project = await Project.findById(id)
            .populate({ path: 'comment.user_id', select: 'username avatar' })
            .populate({ path: 'comment.replies.user_id', select: 'username avatar' })
            .lean()

        return res.status(200).json({ comments: project?.comment || [] })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getLatestProjects = async (req, res) => {
    try {
        const projects = await Project.find()
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
