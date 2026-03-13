const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    blocker: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    blocked: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
},{
    timestamps: true
})

schema.index({ blocker: 1, blocked: 1 }, { unique: true })
schema.index({ blocker: 1 })

const model = mongoose.model('BlockedUser', schema)

module.exports = model
