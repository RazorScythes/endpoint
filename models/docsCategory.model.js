const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const docCategorySchema = new Schema({
    docs: {
        type: Schema.Types.ObjectId,
        ref:'Docs'
    },
    name: { type: String },
    path: { type: String }
},{
    timestamps: true,
    collection: "docsCategory"
})

const DocsCategory = mongoose.model('DocsCategory', docCategorySchema)

module.exports = DocsCategory