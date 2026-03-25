const Portfolio = require('../models/portfolio.model')
const User = require('../models/user.model')

const getOrCreatePortfolio = async (userId) => {
    let portfolio = await Portfolio.findOne({ user: userId })
    if (!portfolio) {
        portfolio = await new Portfolio({ user: userId }).save()
    }
    return portfolio
}

exports.getPortfolio = async (req, res) => {
    try {
        const id = req.token.id
        const portfolio = await getOrCreatePortfolio(id)
        return res.status(200).json({ result: portfolio })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getPortfolioByUsername = async (req, res) => {
    try {
        const { username } = req.body
        const user = await User.findOne({ username })
        if (!user) return res.status(404).json({ message: 'User not found', variant: 'danger' })

        const portfolio = await Portfolio.findOne({ user: user._id })
        if (!portfolio) return res.status(404).json({ message: 'Portfolio not found', variant: 'danger' })

        return res.status(200).json({ result: portfolio, published: portfolio.published })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadHero = async (req, res) => {
    try {
        const id = req.token.id
        const { image, full_name, description, profession, animation, social_links, resume_link } = req.body

        const updateFields = {
            'hero.full_name': full_name,
            'hero.description': description,
            'hero.profession': profession,
            'hero.animation': animation,
            'hero.social_links': social_links,
            'hero.resume_link': resume_link,
        }

        if (image) updateFields['hero.image'] = image

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: updateFields },
            { new: true, upsert: true }
        )

        return res.status(200).json({ result: updated, alert: 'Hero updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadSkills = async (req, res) => {
    try {
        const id = req.token.id
        const { image, heading, description, skill, project_completed, icons, removed_icons } = req.body

        const updateFields = {
            'skills.heading': heading,
            'skills.description': description,
            'skills.skill': skill,
            'skills.project_completed': project_completed,
        }

        if (image) updateFields['skills.image'] = image
        if (icons) updateFields['skills.icons'] = icons

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: updateFields },
            { new: true, upsert: true }
        )

        return res.status(200).json({ result: updated, alert: 'Skills updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadServices = async (req, res) => {
    try {
        const id = req.token.id
        const { services } = req.body

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: { services } },
            { new: true, upsert: true }
        )

        return res.status(200).json({ result: updated, alert: 'Services updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addExperience = async (req, res) => {
    try {
        const id = req.token.id
        const { image_overlay, company_logo, company_name, year_start, year_end, position, company_location, remote_work, link } = req.body

        const entry = { image_overlay, company_logo, company_name, year_start, year_end, position, company_location, remote_work, link }

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $push: { experience: entry } },
            { new: true, upsert: true }
        )

        return res.status(200).json({ result: updated, alert: 'Experience added successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateExperience = async (req, res) => {
    try {
        const id = req.token.id
        const { data } = req.body

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: { experience: data } },
            { new: true }
        )

        return res.status(200).json({ result: updated, alert: 'Experience updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.addProject = async (req, res) => {
    try {
        const id = req.token.id
        const { image, show_image, project_name, project_description, date_started, date_accomplished, created_for, category, text, list, gallery } = req.body

        const entry = { image, show_image, project_name, project_description, date_started, date_accomplished, created_for, category, text: text || [], list: list || [], gallery: gallery || [] }

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $push: { projects: entry } },
            { new: true, upsert: true }
        )

        return res.status(200).json({ result: updated, alert: 'Project added successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateProject = async (req, res) => {
    try {
        const id = req.token.id
        const { data } = req.body

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: { projects: data } },
            { new: true }
        )

        return res.status(200).json({ result: updated, alert: 'Project updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteProject = async (req, res) => {
    try {
        const id = req.token.id
        const { data } = req.body

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: { projects: data } },
            { new: true }
        )

        return res.status(200).json({ result: updated, alert: 'Project removed successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.uploadContacts = async (req, res) => {
    try {
        const id = req.token.id
        const { email, subject } = req.body

        const updated = await Portfolio.findOneAndUpdate(
            { user: id },
            { $set: { 'contact.email': email, 'contact.subject': subject } },
            { new: true, upsert: true }
        )

        return res.status(200).json({ result: updated, alert: 'Contact updated successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.testEmail = async (req, res) => {
    try {
        const { email } = req.body
        return res.status(200).json({ alert: `Test email would be sent to ${email}`, variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.sendEmail = async (req, res) => {
    try {
        return res.status(200).json({ mailStatus: 'sent' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ mailStatus: 'failed' })
    }
}

exports.sendContactUs = async (req, res) => {
    try {
        return res.status(200).json({ mailStatus: 'sent' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ mailStatus: 'failed' })
    }
}

exports.publishPortfolio = async (req, res) => {
    try {
        const id = req.token.id
        const updated = await Portfolio.findOneAndUpdate({ user: id }, { $set: { published: true } }, { new: true })
        return res.status(200).json({ result: updated, alert: 'Portfolio published successfully', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.unpublishPortfolio = async (req, res) => {
    try {
        const id = req.token.id
        const updated = await Portfolio.findOneAndUpdate({ user: id }, { $set: { published: false } }, { new: true })
        return res.status(200).json({ result: updated, alert: 'Portfolio unpublished', variant: 'success' })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getProject = async (req, res) => {
    try {
        const { project_name, username } = req.body
        const user = await User.findOne({ username })
        if (!user) return res.status(404).json({ message: 'User not found', variant: 'danger' })

        const portfolio = await Portfolio.findOne({ user: user._id })
        if (!portfolio) return res.status(404).json({ message: 'Portfolio not found', variant: 'danger' })

        const projectItem = portfolio.projects.find(p =>
            p.project_name.split(/[\/\s]+/).join("_") === project_name
        )

        if (!projectItem) return res.status(404).json({ message: 'Project not found', variant: 'danger' })

        return res.status(200).json({ result: projectItem, published: portfolio.published })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}
