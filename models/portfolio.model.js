const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    published: { type: Boolean, default: false },
    hero: {
        image: { type: String, default: '' },
        full_name: { type: String, default: '' },
        description: { type: String, default: '' },
        profession: [{ type: String }],
        animation: { type: Boolean, default: true },
        resume_link: { type: String, default: '' },
        social_links: {
            facebook: { link: { type: String, default: '' }, show: { type: Boolean, default: false } },
            twitter: { link: { type: String, default: '' }, show: { type: Boolean, default: false } },
            instagram: { link: { type: String, default: '' }, show: { type: Boolean, default: false } },
            github: { link: { type: String, default: '' }, show: { type: Boolean, default: false } },
            linkedin: { link: { type: String, default: '' }, show: { type: Boolean, default: false } },
        }
    },
    skills: {
        image: { type: String, default: '' },
        heading: { type: String, default: '' },
        description: { type: String, default: '' },
        project_completed: { type: Number, default: 0 },
        icons: [{ type: String }],
        skill: [{
            skill_name: { type: String },
            percentage: { type: Number },
            hex: { type: String }
        }]
    },
    services: [{
        service_name: { type: String },
        type_of_service: [{
            featured_icon: { type: String },
            service_name: { type: String },
            service_description: { type: String }
        }]
    }],
    experience: [{
        image_overlay: { type: String, default: '' },
        company_logo: { type: String, default: '' },
        company_name: { type: String },
        year_start: { type: String },
        year_end: { type: String },
        position: { type: String },
        company_location: { type: String },
        remote_work: { type: Boolean, default: false },
        link: { type: String, default: '' }
    }],
    projects: [{
        image: { type: String, default: '' },
        show_image: { type: Boolean, default: true },
        project_name: { type: String },
        project_description: { type: String },
        date_started: { type: String },
        date_accomplished: { type: String },
        created_for: { type: String },
        category: { type: String },
        text: [{
            text_heading: { type: String },
            text_imageURL: { type: String },
            text_description: { type: String }
        }],
        list: [{ type: Schema.Types.Mixed }],
        gallery: [{ type: String }]
    }],
    contact: {
        email: { type: String, default: '' },
        subject: [{ type: String }]
    }
}, { timestamps: true })

const model = mongoose.model('Portfolio', schema)

module.exports = model
