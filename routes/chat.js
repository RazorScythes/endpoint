const express                   = require('express')
const router                    = express.Router()
const chat                      = require('../controllers/chat')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/conversations', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.getConversations));
router.get('/messages/:conversationId', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.getMessages));
router.get('/searchUsers', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.searchUsers));
router.get('/unreadCount', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.getUnreadCount));
router.get('/blocked', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.getBlockedUsers));
router.get('/blocked/:targetUserId', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.checkBlocked));

// POST REQUEST
router.post('/conversation', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.getOrCreateConversation));
router.post('/message', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.sendMessage));
router.post('/block', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.blockUser));

// DELETE REQUEST
router.delete('/block/:targetUserId', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.unblockUser));
router.delete('/message/:messageId', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.deleteMessage));
router.delete('/message/:messageId/all', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.deleteMessageForAll));
router.delete('/conversation/:conversationId/me', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.deleteConversationForMe));
router.delete('/conversation/:conversationId/all', auth.authenticateToken, auth.userRequired, auth.allowCors(chat.deleteConversationForAll));

module.exports = router
