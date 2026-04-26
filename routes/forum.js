const express = require('express')
const router = express.Router()
const forum = require('../controllers/forum')
const auth = require('../middleware/auth')

router.get('/feed', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.getFeed))
router.get('/posts', auth.allowCors(forum.getPosts))
router.get('/posts/:id', auth.allowCors(forum.getPost))
router.post('/posts', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.createPost))
router.patch('/posts/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.updatePost))
router.delete('/posts/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.deletePost))

router.post('/posts/:id/pin', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.togglePin))
router.post('/posts/:id/lock', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.toggleLock))
router.post('/posts/:id/vote', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.votePost))

router.get('/posts/:id/comments', auth.allowCors(forum.getComments))
router.post('/posts/:id/comments', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.createComment))
router.patch('/comments/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.updateComment))
router.delete('/comments/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.deleteComment))
router.post('/comments/:id/vote', auth.authenticateToken, auth.userRequired, auth.allowCors(forum.voteComment))

router.get('/tags', auth.allowCors(forum.getForumTags))
router.get('/search', auth.allowCors(forum.searchForum))

module.exports = router
