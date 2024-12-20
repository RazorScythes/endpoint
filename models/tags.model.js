const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const tagsSchema = new Schema({
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
    },
    strict: { type: Boolean },
},{
    timestamps: true,
    collection: "taglist"
})

const Tags = mongoose.model('Tags', tagsSchema)

module.exports = Tags