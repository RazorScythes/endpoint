const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    community: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    tags: [{ type: String }],
    images: [{ type: String }],
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    score: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
}, { timestamps: true })

schema.index({ community: 1, createdAt: -1 })
schema.index({ author: 1 })
schema.index({ score: -1 })
schema.index({ title: 'text', content: 'text' })
schema.index({ tags: 1 })

const model = mongoose.model('ForumPost', schema)
module.exports = model
