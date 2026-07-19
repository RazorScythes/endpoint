const VaultEntry = require('../models/vault.model')
const VaultFolder = require('../models/vaultFolder.model')
const VaultShare = require('../models/vaultShare.model')
const VaultDevice = require('../models/vaultDevice.model')
const VaultAuditLog = require('../models/vaultAuditLog.model')
const User = require('../models/user.model')
const crypto = require('crypto')

function logAction(userId, action, details = '', entryId = null, req = null) {
    return VaultAuditLog.create({
        user: userId,
        action,
        entryId,
        details,
        ip: req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || '',
        userAgent: req?.headers?.['user-agent'] || '',
    })
}

// ==================== VAULT SETUP ====================

exports.getVaultStatus = async (req, res) => {
    try {
        const userId = req.token.id
        const user = await User.findById(userId).select('vaultSalt vaultAuthHash').lean()
        const hasVault = !!(user?.vaultSalt && user?.vaultAuthHash)
        const entryCount = hasVault ? await VaultEntry.countDocuments({ user: userId, deleted: false }) : 0
        return res.status(200).json({ hasVault, entryCount })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.setupVault = async (req, res) => {
    try {
        const userId = req.token.id
        const { salt, authHash } = req.body
        if (!salt || !authHash) return res.status(400).json({ message: 'Salt and auth hash required', variant: 'danger' })

        await User.findByIdAndUpdate(userId, { vaultSalt: salt, vaultAuthHash: authHash })
        await logAction(userId, 'vault_setup', '', null, req)
        return res.status(200).json({ message: 'Vault setup complete', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.unlockVault = async (req, res) => {
    try {
        const userId = req.token.id
        const { authHash } = req.body
        if (!authHash) return res.status(400).json({ message: 'Auth hash required', variant: 'danger' })

        const user = await User.findById(userId).select('vaultSalt vaultAuthHash').lean()
        if (!user?.vaultAuthHash) return res.status(400).json({ message: 'Vault not set up', variant: 'danger' })

        const storedHash = user.vaultAuthHash
        const match = crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(authHash, 'hex'))
        if (!match) return res.status(401).json({ message: 'Invalid master password', variant: 'danger' })

        await logAction(userId, 'vault_unlock', '', null, req)
        return res.status(200).json({ salt: user.vaultSalt, message: 'Vault unlocked', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.changeMasterPassword = async (req, res) => {
    try {
        const userId = req.token.id
        const { currentAuthHash, newSalt, newAuthHash, reEncryptedEntries } = req.body
        if (!currentAuthHash || !newSalt || !newAuthHash) return res.status(400).json({ message: 'All fields required', variant: 'danger' })

        const user = await User.findById(userId).select('vaultAuthHash').lean()
        const match = crypto.timingSafeEqual(Buffer.from(user.vaultAuthHash, 'hex'), Buffer.from(currentAuthHash, 'hex'))
        if (!match) return res.status(401).json({ message: 'Current master password incorrect', variant: 'danger' })

        await User.findByIdAndUpdate(userId, { vaultSalt: newSalt, vaultAuthHash: newAuthHash })

        if (reEncryptedEntries && Array.isArray(reEncryptedEntries)) {
            const bulkOps = reEncryptedEntries.map(e => ({
                updateOne: { filter: { _id: e.id, user: userId }, update: { $set: { encryptedData: e.encryptedData, iv: e.iv } } }
            }))
            if (bulkOps.length > 0) await VaultEntry.bulkWrite(bulkOps)
        }

        await logAction(userId, 'master_password_change', '', null, req)
        return res.status(200).json({ message: 'Master password changed', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== ENTRIES CRUD ====================

exports.getEntries = async (req, res) => {
    try {
        const userId = req.token.id
        const { type, folder, favorite, archived, deleted, tag, search } = req.query

        const filter = { user: userId }
        if (type) filter.type = type
        if (folder) filter.folder = folder
        if (favorite === 'true') filter.favorite = true
        if (archived === 'true') filter.archived = true
        if (deleted === 'true') { filter.deleted = true } else { filter.deleted = false }
        if (tag) filter.tags = tag
        if (search) filter['metadata.name'] = { $regex: search, $options: 'i' }

        const entries = await VaultEntry.find(filter).sort({ updatedAt: -1 }).lean()
        return res.status(200).json({ result: entries })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getEntry = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const entry = await VaultEntry.findOne({ _id: id, user: userId }).lean()
        if (!entry) return res.status(404).json({ message: 'Entry not found', variant: 'danger' })

        await logAction(userId, 'entry_view', entry.metadata?.name || '', id, req)
        return res.status(200).json({ result: entry })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.createEntry = async (req, res) => {
    try {
        const userId = req.token.id
        const { type, encryptedData, iv, folder, tags, favorite, metadata } = req.body
        if (!type || !encryptedData || !iv) return res.status(400).json({ message: 'Type, encrypted data, and IV required', variant: 'danger' })

        const entry = await VaultEntry.create({ user: userId, type, encryptedData, iv, folder: folder || null, tags: tags || [], favorite: favorite || false, metadata: metadata || {} })
        await logAction(userId, 'entry_create', metadata?.name || '', entry._id, req)
        return res.status(201).json({ result: entry, message: 'Entry created', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateEntry = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const { encryptedData, iv, folder, tags, favorite, archived, metadata } = req.body

        const update = {}
        if (encryptedData !== undefined) update.encryptedData = encryptedData
        if (iv !== undefined) update.iv = iv
        if (folder !== undefined) update.folder = folder || null
        if (tags !== undefined) update.tags = tags
        if (favorite !== undefined) update.favorite = favorite
        if (archived !== undefined) update.archived = archived
        if (metadata !== undefined) update.metadata = metadata

        const entry = await VaultEntry.findOneAndUpdate({ _id: id, user: userId, deleted: false }, { $set: update }, { new: true })
        if (!entry) return res.status(404).json({ message: 'Entry not found', variant: 'danger' })

        await logAction(userId, 'entry_update', metadata?.name || entry.metadata?.name || '', id, req)
        return res.status(200).json({ result: entry, message: 'Entry updated', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteEntry = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const { permanent } = req.query

        if (permanent === 'true') {
            await VaultEntry.findOneAndDelete({ _id: id, user: userId })
        } else {
            await VaultEntry.findOneAndUpdate({ _id: id, user: userId }, { $set: { deleted: true, deletedAt: new Date() } })
        }

        await logAction(userId, 'entry_delete', permanent === 'true' ? 'permanent' : 'soft', id, req)
        return res.status(200).json({ message: 'Entry deleted', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.restoreEntry = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await VaultEntry.findOneAndUpdate({ _id: id, user: userId, deleted: true }, { $set: { deleted: false, deletedAt: null } })
        await logAction(userId, 'entry_restore', '', id, req)
        return res.status(200).json({ message: 'Entry restored', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.emptyTrash = async (req, res) => {
    try {
        const userId = req.token.id
        await VaultEntry.deleteMany({ user: userId, deleted: true })
        await logAction(userId, 'entry_delete', 'empty_trash', null, req)
        return res.status(200).json({ message: 'Trash emptied', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.bulkMove = async (req, res) => {
    try {
        const userId = req.token.id
        const { entryIds, folderId } = req.body
        if (!entryIds || !Array.isArray(entryIds)) return res.status(400).json({ message: 'Entry IDs required', variant: 'danger' })

        await VaultEntry.updateMany({ _id: { $in: entryIds }, user: userId }, { $set: { folder: folderId || null } })
        return res.status(200).json({ message: 'Entries moved', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== FOLDERS ====================

exports.getFolders = async (req, res) => {
    try {
        const userId = req.token.id
        const folders = await VaultFolder.find({ user: userId }).sort({ name: 1 }).lean()
        return res.status(200).json({ result: folders })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.createFolder = async (req, res) => {
    try {
        const userId = req.token.id
        const { name, parent, icon, color } = req.body
        if (!name) return res.status(400).json({ message: 'Folder name required', variant: 'danger' })

        const folder = await VaultFolder.create({ user: userId, name, parent: parent || null, icon: icon || 'folder', color: color || '#6366f1' })
        await logAction(userId, 'folder_create', name, null, req)
        return res.status(201).json({ result: folder, message: 'Folder created', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.updateFolder = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const { name, parent, icon, color } = req.body

        const folder = await VaultFolder.findOneAndUpdate({ _id: id, user: userId }, { $set: { name, parent: parent || null, icon, color } }, { new: true })
        if (!folder) return res.status(404).json({ message: 'Folder not found', variant: 'danger' })

        await logAction(userId, 'folder_update', name, null, req)
        return res.status(200).json({ result: folder, message: 'Folder updated', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.deleteFolder = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        await VaultEntry.updateMany({ user: userId, folder: id }, { $set: { folder: null } })
        await VaultFolder.findOneAndDelete({ _id: id, user: userId })
        await logAction(userId, 'folder_delete', '', null, req)
        return res.status(200).json({ message: 'Folder deleted', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== SHARING ====================

exports.shareEntry = async (req, res) => {
    try {
        const userId = req.token.id
        const { entryId, sharedWithUserId, encryptedKey, permission, expiresAt } = req.body
        if (!entryId || !sharedWithUserId || !encryptedKey) return res.status(400).json({ message: 'All fields required', variant: 'danger' })

        const entry = await VaultEntry.findOne({ _id: entryId, user: userId })
        if (!entry) return res.status(404).json({ message: 'Entry not found', variant: 'danger' })

        const share = await VaultShare.create({ owner: userId, sharedWith: sharedWithUserId, entry: entryId, encryptedKey, permission: permission || 'read', expiresAt: expiresAt || null })
        await VaultEntry.findByIdAndUpdate(entryId, { $push: { sharedWith: share._id } })
        await logAction(userId, 'share_create', `Shared with ${sharedWithUserId}`, entryId, req)
        return res.status(201).json({ result: share, message: 'Entry shared', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.revokeShare = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await VaultShare.findOneAndUpdate({ _id: id, owner: userId }, { $set: { revoked: true } })
        await logAction(userId, 'share_revoke', '', null, req)
        return res.status(200).json({ message: 'Share revoked', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getSharedWithMe = async (req, res) => {
    try {
        const userId = req.token.id
        const shares = await VaultShare.find({ sharedWith: userId, revoked: false })
            .populate({ path: 'entry', select: 'type encryptedData iv metadata' })
            .populate({ path: 'owner', select: 'username' })
            .lean()

        const active = shares.filter(s => !s.expiresAt || new Date(s.expiresAt) > new Date())
        return res.status(200).json({ result: active })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.getMyShares = async (req, res) => {
    try {
        const userId = req.token.id
        const shares = await VaultShare.find({ owner: userId })
            .populate({ path: 'sharedWith', select: 'username' })
            .populate({ path: 'entry', select: 'type metadata' })
            .lean()
        return res.status(200).json({ result: shares })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== IMPORT / EXPORT ====================

exports.importEntries = async (req, res) => {
    try {
        const userId = req.token.id
        const { entries } = req.body
        if (!entries || !Array.isArray(entries) || entries.length === 0) return res.status(400).json({ message: 'No entries to import', variant: 'danger' })

        const docs = entries.map(e => ({
            user: userId,
            type: e.type || 'password',
            encryptedData: e.encryptedData,
            iv: e.iv,
            folder: e.folder || null,
            tags: e.tags || [],
            favorite: false,
            archived: false,
            deleted: false,
            metadata: e.metadata || {},
        }))

        await VaultEntry.insertMany(docs)
        await logAction(userId, 'import', `${docs.length} entries imported`, null, req)
        return res.status(200).json({ message: `${docs.length} entries imported`, variant: 'success', count: docs.length })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.exportEntries = async (req, res) => {
    try {
        const userId = req.token.id
        const entries = await VaultEntry.find({ user: userId, deleted: false }).lean()
        const folders = await VaultFolder.find({ user: userId }).lean()
        await logAction(userId, 'export', `${entries.length} entries exported`, null, req)
        return res.status(200).json({ result: { entries, folders } })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== AUDIT LOGS ====================

exports.getAuditLogs = async (req, res) => {
    try {
        const userId = req.token.id
        const { page = 0, limit = 50, action } = req.query

        const filter = { user: userId }
        if (action) filter.action = action

        const logs = await VaultAuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(Number(page) * Number(limit))
            .limit(Number(limit))
            .lean()

        const total = await VaultAuditLog.countDocuments(filter)
        return res.status(200).json({ result: logs, total })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== DEVICES ====================

exports.getDevices = async (req, res) => {
    try {
        const userId = req.token.id
        const devices = await VaultDevice.find({ user: userId, active: true }).sort({ lastActive: -1 }).lean()
        return res.status(200).json({ result: devices })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.registerDevice = async (req, res) => {
    try {
        const userId = req.token.id
        const { deviceName, deviceType, browser, os } = req.body
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || ''

        const device = await VaultDevice.create({ user: userId, deviceName, deviceType: deviceType || 'browser', browser, os, ip })
        await logAction(userId, 'device_register', deviceName, null, req)
        return res.status(201).json({ result: device, message: 'Device registered', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

exports.removeDevice = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await VaultDevice.findOneAndUpdate({ _id: id, user: userId }, { $set: { active: false } })
        await logAction(userId, 'device_remove', '', null, req)
        return res.status(200).json({ message: 'Device removed', variant: 'success' })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}

// ==================== STATS ====================

exports.getStats = async (req, res) => {
    try {
        const userId = req.token.id
        const [total, passwords, notes, cards, identities, favorites, archived, trash, folders, shares] = await Promise.all([
            VaultEntry.countDocuments({ user: userId, deleted: false }),
            VaultEntry.countDocuments({ user: userId, deleted: false, type: 'password' }),
            VaultEntry.countDocuments({ user: userId, deleted: false, type: 'note' }),
            VaultEntry.countDocuments({ user: userId, deleted: false, type: 'card' }),
            VaultEntry.countDocuments({ user: userId, deleted: false, type: 'identity' }),
            VaultEntry.countDocuments({ user: userId, deleted: false, favorite: true }),
            VaultEntry.countDocuments({ user: userId, deleted: false, archived: true }),
            VaultEntry.countDocuments({ user: userId, deleted: true }),
            VaultFolder.countDocuments({ user: userId }),
            VaultShare.countDocuments({ owner: userId, revoked: false }),
        ])
        return res.status(200).json({ result: { total, passwords, notes, cards, identities, favorites, archived, trash, folders, shares } })
    } catch (err) {
        return res.status(500).json({ message: 'Server error', variant: 'danger' })
    }
}
