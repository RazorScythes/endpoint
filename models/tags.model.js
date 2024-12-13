const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const tagsSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref:'User'
    },
    name: { type: String },
    type: { type: String },
    count: { 
        type: Number, 
        default: 0 
    }
},{
    timestamps: true,
    collection: "taglist"
})

const Tags = mongoose.model('Tags', tagsSchema)

module.exports = Tags