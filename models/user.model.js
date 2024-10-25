const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const schema = Schema({
    avatar: { type: String },
    username: { type: String },
    email: { type: String },
    password: { type: String },
    role: { type: String },
    profile_id: {
        type: Schema.Types.ObjectId,
        ref: 'Profile'
    },
    settings_id: {
        type: Schema.Types.ObjectId,
        ref: 'Settings'
    },
    verification: {
        verified: { type: Boolean },
        verification_token: { type: String },
        verification_time_to_send: { type: String }
    },
    contribution: { type: Number } 
},{
    timestamps: true
})

const model = mongoose.model('User', schema)

module.exports = model