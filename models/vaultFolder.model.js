const mongoose = require('mongoose')
const Schema = mongoose.Schema

const VaultFolderSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'VaultFolder', default: null },
    icon: { type: String, default: 'folder' },
    color: { type: String, default: '#6366f1' },
}, { timestamps: true })

VaultFolderSchema.index({ user: 1, parent: 1 })

module.exports = mongoose.model('VaultFolder', VaultFolderSchema)
