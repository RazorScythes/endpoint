const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    first_name: { type: String },
    middle_name: { type: String },
    last_name: { type: String },
    bio: { type: String },
    age: { type: Number },
    birthday: { type: String },
    address: { type: String },
    contact_number: { type: String },
    gender: { type: String }
},{
    timestamps: true
})

const model = mongoose.model('Profile', schema)

module.exports = model