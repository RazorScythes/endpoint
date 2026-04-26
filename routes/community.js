const express = require('express')
const router = express.Router()
const community = require('../controllers/community')
const auth = require('../middleware/auth')

router.get('/', auth.optionalAuth, auth.allowCors(community.getCommunities))
router.get('/:slug', auth.optionalAuth, auth.allowCors(community.getCommunityBySlug))

router.post('/', auth.authenticateToken, auth.userRequired, auth.allowCors(community.createCommunity))
router.patch('/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(community.updateCommunity))
router.delete('/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(community.deleteCommunity))

router.post('/invite/:code/join', auth.authenticateToken, auth.userRequired, auth.allowCors(community.joinByInviteCode))

router.post('/:id/join', auth.authenticateToken, auth.userRequired, auth.allowCors(community.joinCommunity))
router.post('/:id/leave', auth.authenticateToken, auth.userRequired, auth.allowCors(community.leaveCommunity))
router.post('/:id/regenerate-invite', auth.authenticateToken, auth.userRequired, auth.allowCors(community.regenerateInviteCode))

router.post('/:id/moderator', auth.authenticateToken, auth.userRequired, auth.allowCors(community.addModerator))
router.delete('/:id/moderator/:userId', auth.authenticateToken, auth.userRequired, auth.allowCors(community.removeModerator))

router.post('/:id/ban', auth.authenticateToken, auth.userRequired, auth.allowCors(community.banFromCommunity))
router.delete('/:id/ban/:userId', auth.authenticateToken, auth.userRequired, auth.allowCors(community.unbanFromCommunity))

module.exports = router
