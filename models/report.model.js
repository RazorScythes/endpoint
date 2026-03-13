const mongoose = require('mongoose')
const Schema = mongoose.Schema

const schema = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content_id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['video', 'comment'],
        default: 'video'
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    reason: {
        type: String,
        enum: ['Non consensual', 'Spammer', 'Child Pornography', 'Underage', 'Nevermind', 'Not Appropriate', 'Other'],
        default: 'Other'
    },
    details: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending'
    }
}, {
    timestamps: true
})

schema.index({ user: 1, createdAt: -1 })

const model = mongoose.model('Report', schema)

module.exports = model
