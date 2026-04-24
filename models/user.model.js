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
    googleId: { type: String },
    subscribers: [{ type: String }],
    favorite_games: [{ type: Schema.Types.ObjectId, ref: 'Game' }],
    game_collections: [{
        name: { type: String },
        games: [{ type: Schema.Types.ObjectId, ref: 'Game' }],
        createdAt: { type: Date, default: Date.now }
    }],
    social_links: {
        website: { type: String, default: '' },
        github: { type: String, default: '' },
        twitter: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        youtube: { type: String, default: '' },
        discord: { type: String, default: '' },
    },
    two_factor: {
        enabled: { type: Boolean, default: false },
        secret: { type: String, default: '' },
        backup_codes: [{ type: String }],
    },
    sessions: [{
        token_hash: { type: String },
        device: { type: String },
        ip: { type: String },
        last_active: { type: Date, default: Date.now },
        created_at: { type: Date, default: Date.now },
    }],
    notification_prefs: {
        email_updates: { type: Boolean, default: true },
        security_alerts: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        comment_replies: { type: Boolean, default: true },
        new_followers: { type: Boolean, default: true },
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