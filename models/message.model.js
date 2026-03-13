const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        default: ''
    },
    fileUrl: {
        type: String
    },
    fileName: {
        type: String
    },
    fileType: {
        type: String
    },
    read: {
        type: Boolean,
        default: false
    },
    deletedBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
},{
    timestamps: true
})

schema.index({ conversation: 1, createdAt: -1 })

const model = mongoose.model('Message', schema)

module.exports = model
