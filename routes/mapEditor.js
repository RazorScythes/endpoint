const express                   = require('express')
const router                    = express.Router()
const mapEditor                 = require('../controllers/mapEditor')

router.get('/', mapEditor.getDefinitions)
router.post('/', mapEditor.createDefinition)
router.post('/blob/delete', mapEditor.deleteBlob)
router.get('/trash/list', mapEditor.getTrash)
router.patch('/trash/restore/:id', mapEditor.restoreDefinition)
router.get('/:id', mapEditor.getDefinitionById)
router.patch('/:id', mapEditor.updateDefinition)
router.delete('/:id', mapEditor.deleteDefinition)
router.post('/:id/duplicate', mapEditor.duplicateDefinition)

module.exports = router
