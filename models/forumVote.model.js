const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: Schema.Types.ObjectId, required: true },
    targetModel: { type: String, enum: ['ForumPost', 'ForumComment'], required: true },
    value: { type: Number, enum: [-1, 1], required: true },
}, { timestamps: true })

schema.index({ user: 1, target: 1 }, { unique: true })
schema.index({ target: 1 })

const model = mongoose.model('ForumVote', schema)
module.exports = model
