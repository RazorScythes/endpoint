const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    reset_password: { type: Boolean },
    safe_content: { type: Boolean },
},{
    timestamps: true
})

const model = mongoose.model('Settings', schema)

module.exports = model