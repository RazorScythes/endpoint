const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'ForumComment', default: null },
    depth: { type: Number, default: 0 },
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    score: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true })

schema.index({ post: 1, createdAt: -1 })
schema.index({ parent: 1 })
schema.index({ author: 1 })

const model = mongoose.model('ForumComment', schema)
module.exports = model
