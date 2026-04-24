const mongoose = require('mongoose')
const Schema = mongoose.Schema

const projectSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    featured_image: { type: String, default: '' },
    post_title: { type: String, required: true },
    date_start: { type: Date, default: null },
    date_end: { type: Date, default: null },
    created_for: { type: String, default: 'Personal' },
    categories: { type: String, default: '' },
    privacy: { type: Boolean, default: false },
    access_key: [{
        key: { type: String },
        download_limit: { type: Number, default: 0 },
        user_downloaded: [{ type: Schema.Types.Mixed }]
    }],
    documentation_link: { type: String, default: '' },
    tags: [{ type: String }],
    content: [{ type: Schema.Types.Mixed }],
    views: [{ type: String }],
    likes: [{ type: String }],
    bookmarks: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['draft', 'in-progress', 'completed', 'archived'], default: 'draft' },
    collaborators: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['editor', 'viewer'], default: 'viewer' }
    }],
    attachments: [{
        name: { type: String },
        url: { type: String },
        type: { type: String },
        size: { type: Number, default: 0 }
    }],
    changelog: [{
        version: { type: String },
        date: { type: Date, default: Date.now },
        description: { type: String }
    }],
    comment: [{
        user_id: { type: Schema.Types.ObjectId, ref: 'User' },
        text: { type: String },
        date: { type: Date, default: Date.now },
        replies: [{
            user_id: { type: Schema.Types.ObjectId, ref: 'User' },
            text: { type: String },
            date: { type: Date, default: Date.now }
        }]
    }]
}, {
    timestamps: true,
    collection: 'projects'
})

module.exports = mongoose.model('Project', projectSchema)
