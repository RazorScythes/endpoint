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
    response_result: { type: String },
    headers: { type: Array, default: [] },
    parameters: { type: Array, default: [] },
    status_codes: { type: Array, default: [] },
    content_type: { type: String, default: 'application/json' },
    notes: { type: String, default: '' },
    deprecated: { type: Boolean, default: false }
},{
    timestamps: true,
    collection: "docsSubCategory"
})

const DocsSubCategory = mongoose.model('DocsSubCategory', docsSubCategorySchema)

module.exports = DocsSubCategory