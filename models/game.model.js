const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    featured_image: { type: String, default: '' },
    title: { type: String, required: true },
    category: { type: String, default: 'Simulation' },
    description: { type: String, default: '' },
    strict: { type: Boolean, default: false },
    privacy: { type: Boolean, default: false },
    landscape: { type: Boolean, default: false },
    carousel: { type: Boolean, default: false },
    tags: [{ type: String }],
    details: {
        latest_version: { type: String, default: '' },
        censorship: { type: String, default: 'Uncensored' },
        language: { type: String, default: 'English' },
        developer: { type: String, default: '' },
        platform: { type: String, default: 'Desktop' }
    },
    leave_uploader_message: { type: String, default: '' },
    gallery: [{ type: String }],
    access_key: [{
        key: { type: String },
        download_limit: { type: Number, default: 0 },
        user_downloaded: [{ type: Schema.Types.Mixed }]
    }],
    download_link: [{
        storage_name: { type: String },
        links: [{ type: String }]
    }],
    guide_link: { type: String, default: '' },
    password: { type: String, default: '' },
    ratings: [{
        user: { type: Schema.Types.Mixed },
        rating: { type: Number, default: 0 }
    }],
    views: [{ type: Schema.Types.Mixed }],
    likes: [{ type: Schema.Types.Mixed }],
    dislikes: [{ type: Schema.Types.Mixed }],
    download_count: [{ type: Schema.Types.Mixed }],
    deleted_at: { type: Date, default: null },
    comments: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        avatar: { type: String },
        message: { type: String },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true })

const model = mongoose.model('Game', schema)

module.exports = model
