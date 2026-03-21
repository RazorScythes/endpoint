const BudgetCategory = require('../models/budgetCategory.model')
const Expense = require('../models/expense.model')
const Savings = require('../models/savings.model')
const SavingsHistory = require('../models/savingsHistory.model')

// ==================== CATEGORIES ====================

exports.getCategories = async (req, res) => {
    try {
        const userId = req.token.id
        const categories = await BudgetCategory.find({ user: userId }).sort({ name: 1 }).lean()
        return res.status(200).json({ result: categories })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { name, icon, color, type, budget } = req.body

        if (!name) return res.status(400).json({ alert: { variant: 'danger', message: 'Category name is required' } })

        const exists = await BudgetCategory.findOne({ user: userId, name: { $regex: new RegExp(`^${name}$`, 'i') } })
        if (exists) return res.status(400).json({ alert: { variant: 'danger', message: 'Category already exists' } })

        const category = await new BudgetCategory({ user: userId, name, icon, color, type, budget: budget || 0 }).save()
        const categories = await BudgetCategory.find({ user: userId }).sort({ name: 1 }).lean()

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateCategory = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, name, icon, color, type, budget } = req.body

        await BudgetCategory.findOneAndUpdate({ _id: id, user: userId }, { name, icon, color, type, budget })
        const categories = await BudgetCategory.find({ user: userId }).sort({ name: 1 }).lean()

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
        const categories = await BudgetCategory.find({ user: userId }).sort({ name: 1 }).lean()

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category deleted' } })
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

        const filter = { user: userId }
        if (month && year) {
            const start = new Date(year, month - 1, 1)
            const end = new Date(year, month, 0, 23, 59, 59, 999)
            filter.date = { $gte: start, $lte: end }
        }

        const expenses = await Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()
        return res.status(200).json({ result: expenses })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createExpense = async (req, res) => {
    try {
        const userId = req.token.id
        const { date, category, type, paymentMethod, notes, items, month, year } = req.body

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
                notes: notes || ''
            }))
            await Expense.insertMany(docs)
        } else {
            const { description, amount } = req.body
            if (!description || !amount) return res.status(400).json({ alert: { variant: 'danger', message: 'Description and amount are required' } })
            await new Expense({ user: userId, date: date || new Date(), description, category: category || null, amount, type: type || 'expense', paymentMethod: paymentMethod || 'Cash', notes }).save()
        }

        const filter = { user: userId }
        if (month && year) {
            const start = new Date(year, month - 1, 1)
            const end = new Date(year, month, 0, 23, 59, 59, 999)
            filter.date = { $gte: start, $lte: end }
        }

        const count = items ? items.filter(i => i.description && i.amount).length : 1
        const expenses = await Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()
        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: `${count} transaction${count !== 1 ? 's' : ''} added` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateExpense = async (req, res) => {
    try {
        const userId = req.token.id
        const { id, date, description, category, amount, type, paymentMethod, notes } = req.body

        await Expense.findOneAndUpdate({ _id: id, user: userId }, { date, description, category: category || null, amount, type, paymentMethod, notes })

        const { month, year } = req.body
        const filter = { user: userId }
        if (month && year) {
            const start = new Date(year, month - 1, 1)
            const end = new Date(year, month, 0, 23, 59, 59, 999)
            filter.date = { $gte: start, $lte: end }
        }

        const expenses = await Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()
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

        await Expense.findOneAndDelete({ _id: id, user: userId })

        return res.status(200).json({ alert: { variant: 'success', message: 'Transaction deleted' } })
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

        const filter = { user: userId }
        if (month && year) {
            const start = new Date(year, month - 1, 1)
            const end = new Date(year, month, 0, 23, 59, 59, 999)
            filter.date = { $gte: start, $lte: end }
        }

        const expenses = await Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()

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

        const filter = { user: userId }
        if (month && year) {
            const start = new Date(year, month - 1, 1)
            const end = new Date(year, month, 0, 23, 59, 59, 999)
            filter.date = { $gte: start, $lte: end }
        }

        const expenses = await Expense.find(filter).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `${ids.length} transaction${ids.length !== 1 ? 's' : ''} updated` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
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

        const expenses = await Expense.find({ user: userId, date: { $gte: start, $lte: end } }).populate('category', 'name icon color type budget').lean()
        const categories = await BudgetCategory.find({ user: userId }).lean()

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
                remainingBudget: totalBudget - totalExpenses,
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

// ==================== SEED FROM SHEET ====================

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

exports.seedFromSheet = async (req, res) => {
    try {
        const userId = req.token.id

        const sheetData = [
            1336, 1934, 2246, 2405, 3494, 2601, 3528, 783, 165, 115,
            188, 397, 1221, 21, 422, 476, 1430, 28, 671, 228,
            2563, 2823, 2287, 258, 52, 759, 993, 504, 5, 3979,
            2833, 189
        ]

        let category = await BudgetCategory.findOne({ user: userId, name: 'Tickets' })
        if (!category) {
            category = await new BudgetCategory({
                user: userId,
                name: 'Tickets',
                color: '#6366f1',
                type: 'expense',
                budget: 0
            }).save()
        }

        const now = new Date()
        const m = req.body.month || now.getMonth() + 1
        const y = req.body.year || now.getFullYear()
        const daysInMonth = new Date(y, m, 0).getDate()

        const entries = sheetData.slice(0, daysInMonth).map((amount, i) => ({
            user: userId,
            date: new Date(y, m - 1, i + 1),
            description: `Daily Tickets - Day ${i + 1}`,
            category: category._id,
            amount,
            type: 'expense',
            paymentMethod: 'Cash',
            notes: 'Imported from Google Sheets'
        }))

        await Expense.insertMany(entries)

        const allExpenses = await Expense.find({
            user: userId,
            date: { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59, 999) }
        }).populate('category', 'name icon color type budget').sort({ date: -1 }).lean()

        return res.status(200).json({
            result: allExpenses,
            alert: { variant: 'success', message: `Imported ${entries.length} daily ticket entries for ${MONTHS[m - 1]} ${y}` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
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
