const mongoose = require('mongoose')
const Schema = mongoose.Schema

const userImageSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    url: { type: String, required: true },
    name: { type: String, default: '' },
}, {
    timestamps: true,
    collection: 'userImages'
})

userImageSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('UserImage', userImageSchema)
