const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const groupsSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref:'User'
    },
    group_name: { type: String },
    description: { type: String },
    type: { type: String },
    strict: { type: Boolean },
    privacy: { type: Boolean },
},{
    timestamps: true,
    collection: "grouplist"
})

const Groups = mongoose.model('Groups', groupsSchema)

module.exports = Groups