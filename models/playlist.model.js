const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    videos: [{
        type: Schema.Types.ObjectId,
        ref: 'Video'
    }],
    privacy: { type: Boolean, default: false },
},{
    timestamps: true
})

schema.index({ user: 1, createdAt: -1 })

const model = mongoose.model('Playlist', schema)

module.exports = model
