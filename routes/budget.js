const express                   = require('express')
const router                    = express.Router()
const budget                    = require('../controllers/budget')

const auth                      = require('../middleware/auth')

// DASHBOARD
router.get('/dashboard', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getDashboard))

// CATEGORIES
router.get('/categories', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getCategories))
router.post('/category', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.createCategory))
router.patch('/category', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.updateCategory))
router.delete('/category/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.deleteCategory))

// SEED
router.post('/seed', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.seedFromSheet))

// EXPENSES
router.get('/expenses', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getExpenses))
router.post('/expense', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.createExpense))
router.patch('/expense', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.updateExpense))
router.delete('/expense/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.deleteExpense))
router.post('/expenses/bulkDelete', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.bulkDeleteExpenses))
router.patch('/expenses/bulkCategory', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.bulkUpdateCategory))

// SAVINGS
router.get('/savings', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getSavings))
router.post('/savings', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.saveSavings))
router.get('/savings/history', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getSavingsHistory))
router.delete('/savings/history/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.deleteSavingsHistory))

module.exports = router
