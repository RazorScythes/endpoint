const mongoose = require('mongoose')
const Schema = mongoose.Schema

const pageSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    privacy: { type: Boolean, default: false },
    layout: { type: Schema.Types.Mixed, default: [] },
    globalStyles: { type: Schema.Types.Mixed, default: {} },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
}, {
    timestamps: true,
    collection: 'pages'
})

pageSchema.index({ user: 1, createdAt: -1 })
pageSchema.index({ slug: 1 }, { unique: true })
pageSchema.index({ deleted: 1, deletedAt: 1 })

module.exports = mongoose.model('Page', pageSchema)
