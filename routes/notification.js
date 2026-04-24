const express                   = require('express')
const router                    = express.Router()
const notification              = require('../controllers/notification')

const auth                      = require('../middleware/auth')

router.get('/getNotifications', auth.authenticateToken, auth.userRequired, auth.allowCors(notification.getNotifications));
router.get('/getUnreadCount', auth.authenticateToken, auth.userRequired, auth.allowCors(notification.getUnreadCount));

router.patch('/markAsRead/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(notification.markAsRead));
router.patch('/markAllAsRead', auth.authenticateToken, auth.userRequired, auth.allowCors(notification.markAllAsRead));

router.delete('/delete/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(notification.deleteNotification));
router.delete('/clearAll', auth.authenticateToken, auth.userRequired, auth.allowCors(notification.clearAll));

module.exports = router
