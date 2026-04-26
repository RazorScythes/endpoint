const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    community: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    reason: { type: String, default: '' },
    bannedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
}, { timestamps: true })

schema.index({ user: 1, community: 1 }, { unique: true })
schema.index({ community: 1 })

const model = mongoose.model('CommunityBan', schema)
module.exports = model
