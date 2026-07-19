const mongoose = require('mongoose')
const Schema = mongoose.Schema

const VaultShareSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entry: { type: Schema.Types.ObjectId, ref: 'VaultEntry', default: null },
    folder: { type: Schema.Types.ObjectId, ref: 'VaultFolder', default: null },
    encryptedKey: { type: String, required: true },
    permission: { type: String, enum: ['read', 'edit'], default: 'read' },
    expiresAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
}, { timestamps: true })

VaultShareSchema.index({ owner: 1 })
VaultShareSchema.index({ sharedWith: 1, revoked: 1 })

module.exports = mongoose.model('VaultShare', VaultShareSchema)
