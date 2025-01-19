const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const docSchema = new Schema({
    doc_name: { type: String },
    description: { type: String },
    base_url: { type: String },
    token_url: { type: String },
    token: { type: String },
    private: { type: Boolean },
},{
    timestamps: true,
    collection: "docs"
})

const Docs = mongoose.model('Docs', docSchema)

module.exports = Docs