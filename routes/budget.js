const express                   = require('express')
const router                    = express.Router()
const budget                    = require('../controllers/budget')

const auth                      = require('../middleware/auth')
const { budgetPermission }      = require('../middleware/budgetPermission')

// BUDGET SHARING (owner-only, no budgetPermission needed)
router.post('/share', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.shareBudget))
router.post('/unshare', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.unshareBudget))
router.patch('/share', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.updateBudgetShare))
router.get('/shared-with-me', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getSharedBudgets))
router.get('/shared-users', auth.authenticateToken, auth.userRequired, auth.allowCors(budget.getSharedUsers))

// DASHBOARD
router.get('/dashboard', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getDashboard))

// CATEGORIES
router.get('/categories', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getCategories))
router.post('/category', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.createCategory))
router.patch('/category', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.updateCategory))
router.delete('/category/:id', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteCategory))
router.post('/category/share', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.shareCategory))
router.post('/category/unshare', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.unshareCategory))

// IMPORT
router.post('/import-csv', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.importCSV))

// SEARCH
router.get('/search', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.searchExpenses))

// RECURRING
router.post('/recurring/process', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.processRecurring))

// EXPENSES
router.get('/expenses', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getExpenses))
router.post('/expense', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.createExpense))
router.patch('/expense', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.updateExpense))
router.delete('/expense/:id', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteExpense))
router.post('/expenses/bulkDelete', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.bulkDeleteExpenses))
router.patch('/expenses/bulkCategory', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.bulkUpdateCategory))
router.patch('/expenses/bulkCurrency', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.bulkUpdateCurrency))
router.post('/receipt/delete', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteReceipt))

// SAVINGS
router.get('/savings', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getSavings))
router.post('/savings', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.saveSavings))
router.get('/savings/history', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getSavingsHistory))
router.delete('/savings/history/:id', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteSavingsHistory))

// DEBTS
router.get('/debts', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getDebts))
router.post('/debt', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.createDebt))
router.patch('/debt', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.updateDebt))
router.delete('/debt/:id', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteDebt))
router.post('/debt/:id/payment', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.addDebtPayment))
router.delete('/debt/:id/payment/:paymentId', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.removeDebtPayment))
router.patch('/debt/:id/toggle', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.toggleDebtStatus))

// BUDGET LISTS
router.get('/lists', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getBudgetLists))
router.post('/list', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.createBudgetList))
router.patch('/list', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.updateBudgetList))
router.delete('/list/:id', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteBudgetList))

// EXCHANGE RATES
router.get('/exchange-rates', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getExchangeRates))
router.post('/exchange-rates', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.saveExchangeRates))
router.post('/exchange-rates/reset', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.resetExchangeRates))

// BUDGET SETTINGS
router.post('/settings', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.saveBudgetSettings))

// FINANCIAL GOALS
router.get('/goals', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.getGoals))
router.post('/goal', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.createGoal))
router.patch('/goal', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.updateGoal))
router.delete('/goal/:id', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.deleteGoal))
router.post('/goal/:id/contribution', auth.authenticateToken, auth.userRequired, budgetPermission, auth.allowCors(budget.addGoalContribution))

module.exports = router
