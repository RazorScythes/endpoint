const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const forum = require('../controllers/forum')
const auth = require('../middleware/auth')

const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { alert: { message: 'Too many requests, please slow down', variant: 'danger' } } })
const voteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { alert: { message: 'Too many votes, please slow down', variant: 'danger' } } })
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { alert: { message: 'Too many searches, please slow down', variant: 'danger' } } })

router.get('/feed', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.getFeed))
router.get('/posts', auth.optionalAuth, auth.allowCors(forum.getPosts))
router.get('/posts/:id', auth.optionalAuth, auth.allowCors(forum.getPost))
router.post('/posts', auth.authenticateToken, auth.userRequired, writeLimiter, auth.allowCors(forum.createPost))
router.patch('/posts/:id', auth.authenticateToken, auth.userRequired, writeLimiter, auth.allowCors(forum.updatePost))
router.delete('/posts/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.deletePost))

router.post('/posts/:id/pin', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.togglePin))
router.post('/posts/:id/lock', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.toggleLock))
router.post('/posts/:id/vote', auth.authenticateToken, auth.userRequired, voteLimiter, auth.allowCors(forum.votePost))

router.get('/posts/:id/comments', auth.optionalAuth, auth.allowCors(forum.getComments))
router.post('/posts/:id/comments', auth.authenticateToken, auth.userRequired, writeLimiter, auth.allowCors(forum.createComment))
router.patch('/comments/:id', auth.authenticateToken, auth.userRequired, writeLimiter, auth.allowCors(forum.updateComment))
router.delete('/comments/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.deleteComment))
router.post('/comments/:id/vote', auth.authenticateToken, auth.userRequired, voteLimiter, auth.allowCors(forum.voteComment))

router.get('/tags', auth.allowCors(forum.getForumTags))
router.get('/search', searchLimiter, auth.allowCors(forum.searchForum))
router.post('/report', auth.authenticateToken, auth.userRequired, writeLimiter, auth.allowCors(forum.reportContent))

router.post('/posts/:id/save', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.savePost))
router.delete('/posts/:id/save', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.unsavePost))
router.get('/saved', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.getSavedPosts))

router.get('/reports', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.getForumReports))
router.patch('/reports/:id/dismiss', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.dismissReport))

module.exports = router
