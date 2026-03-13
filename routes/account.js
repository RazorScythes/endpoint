const express                   = require('express')
const router                    = express.Router()
const account                   = require('../controllers/account')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getLogs', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getLogs));
router.get('/getReports', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getReports));

// POST REQUEST
router.post('/createReport', auth.authenticateToken, auth.userRequired, auth.allowCors(account.createReport));

// PATCH REQUEST
router.patch('/updateReportStatus', auth.authenticateToken, auth.userRequired, auth.allowCors(account.updateReportStatus));

// DELETE REQUEST
router.delete('/clearLogs', auth.authenticateToken, auth.userRequired, auth.allowCors(account.clearLogs));
router.delete('/deleteReport/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(account.deleteReport));

module.exports = router
