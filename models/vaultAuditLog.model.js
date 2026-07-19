const mongoose = require('mongoose')
const Schema = mongoose.Schema

const VaultAuditLogSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, enum: [
        'vault_unlock', 'vault_lock', 'vault_setup',
        'entry_create', 'entry_update', 'entry_delete', 'entry_restore',
        'entry_view', 'entry_copy_password',
        'folder_create', 'folder_update', 'folder_delete',
        'share_create', 'share_revoke',
        'import', 'export',
        'master_password_change',
        'device_register', 'device_remove',
        'security_scan',
    ]},
    entryId: { type: Schema.Types.ObjectId, ref: 'VaultEntry', default: null },
    details: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
}, { timestamps: true })

VaultAuditLogSchema.index({ user: 1, createdAt: -1 })
VaultAuditLogSchema.index({ user: 1, action: 1 })

module.exports = mongoose.model('VaultAuditLog', VaultAuditLogSchema)
