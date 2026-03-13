const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    },
    deletedBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
},{
    timestamps: true
})

schema.index({ participants: 1 })

const model = mongoose.model('Conversation', schema)

module.exports = model
