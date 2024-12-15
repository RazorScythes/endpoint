const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const categorySchema = new Schema({
    image: { type: String },
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
    strict: { type: Boolean }
},{
    timestamps: true,
    collection: "category"
})

const Category = mongoose.model('Category', categorySchema)

module.exports = Category