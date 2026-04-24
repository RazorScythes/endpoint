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
router.post('/category/share', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.shareCategory))
router.post('/category/unshare', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.unshareCategory))

// IMPORT
router.post('/import-csv', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.importCSV))

// SEARCH
router.get('/search', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.searchExpenses))

// RECURRING
router.post('/recurring/process', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.processRecurring))

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

// DEBTS
router.get('/debts', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getDebts))
router.post('/debt', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.createDebt))
router.patch('/debt', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.updateDebt))
router.delete('/debt/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.deleteDebt))
router.post('/debt/:id/payment', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.addDebtPayment))
router.delete('/debt/:id/payment/:paymentId', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.removeDebtPayment))
router.patch('/debt/:id/toggle', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.toggleDebtStatus))

// BUDGET LISTS
router.get('/lists', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getBudgetLists))
router.post('/list', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.createBudgetList))
router.patch('/list', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.updateBudgetList))
router.delete('/list/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.deleteBudgetList))

// FINANCIAL GOALS
router.get('/goals', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getGoals))
router.post('/goal', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.createGoal))
router.patch('/goal', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.updateGoal))
router.delete('/goal/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.deleteGoal))
router.post('/goal/:id/contribution', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.addGoalContribution))

module.exports = router
