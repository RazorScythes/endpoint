const mongoose = require('mongoose')
const Schema = mongoose.Schema

const VaultDeviceSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceName: { type: String, required: true },
    deviceType: { type: String, enum: ['browser', 'extension', 'mobile', 'desktop'], default: 'browser' },
    browser: { type: String, default: '' },
    os: { type: String, default: '' },
    ip: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now },
    trusted: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('VaultDevice', VaultDeviceSchema)
