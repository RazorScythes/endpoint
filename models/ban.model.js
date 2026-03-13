const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bannedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    permanent: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        default: null
    },
    reason: {
        type: String,
        default: ''
    }
},{
    timestamps: true
})

schema.index({ user: 1 }, { unique: true })
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const model = mongoose.model('Ban', schema)

module.exports = model
