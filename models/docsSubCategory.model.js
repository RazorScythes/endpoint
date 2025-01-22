const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const docsSubCategorySchema = new Schema({
    category: {
        type: Schema.Types.ObjectId,
        ref:'DocsCategory'
    },
    name: { type: String },
    path: { type: String },
    method: { type: String },
    description: { type: String },
    endpoint: { type: String },
    token_required: { type: Boolean },
    payload: { type: Array },
    type: { type: String },
    auto_response: { type: Boolean },
    response_result: { type: String }
},{
    timestamps: true,
    collection: "docsSubCategory"
})

const DocsSubCategory = mongoose.model('DocsSubCategory', docsSubCategorySchema)

module.exports = DocsSubCategory