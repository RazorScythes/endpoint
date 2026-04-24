const BudgetCategory = require('../models/budgetCategory.model')
const Expense = require('../models/expense.model')
const Savings = require('../models/savings.model')
const SavingsHistory = require('../models/savingsHistory.model')
const Debt = require('../models/debt.model')
const BudgetList = require('../models/budgetList.model')
const FinancialGoal = require('../models/financialGoal.model')

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function dateFilter(month, year) {
    if (!month || !year) return {}
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return { $gte: start, $lte: end }
}

async function fetchExpenses(userId, month, year) {
    const filter = { user: userId }
    const df = dateFilter(month, year)
    if (df.$gte) filter.date = df
    return Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()
}

// ==================== CATEGORIES ====================

exports.getCategories = async (req, res) => {
    try {
        const userId = req.token.id
        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).sort({ name: 1 }).lean()
        return res.status(200).json({ result: categories })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { name, icon, color, type, budget, rollover } = req.body

        if (!name) return res.status(400).json({ alert: { variant: 'danger', message: 'Category name is required' } })

        const exists = await BudgetCategory.findOne({ user: userId, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } })
        if (exists) return res.status(400).json({ alert: { variant: 'danger', message: 'Category already exists' } })

        await new BudgetCategory({ user: userId, name, icon: icon || '', color, type, budget: budget || 0, rollover: !!rollover }).save()
        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).sort({ name: 1 }).lean()

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, name, icon, color, type, budget, rollover } = req.body

        await BudgetCategory.findOneAndUpdate({ _id: id, user: userId }, { name, icon, color, type, budget, rollover: !!rollover })
        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).sort({ name: 1 }).lean()

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        await Expense.updateMany({ user: userId, category: id }, { $unset: { category: '' } })
        await BudgetCategory.findOneAndDelete({ _id: id, user: userId })
        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).sort({ name: 1 }).lean()

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.shareCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, targetUserId } = req.body

        if (!id || !targetUserId) return res.status(400).json({ alert: { variant: 'danger', message: 'Category ID and target user ID are required' } })

        const cat = await BudgetCategory.findOne({ _id: id, user: userId })
        if (!cat) return res.status(404).json({ alert: { variant: 'danger', message: 'Category not found' } })

        if (!cat.sharedWith.includes(targetUserId)) {
            cat.sharedWith.push(targetUserId)
            await cat.save()
        }

        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).sort({ name: 1 }).lean()
        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category shared' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.unshareCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, targetUserId } = req.body

        await BudgetCategory.findOneAndUpdate({ _id: id, user: userId }, { $pull: { sharedWith: targetUserId } })
        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).sort({ name: 1 }).lean()
        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'User removed from shared category' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== EXPENSES ====================

exports.getExpenses = async (req, res) => {
    try {
        const userId = req.token.id
        const { month, year } = req.query
        const expenses = await fetchExpenses(userId, month, year)
        return res.status(200).json({ result: expenses })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createExpense = async (req, res) => {
    try {
        const userId = req.token.id
        const { date, category, type, paymentMethod, notes, items, month, year, currency, isRecurring, recurrenceRule, recurrenceEnd } = req.body

        if (items && Array.isArray(items) && items.length > 0) {
            const valid = items.filter(i => i.description && i.amount)
            if (valid.length === 0) return res.status(400).json({ alert: { variant: 'danger', message: 'At least one item with description and amount is required' } })

            const docs = valid.map(i => ({
                user: userId,
                date: date || new Date(),
                description: i.description,
                category: category || null,
                amount: parseFloat(i.amount),
                type: type || 'expense',
                paymentMethod: paymentMethod || 'Cash',
                notes: notes || '',
                currency: currency || 'PHP',
                isRecurring: !!isRecurring,
                recurrenceRule: recurrenceRule || '',
                recurrenceEnd: recurrenceEnd || null,
            }))
            await Expense.insertMany(docs)
        } else {
            const { description, amount } = req.body
            if (!description || !amount) return res.status(400).json({ alert: { variant: 'danger', message: 'Description and amount are required' } })
            await new Expense({
                user: userId, date: date || new Date(), description, category: category || null,
                amount, type: type || 'expense', paymentMethod: paymentMethod || 'Cash', notes,
                currency: currency || 'PHP',
                isRecurring: !!isRecurring, recurrenceRule: recurrenceRule || '', recurrenceEnd: recurrenceEnd || null,
            }).save()
        }

        const count = items ? items.filter(i => i.description && i.amount).length : 1
        const expenses = await fetchExpenses(userId, month, year)
        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: `${count} transaction${count !== 1 ? 's' : ''} added` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateExpense = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, date, description, category, amount, type, paymentMethod, notes, month, year, currency, isRecurring, recurrenceRule, recurrenceEnd } = req.body

        await Expense.findOneAndUpdate({ _id: id, user: userId }, {
            date, description, category: category || null, amount, type, paymentMethod, notes,
            currency: currency || 'PHP',
            isRecurring: !!isRecurring, recurrenceRule: recurrenceRule || '', recurrenceEnd: recurrenceEnd || null,
        })

        const expenses = await fetchExpenses(userId, month, year)
        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: 'Transaction updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteExpense = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const { month, year } = req.query

        await Expense.findOneAndDelete({ _id: id, user: userId })

        const expenses = await fetchExpenses(userId, month, year)
        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: 'Transaction deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.bulkDeleteExpenses = async (req, res) => {
    try {
        const userId = req.token.id
        const { ids, month, year } = req.body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No items selected' } })
        }

        const result = await Expense.deleteMany({ _id: { $in: ids }, user: userId })
        const expenses = await fetchExpenses(userId, month, year)

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `${result.deletedCount} transaction${result.deletedCount !== 1 ? 's' : ''} deleted` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.bulkUpdateCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { ids, category, month, year } = req.body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No items selected' } })
        }

        await Expense.updateMany({ _id: { $in: ids }, user: userId }, { category: category || null })
        const expenses = await fetchExpenses(userId, month, year)

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `${ids.length} transaction${ids.length !== 1 ? 's' : ''} updated` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== SEARCH ====================

exports.searchExpenses = async (req, res) => {
    try {
        const userId = req.token.id
        const { q, type, category, limit } = req.query

        const filter = { user: userId }
        if (q) filter.description = { $regex: new RegExp(escapeRegex(q), 'i') }
        if (type && type !== 'all') filter.type = type
        if (category) filter.category = category

        const max = Math.min(parseInt(limit) || 100, 500)
        const expenses = await Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).limit(max).lean()
        return res.status(200).json({ result: expenses })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Search failed' } })
    }
}

// ==================== CSV IMPORT ====================

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

exports.importCSV = async (req, res) => {
    try {
        const userId = req.token.id
        const { rows, month, year } = req.body

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No data to import' } })
        }

        const docs = rows.filter(r => r.description && r.amount).map(r => ({
            user: userId,
            date: r.date ? new Date(r.date) : new Date(),
            description: r.description,
            category: r.category || null,
            amount: parseFloat(r.amount) || 0,
            type: r.type || 'expense',
            paymentMethod: r.paymentMethod || 'Cash',
            notes: r.notes || 'Imported from CSV',
            currency: r.currency || 'PHP',
        }))

        if (docs.length === 0) return res.status(400).json({ alert: { variant: 'danger', message: 'No valid rows found' } })

        await Expense.insertMany(docs)
        const expenses = await fetchExpenses(userId, month, year)

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `Imported ${docs.length} transaction${docs.length !== 1 ? 's' : ''}` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Import failed' } })
    }
}

// ==================== DASHBOARD ====================

exports.getDashboard = async (req, res) => {
    try {
        const userId = req.token.id
        const { month, year } = req.query

        const m = parseInt(month) || new Date().getMonth() + 1
        const y = parseInt(year) || new Date().getFullYear()

        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59, 999)

        const expenses = await Expense.find({ user: userId, date: { $gte: start, $lte: end } }).populate('category', 'name icon color type budget rollover').lean()
        const categories = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).lean()

        let totalIncome = 0
        let totalExpenses = 0
        const categoryTotals = {}
        const dailyTotals = {}
        const paymentMethodTotals = {}

        expenses.forEach(e => {
            if (e.type === 'income') totalIncome += e.amount
            else totalExpenses += e.amount

            if (e.type === 'expense') {
                const catName = e.category?.name || 'Uncategorized'
                const catColor = e.category?.color || '#94a3b8'
                if (!categoryTotals[catName]) categoryTotals[catName] = { amount: 0, color: catColor, budget: e.category?.budget || 0 }
                categoryTotals[catName].amount += e.amount
            }

            const day = new Date(e.date).getDate()
            if (!dailyTotals[day]) dailyTotals[day] = { income: 0, expense: 0 }
            if (e.type === 'income') dailyTotals[day].income += e.amount
            else dailyTotals[day].expense += e.amount

            const pm = e.paymentMethod || 'Cash'
            if (!paymentMethodTotals[pm]) paymentMethodTotals[pm] = 0
            paymentMethodTotals[pm] += e.type === 'expense' ? e.amount : 0
        })

        const totalBudget = categories.filter(c => c.type === 'expense').reduce((sum, c) => sum + (c.budget || 0), 0)

        // Budget rollover: carry unspent budget from previous month for rollover-enabled categories
        let rolloverAmount = 0
        const rolloverCats = categories.filter(c => c.type === 'expense' && c.rollover && c.budget > 0)
        if (rolloverCats.length > 0) {
            const prevStart = new Date(y, m - 2, 1)
            const prevEnd = new Date(y, m - 1, 0, 23, 59, 59, 999)
            const prevExpenses = await Expense.find({ user: userId, date: { $gte: prevStart, $lte: prevEnd } }).populate('category', 'name').lean()

            for (const cat of rolloverCats) {
                const prevSpent = prevExpenses.filter(e => e.type === 'expense' && e.category?.name === cat.name).reduce((s, e) => s + e.amount, 0)
                const unspent = Math.max(0, cat.budget - prevSpent)
                rolloverAmount += unspent
            }
        }

        const topCategories = Object.entries(categoryTotals)
            .filter(([_, v]) => v.amount > 0)
            .sort((a, b) => b[1].amount - a[1].amount)
            .slice(0, 5)
            .map(([name, data]) => ({ name, ...data }))

        return res.status(200).json({
            result: {
                totalIncome,
                totalExpenses,
                balance: totalIncome - totalExpenses,
                totalBudget,
                remainingBudget: totalBudget - totalExpenses + rolloverAmount,
                rolloverAmount,
                topCategories,
                dailyTotals,
                paymentMethodTotals,
                transactionCount: expenses.length,
                month: m,
                year: y
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== RECURRING ====================

exports.processRecurring = async (req, res) => {
    try {
        const userId = req.token.id

        const templates = await Expense.find({ user: userId, isRecurring: true, recurrenceRule: { $ne: '' } }).lean()
        const now = new Date()
        let created = 0

        for (const tpl of templates) {
            if (tpl.recurrenceEnd && new Date(tpl.recurrenceEnd) < now) continue

            const lastGenerated = await Expense.findOne({ user: userId, recurrenceParentId: tpl._id }).sort({ date: -1 }).lean()
            const lastDate = lastGenerated ? new Date(lastGenerated.date) : new Date(tpl.date)

            let nextDate = new Date(lastDate)
            const rule = tpl.recurrenceRule
            if (rule === 'daily') nextDate.setDate(nextDate.getDate() + 1)
            else if (rule === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
            else if (rule === 'biweekly') nextDate.setDate(nextDate.getDate() + 14)
            else if (rule === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)

            while (nextDate <= now) {
                if (tpl.recurrenceEnd && nextDate > new Date(tpl.recurrenceEnd)) break
                await new Expense({
                    user: userId, date: new Date(nextDate), description: tpl.description,
                    category: tpl.category, amount: tpl.amount, type: tpl.type,
                    paymentMethod: tpl.paymentMethod, notes: tpl.notes, currency: tpl.currency || 'PHP',
                    recurrenceParentId: tpl._id,
                }).save()
                created++
                if (rule === 'daily') nextDate.setDate(nextDate.getDate() + 1)
                else if (rule === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
                else if (rule === 'biweekly') nextDate.setDate(nextDate.getDate() + 14)
                else if (rule === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
            }
        }

        return res.status(200).json({ created, alert: created > 0 ? { variant: 'success', message: `${created} recurring transaction${created !== 1 ? 's' : ''} generated` } : undefined })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to process recurring transactions' } })
    }
}

// ==================== SAVINGS ====================

exports.getSavings = async (req, res) => {
    try {
        const userId = req.token.id
        const savings = await Savings.findOne({ user: userId }).lean()
        return res.status(200).json({ result: savings?.denominations || {} })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.saveSavings = async (req, res) => {
    try {
        const userId = req.token.id
        const { denominations } = req.body

        const existing = await Savings.findOne({ user: userId }).lean()
        const prev = existing?.denominations || {}

        const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1]
        const changes = []
        let previousTotal = 0
        let newTotal = 0

        DENOMS.forEach(d => {
            const prevCount = parseInt(prev[d]) || 0
            const newCount = parseInt(denominations[d]) || 0
            previousTotal += prevCount * d
            newTotal += newCount * d
            if (prevCount !== newCount) {
                changes.push({ denomination: d, previous: prevCount, current: newCount, diff: newCount - prevCount })
            }
        })

        if (changes.length > 0) {
            await new SavingsHistory({
                user: userId,
                changes,
                previousTotal,
                newTotal,
                diffTotal: newTotal - previousTotal
            }).save()
        }

        await Savings.findOneAndUpdate(
            { user: userId },
            { user: userId, denominations },
            { upsert: true, new: true }
        )

        return res.status(200).json({ result: denominations, alert: { variant: 'success', message: 'Savings updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.getSavingsHistory = async (req, res) => {
    try {
        const userId = req.token.id
        const history = await SavingsHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean()
        return res.status(200).json({ result: history })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteSavingsHistory = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await SavingsHistory.deleteOne({ _id: id, user: userId })
        const history = await SavingsHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean()
        return res.status(200).json({ result: history, alert: { variant: 'success', message: 'History entry deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== DEBTS ====================

exports.getDebts = async (req, res) => {
    try {
        const userId = req.token.id
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: debts })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createDebt = async (req, res) => {
    try {
        const userId = req.token.id
        const { name, type, person, total_amount, due_date, notes } = req.body

        if (!name || !total_amount) return res.status(400).json({ alert: { variant: 'danger', message: 'Name and amount are required' } })

        await new Debt({ user: userId, name, type, person, total_amount, due_date: due_date || null, notes }).save()
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Debt created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateDebt = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, name, type, person, total_amount, due_date, notes } = req.body

        await Debt.findOneAndUpdate({ _id: id, user: userId }, { name, type, person, total_amount, due_date: due_date || null, notes })
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Debt updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteDebt = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        await Debt.findOneAndDelete({ _id: id, user: userId })
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Debt deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.addDebtPayment = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const { amount, notes, category, paymentMethod } = req.body

        if (!amount || amount <= 0) return res.status(400).json({ alert: { variant: 'danger', message: 'Valid amount is required' } })

        const debt = await Debt.findOne({ _id: id, user: userId })
        if (!debt) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })

        const paymentDate = new Date()
        debt.payments.push({ amount, notes: notes || '', date: paymentDate })
        debt.amount_paid = debt.payments.reduce((s, p) => s + p.amount, 0)
        if (debt.amount_paid >= debt.total_amount) debt.status = 'paid'
        await debt.save()

        const expenseType = debt.type === 'owe' ? 'expense' : 'income'
        const personLabel = debt.person ? ` → ${debt.person}` : ''
        await new Expense({
            user: userId,
            date: paymentDate,
            description: `Debt: ${debt.name}${personLabel}`,
            category: category || null,
            amount: parseFloat(amount),
            type: expenseType,
            paymentMethod: paymentMethod || 'Cash',
            notes: notes || ''
        }).save()

        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Payment recorded' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.removeDebtPayment = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, paymentId } = req.params

        const debt = await Debt.findOne({ _id: id, user: userId })
        if (!debt) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })

        const payment = debt.payments.id(paymentId)
        if (payment) {
            const personLabel = debt.person ? ` → ${debt.person}` : ''
            const descPattern = `Debt: ${debt.name}${personLabel}`
            const payDate = new Date(payment.date)
            const dayStart = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate())
            const dayEnd = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate() + 1)
            await Expense.findOneAndDelete({
                user: userId,
                description: descPattern,
                amount: payment.amount,
                date: { $gte: dayStart, $lt: dayEnd },
            })
        }

        debt.payments = debt.payments.filter(p => p._id.toString() !== paymentId)
        debt.amount_paid = debt.payments.reduce((s, p) => s + p.amount, 0)
        debt.status = debt.amount_paid >= debt.total_amount ? 'paid' : 'active'
        await debt.save()

        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Payment removed' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.toggleDebtStatus = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params

        const debt = await Debt.findOne({ _id: id, user: userId })
        if (!debt) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })

        let warning = ''
        if (debt.status === 'active') {
            debt.status = 'paid'
            if (debt.amount_paid < debt.total_amount) {
                warning = ` (Note: only ${((debt.amount_paid / debt.total_amount) * 100).toFixed(0)}% paid)`
            }
        } else {
            debt.status = debt.amount_paid >= debt.total_amount ? 'paid' : 'active'
            if (debt.amount_paid >= debt.total_amount) {
                warning = ' (fully paid - status unchanged)'
            }
        }
        await debt.save()

        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: debts, alert: { variant: 'success', message: `Debt marked as ${debt.status}${warning}` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== BUDGET LISTS ====================

exports.getBudgetLists = async (req, res) => {
    try {
        const userId = req.token.id
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: lists })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load lists' } })
    }
}

exports.createBudgetList = async (req, res) => {
    try {
        const userId = req.token.id
        const { name, description, color, icon, currency, showCurrency, items } = req.body
        if (!name) return res.status(400).json({ alert: { variant: 'danger', message: 'List name is required' } })

        await new BudgetList({ user: userId, name, description: description || '', color: color || '#3b82f6', icon: icon || 'peso-sign', currency: currency || '₱', showCurrency: showCurrency !== false, items: items || [] }).save()
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: lists, alert: { variant: 'success', message: 'List created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to create list' } })
    }
}

exports.updateBudgetList = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, name, description, color, icon, currency, showCurrency, items } = req.body
        if (!id) return res.status(400).json({ alert: { variant: 'danger', message: 'List ID is required' } })

        await BudgetList.findOneAndUpdate(
            { _id: id, user: userId },
            { $set: { name, description, color, icon, currency, showCurrency, items } }
        )
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: lists, alert: { variant: 'success', message: 'List updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to update list' } })
    }
}

exports.deleteBudgetList = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await BudgetList.findOneAndDelete({ _id: id, user: userId })
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: lists, alert: { variant: 'success', message: 'List deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete list' } })
    }
}

// ==================== FINANCIAL GOALS ====================

exports.getGoals = async (req, res) => {
    try {
        const userId = req.token.id
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: goals })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load goals' } })
    }
}

exports.createGoal = async (req, res) => {
    try {
        const userId = req.token.id
        const { name, targetAmount, deadline, category, color, icon, notes } = req.body
        if (!name || !targetAmount) return res.status(400).json({ alert: { variant: 'danger', message: 'Name and target amount are required' } })

        await new FinancialGoal({ user: userId, name, targetAmount, deadline: deadline || null, category: category || null, color: color || '#3b82f6', icon: icon || 'bullseye', notes: notes || '' }).save()
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Goal created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to create goal' } })
    }
}

exports.updateGoal = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, name, targetAmount, deadline, category, color, icon, notes, status } = req.body
        await FinancialGoal.findOneAndUpdate({ _id: id, user: userId }, { name, targetAmount, deadline: deadline || null, category: category || null, color, icon, notes, status })
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Goal updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to update goal' } })
    }
}

exports.deleteGoal = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        await FinancialGoal.findOneAndDelete({ _id: id, user: userId })
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Goal deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete goal' } })
    }
}

exports.addGoalContribution = async (req, res) => {
    try {
        const userId = req.token.id
        const { id } = req.params
        const { amount, notes } = req.body

        if (!amount || amount <= 0) return res.status(400).json({ alert: { variant: 'danger', message: 'Valid amount is required' } })

        const goal = await FinancialGoal.findOne({ _id: id, user: userId })
        if (!goal) return res.status(404).json({ alert: { variant: 'danger', message: 'Goal not found' } })

        goal.contributions.push({ amount, notes: notes || '' })
        goal.currentAmount = goal.contributions.reduce((s, c) => s + c.amount, 0)
        if (goal.currentAmount >= goal.targetAmount) goal.status = 'completed'
        await goal.save()

        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Contribution added' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to add contribution' } })
    }
}
