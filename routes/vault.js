const express = require('express')
const router = express.Router()
const vault = require('../controllers/vault')
const auth = require('../middleware/auth')

const guard = [auth.authenticateToken, auth.userRequired, auth.adminRequired]

// Vault setup & auth
router.get('/status', ...guard, auth.allowCors(vault.getVaultStatus))
router.post('/setup', ...guard, auth.allowCors(vault.setupVault))
router.post('/unlock', ...guard, auth.allowCors(vault.unlockVault))
router.post('/change-master-password', ...guard, auth.allowCors(vault.changeMasterPassword))

// Entries CRUD
router.get('/entries', ...guard, auth.allowCors(vault.getEntries))
router.get('/entries/:id', ...guard, auth.allowCors(vault.getEntry))
router.post('/entries', ...guard, auth.allowCors(vault.createEntry))
router.put('/entries/:id', ...guard, auth.allowCors(vault.updateEntry))
router.delete('/entries/:id', ...guard, auth.allowCors(vault.deleteEntry))
router.post('/entries/:id/restore', ...guard, auth.allowCors(vault.restoreEntry))
router.delete('/trash/empty', ...guard, auth.allowCors(vault.emptyTrash))
router.post('/entries/bulk-move', ...guard, auth.allowCors(vault.bulkMove))

// Folders
router.get('/folders', ...guard, auth.allowCors(vault.getFolders))
router.post('/folders', ...guard, auth.allowCors(vault.createFolder))
router.put('/folders/:id', ...guard, auth.allowCors(vault.updateFolder))
router.delete('/folders/:id', ...guard, auth.allowCors(vault.deleteFolder))

// Sharing
router.post('/share', ...guard, auth.allowCors(vault.shareEntry))
router.delete('/share/:id', ...guard, auth.allowCors(vault.revokeShare))
router.get('/shared-with-me', ...guard, auth.allowCors(vault.getSharedWithMe))
router.get('/my-shares', ...guard, auth.allowCors(vault.getMyShares))

// Import/Export
router.post('/import', ...guard, auth.allowCors(vault.importEntries))
router.get('/export', ...guard, auth.allowCors(vault.exportEntries))

// Audit logs
router.get('/audit-logs', ...guard, auth.allowCors(vault.getAuditLogs))

// Devices
router.get('/devices', ...guard, auth.allowCors(vault.getDevices))
router.post('/devices', ...guard, auth.allowCors(vault.registerDevice))
router.delete('/devices/:id', ...guard, auth.allowCors(vault.removeDevice))

// Stats
router.get('/stats', ...guard, auth.allowCors(vault.getStats))

module.exports = router
