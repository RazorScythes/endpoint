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
router.get('/get2FAStatus', auth.authenticateToken, auth.userRequired, auth.allowCors(account.get2FAStatus));
router.get('/getSessions', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getSessions));
router.get('/exportData', auth.authenticateToken, auth.userRequired, auth.allowCors(account.exportAccountData));
router.get('/getNotificationPrefs', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getNotificationPrefs));
router.get('/getSocialLinks', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getSocialLinks));
router.get('/getSecurityLog', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getSecurityLog));
router.get('/getProfileCompleteness', auth.authenticateToken, auth.userRequired, auth.allowCors(account.getProfileCompleteness));

// POST REQUEST
router.post('/createReport', auth.authenticateToken, auth.userRequired, auth.allowCors(account.createReport));
router.post('/toggle2FA', auth.authenticateToken, auth.userRequired, auth.allowCors(account.toggle2FA));
router.post('/updateNotificationPrefs', auth.authenticateToken, auth.userRequired, auth.allowCors(account.updateNotificationPrefs));
router.post('/updateSocialLinks', auth.authenticateToken, auth.userRequired, auth.allowCors(account.updateSocialLinks));

// PATCH REQUEST
router.patch('/updateReportStatus', auth.authenticateToken, auth.userRequired, auth.allowCors(account.updateReportStatus));

// DELETE REQUEST
router.delete('/clearLogs', auth.authenticateToken, auth.userRequired, auth.allowCors(account.clearLogs));
router.delete('/deleteReport/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(account.deleteReport));
router.delete('/revokeSession/:sessionId', auth.authenticateToken, auth.userRequired, auth.allowCors(account.revokeSession));
router.delete('/revokeAllSessions', auth.authenticateToken, auth.userRequired, auth.allowCors(account.revokeAllSessions));

module.exports = router
