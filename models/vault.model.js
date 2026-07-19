const mongoose = require('mongoose')
const Schema = mongoose.Schema

const VaultEntrySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['password', 'note', 'card', 'identity'], required: true },
    encryptedData: { type: String, required: true },
    iv: { type: String, required: true },
    folder: { type: Schema.Types.ObjectId, ref: 'VaultFolder', default: null },
    tags: [{ type: String }],
    favorite: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    metadata: {
        domain: { type: String, default: '' },
        name: { type: String, default: '' },
    },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: 'VaultShare' }],
}, { timestamps: true })

VaultEntrySchema.index({ user: 1, deleted: 1, type: 1 })
VaultEntrySchema.index({ user: 1, folder: 1 })
VaultEntrySchema.index({ user: 1, favorite: 1 })
VaultEntrySchema.index({ 'metadata.domain': 1 })

module.exports = mongoose.model('VaultEntry', VaultEntrySchema)
