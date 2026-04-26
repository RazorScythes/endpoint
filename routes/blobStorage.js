const express = require('express')
const router = express.Router()
const blobStorage = require('../controllers/blobStorage')
const auth = require('../middleware/auth')

router.get('/list', auth.authenticateToken, auth.adminAccess, auth.allowCors(blobStorage.listBlobs))
router.get('/stats', auth.authenticateToken, auth.adminAccess, auth.allowCors(blobStorage.getBlobStats))
router.get('/unused', auth.authenticateToken, auth.adminAccess, auth.allowCors(blobStorage.getUnusedBlobs))
router.post('/delete', auth.authenticateToken, auth.adminAccess, auth.allowCors(blobStorage.deleteBlobs))

module.exports = router
