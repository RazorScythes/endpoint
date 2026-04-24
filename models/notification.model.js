const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
        type: String,
        enum: ['like', 'comment', 'reply', 'subscribe', 'mention', 'system'],
        required: true
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: { type: String, default: '' },
    referenceId: { type: Schema.Types.ObjectId },
    referenceModel: {
        type: String,
        enum: ['Video', 'Game', 'Project', 'Comment', 'User', '']
    },
}, {
    timestamps: true
})

schema.index({ recipient: 1, createdAt: -1 })
schema.index({ recipient: 1, read: 1 })

const model = mongoose.model('Notification', schema)

module.exports = model
