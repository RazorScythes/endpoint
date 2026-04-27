const express = require('express')
const router = express.Router()
const mongoStorage = require('../controllers/mongoStorage')
const auth = require('../middleware/auth')

router.get('/stats', auth.authenticateToken, auth.adminAccess, auth.allowCors(mongoStorage.getDbStats))
router.get('/collections', auth.authenticateToken, auth.adminAccess, auth.allowCors(mongoStorage.getCollectionStats))
router.get('/documents', auth.authenticateToken, auth.adminAccess, auth.allowCors(mongoStorage.getDocuments))
router.post('/create-db', auth.authenticateToken, auth.adminAccess, auth.allowCors(mongoStorage.createDatabase))

module.exports = router
