const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const commentSchema = new Schema({
    parent_id: {
        type: Schema.Types.ObjectId,
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref:'User'
    },
    text: { type: String },
    type: { type: String },
    likes: { type: Array },
    dislikes: { type: Array },
    replies: { type: Array },
    timestamp: { type: String },
},{
    timestamps: true,
    collection: "comments"
})

const Comment = mongoose.model('Comment', commentSchema)

module.exports = Comment