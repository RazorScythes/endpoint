const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['auth', 'profile', 'video', 'group', 'tag', 'category', 'author', 'settings', 'docs', 'account'],
        default: 'account'
    },
    message: { type: String, required: true },
    method: { 
        type: String, 
        enum: ['GET', 'POST', 'PATCH', 'DELETE'],
        default: 'POST'
    },
    ip_address: { type: String },
    user_agent: { type: String },
},{
    timestamps: true
})

schema.index({ user: 1, createdAt: -1 })

const model = mongoose.model('ActivityLog', schema)

module.exports = model
