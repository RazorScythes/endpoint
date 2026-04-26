const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    banner: { type: String, default: '' },
    icon: { type: String, default: '' },
    rules: [{ title: { type: String }, description: { type: String } }],
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    moderators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    memberCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    inviteCode: { type: String, default: '' },
    tags: [{ type: String }],
}, { timestamps: true })

schema.index({ slug: 1 })
schema.index({ inviteCode: 1 }, { sparse: true })
schema.index({ name: 'text', description: 'text' })
schema.index({ memberCount: -1 })
schema.index({ creator: 1 })

const model = mongoose.model('Community', schema)
module.exports = model
