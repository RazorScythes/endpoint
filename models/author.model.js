const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const authorSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref:'User'
    },
    name: { type: String },
    description: { type: String },
    type: { type: String },
    count: { 
        type: Number, 
        default: 0 
    }
},{
    timestamps: true,
    collection: "author"
})

const Author = mongoose.model('Author', authorSchema)

module.exports = Author