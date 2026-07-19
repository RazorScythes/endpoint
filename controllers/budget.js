const { del } = require('@vercel/blob')
const BudgetCategory = require('../models/budgetCategory.model')
const Expense = require('../models/expense.model')
const Savings = require('../models/savings.model')
const SavingsHistory = require('../models/savingsHistory.model')
const Debt = require('../models/debt.model')
const BudgetList = require('../models/budgetList.model')
const FinancialGoal = require('../models/financialGoal.model')
const ExchangeRate = require('../models/exchangeRate.model')
const User = require('../models/user.model')
const BudgetShare = require('../models/budgetShare.model')

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function fetchCategories(userId) {
    return BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] })
        .sort({ name: 1 })
        .populate('sharedWith', 'username avatar')
        .lean()
}

function dateFilter(month, year) {
    if (!year) return {}
    if (!month) {
        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 31, 23, 59, 59, 999)
        return { $gte: start, $lte: end }
    }
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
        const userId = req.budgetUserId || req.token.id
        const categories = await fetchCategories(userId)
        return res.status(200).json({ result: categories })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createCategory = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { name, icon, color, type, budget, rollover } = req.body

        if (!name) return res.status(400).json({ alert: { variant: 'danger', message: 'Category name is required' } })

        const exists = await BudgetCategory.findOne({ user: userId, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } })
        if (exists) return res.status(400).json({ alert: { variant: 'danger', message: 'Category already exists' } })

        await new BudgetCategory({ user: userId, name, icon: icon || '', color, type, budget: budget || 0, rollover: !!rollover }).save()
        const categories = await fetchCategories(userId)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_categories_updated', { result: categories, userId, actorId: req.token.id })

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateCategory = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, name, icon, color, type, budget, rollover } = req.body

        const updated = await BudgetCategory.findOneAndUpdate({ _id: id, user: userId }, { name, icon, color, type, budget, rollover: !!rollover })
        if (!updated) return res.status(404).json({ alert: { variant: 'danger', message: 'Category not found or not authorized' } })
        const categories = await fetchCategories(userId)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_categories_updated', { result: categories, userId, actorId: req.token.id })

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params

        await Expense.updateMany({ user: userId, category: id }, { $unset: { category: '' } })
        await BudgetCategory.findOneAndDelete({ _id: id, user: userId })
        const categories = await fetchCategories(userId)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_categories_updated', { result: categories, userId, actorId: req.token.id })

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'Category deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.shareCategory = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, username } = req.body

        if (!id || !username) return res.status(400).json({ alert: { variant: 'danger', message: 'Category ID and username are required' } })

        const targetUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } })
        if (!targetUser) return res.status(404).json({ alert: { variant: 'danger', message: `User "${username}" not found` } })
        if (targetUser._id.toString() === userId) return res.status(400).json({ alert: { variant: 'danger', message: 'You cannot share a category with yourself' } })

        const cat = await BudgetCategory.findOne({ _id: id, user: userId })
        if (!cat) return res.status(404).json({ alert: { variant: 'danger', message: 'Category not found' } })

        const targetId = targetUser._id.toString()
        if (!cat.sharedWith.includes(targetId)) {
            cat.sharedWith.push(targetId)
            await cat.save()
        }

        const categories = await fetchCategories(userId)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_categories_updated', { result: categories, userId, actorId: req.token.id })

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: `Category shared with ${targetUser.username}` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.unshareCategory = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, targetUserId } = req.body

        await BudgetCategory.findOneAndUpdate({ _id: id, user: userId }, { $pull: { sharedWith: targetUserId } })
        const categories = await fetchCategories(userId)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_categories_updated', { result: categories, userId, actorId: req.token.id })

        return res.status(200).json({ result: categories, alert: { variant: 'success', message: 'User removed from shared category' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== EXPENSES ====================

exports.getExpenses = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
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
        const userId = req.budgetUserId || req.token.id
        const { date, category, type, paymentMethod, notes, items, month, year, currency, isRecurring, recurrenceRule, recurrenceEnd, listOnly, attachments, tags } = req.body

        if (category) {
            const cat = await BudgetCategory.findOne({ _id: category, $or: [{ user: userId }, { sharedWith: userId }] }).lean()
            if (!cat) return res.status(403).json({ alert: { variant: 'danger', message: 'Category not found or not authorized' } })
        }

        const parsedTags = Array.isArray(tags) ? tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().toLowerCase()) : []

        if (items && Array.isArray(items) && items.length > 0) {
            const valid = items.filter(i => i.description && !isNaN(parseFloat(i.amount)))
            if (valid.length === 0) return res.status(400).json({ alert: { variant: 'danger', message: 'At least one item with description and valid amount is required' } })

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
                listOnly: !!listOnly,
                attachments: Array.isArray(attachments) ? attachments : [],
                isRecurring: !!isRecurring,
                recurrenceRule: recurrenceRule || '',
                recurrenceEnd: recurrenceEnd || null,
                tags: parsedTags,
            }))
            await Expense.insertMany(docs)
        } else {
            const { description, amount } = req.body
            const parsedAmt = parseFloat(amount)
            if (!description || isNaN(parsedAmt)) return res.status(400).json({ alert: { variant: 'danger', message: 'Description and valid amount are required' } })
            await new Expense({
                user: userId, date: date || new Date(), description, category: category || null,
                amount: parsedAmt, type: type || 'expense', paymentMethod: paymentMethod || 'Cash', notes,
                currency: currency || 'PHP', listOnly: !!listOnly,
                attachments: Array.isArray(attachments) ? attachments : [],
                isRecurring: !!isRecurring, recurrenceRule: recurrenceRule || '', recurrenceEnd: recurrenceEnd || null,
                tags: parsedTags,
            }).save()
        }

        const count = items ? items.filter(i => i.description && i.amount).length : 1
        const expenses = await fetchExpenses(userId, month, year)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: `${count} transaction${count !== 1 ? 's' : ''} added` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateExpense = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, date, description, category, amount, type, paymentMethod, notes, month, year, currency, isRecurring, recurrenceRule, recurrenceEnd, listOnly, attachments, tags } = req.body

        const parsedAmount = parseFloat(amount)
        if (!description || isNaN(parsedAmount)) return res.status(400).json({ alert: { variant: 'danger', message: 'Description and valid amount are required' } })

        if (category) {
            const cat = await BudgetCategory.findOne({ _id: category, $or: [{ user: userId }, { sharedWith: userId }] }).lean()
            if (!cat) return res.status(403).json({ alert: { variant: 'danger', message: 'Category not found or not authorized' } })
        }

        const parsedTags = Array.isArray(tags) ? tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().toLowerCase()) : []

        const updated = await Expense.findOneAndUpdate({ _id: id, user: userId }, {
            date, description, category: category || null, amount: parsedAmount, type, paymentMethod, notes,
            currency: currency || 'PHP', listOnly: !!listOnly,
            attachments: Array.isArray(attachments) ? attachments : [],
            isRecurring: !!isRecurring, recurrenceRule: recurrenceRule || '', recurrenceEnd: recurrenceEnd || null,
            tags: parsedTags,
        })
        if (!updated) return res.status(404).json({ alert: { variant: 'danger', message: 'Transaction not found' } })

        const expenses = await fetchExpenses(userId, month, year)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: 'Transaction updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteExpense = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params
        const { month, year } = req.query

        const deleted = await Expense.findOneAndDelete({ _id: id, user: userId })
        if (!deleted) return res.status(404).json({ alert: { variant: 'danger', message: 'Transaction not found' } })

        const expenses = await fetchExpenses(userId, month, year)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({ result: expenses, alert: { variant: 'success', message: 'Transaction deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.bulkDeleteExpenses = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { ids, month, year } = req.body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No items selected' } })
        }

        const delResult = await Expense.deleteMany({ _id: { $in: ids }, user: userId })
        const expenses = await fetchExpenses(userId, month, year)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `${delResult.deletedCount} transaction${delResult.deletedCount !== 1 ? 's' : ''} deleted` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.bulkUpdateCategory = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { ids, category, month, year } = req.body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No items selected' } })
        }

        if (category) {
            const cat = await BudgetCategory.findOne({ _id: category, $or: [{ user: userId }, { sharedWith: userId }] }).lean()
            if (!cat) return res.status(403).json({ alert: { variant: 'danger', message: 'Category not found or not authorized' } })
        }

        await Expense.updateMany({ _id: { $in: ids }, user: userId }, { category: category || null })
        const expenses = await fetchExpenses(userId, month, year)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `${ids.length} transaction${ids.length !== 1 ? 's' : ''} updated` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.bulkUpdateCurrency = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { ids, currency, month, year } = req.body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No items selected' } })
        }

        await Expense.updateMany({ _id: { $in: ids }, user: userId }, { currency: currency || 'PHP' })
        const expenses = await fetchExpenses(userId, month, year)

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `${ids.length} transaction${ids.length !== 1 ? 's' : ''} currency updated` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== SEARCH ====================

exports.searchExpenses = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
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

exports.importCSV = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { rows, month, year } = req.body

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'No data to import' } })
        }

        if (rows.some(r => r.category)) {
            const userCats = await BudgetCategory.find({ $or: [{ user: userId }, { sharedWith: userId }] }).select('_id name').lean()
            const catIdSet = new Set(userCats.map(c => c._id.toString()))
            const catNameMap = {}
            userCats.forEach(c => { catNameMap[c.name.toLowerCase()] = c._id.toString() })

            rows.forEach(r => {
                if (!r.category) return
                if (catIdSet.has(r.category)) return
                const resolved = catNameMap[r.category.toLowerCase()]
                r.category = resolved || null
            })
        }

        const docs = rows.filter(r => r.description && !isNaN(parseFloat(r.amount))).map(r => ({
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

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })

        return res.status(200).json({
            result: expenses,
            alert: { variant: 'success', message: `Imported ${docs.length} transaction${docs.length !== 1 ? 's' : ''}` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Import failed' } })
    }
}

// ==================== INITIAL LOAD (BATCHED) ====================

exports.getInitialLoad = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { month, year } = req.query
        const m = parseInt(month) || new Date().getMonth() + 1
        const y = parseInt(year) || new Date().getFullYear()

        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59, 999)

        const [
            allExpenses,
            categories,
            savings,
            debts,
            lists,
            goals,
            exchangeRateDoc,
            liveRates,
        ] = await Promise.all([
            Expense.find({ user: userId, date: { $gte: start, $lte: end } }).populate('category', 'name icon color type budget rollover').sort({ date: -1 }).lean(),
            fetchCategories(userId),
            Savings.findOne({ user: req.token.id }).lean(),
            Debt.find({ user: userId }).sort({ createdAt: -1 }).lean(),
            BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean(),
            FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean(),
            ExchangeRate.findOne({ user: userId }).lean(),
            fetchLiveRates(),
        ])

        let totalIncome = 0, totalExpenses = 0
        const categoryTotals = {}, dailyTotals = {}, paymentMethodTotals = {}

        allExpenses.forEach(e => {
            if (!e.listOnly) {
                if (e.type === 'income') totalIncome += e.amount
                else totalExpenses += e.amount
            }
            if (e.type === 'expense' && !e.listOnly) {
                const catName = e.category?.name || 'Uncategorized'
                const catColor = e.category?.color || '#94a3b8'
                if (!categoryTotals[catName]) categoryTotals[catName] = { amount: 0, color: catColor, budget: e.category?.budget || 0 }
                categoryTotals[catName].amount += e.amount
            }
            if (!e.listOnly) {
                const day = new Date(e.date).getDate()
                if (!dailyTotals[day]) dailyTotals[day] = { income: 0, expense: 0 }
                if (e.type === 'income') dailyTotals[day].income += e.amount
                else dailyTotals[day].expense += e.amount
                const pm = e.paymentMethod || 'Cash'
                if (!paymentMethodTotals[pm]) paymentMethodTotals[pm] = 0
                paymentMethodTotals[pm] += e.type === 'expense' ? e.amount : 0
            }
        })

        const totalBudget = categories.filter(c => c.type === 'expense').reduce((sum, c) => sum + (c.budget || 0), 0)

        let rolloverAmount = 0
        const rolloverCats = categories.filter(c => c.type === 'expense' && c.rollover && c.budget > 0)
        if (rolloverCats.length > 0) {
            const prevStart = new Date(y, m - 2, 1)
            const prevEnd = new Date(y, m - 1, 0, 23, 59, 59, 999)
            const prevExpenses = await Expense.find({ user: userId, date: { $gte: prevStart, $lte: prevEnd } }).populate('category', 'name').lean()
            for (const cat of rolloverCats) {
                const prevSpent = prevExpenses.filter(e => e.type === 'expense' && e.category?.name === cat.name).reduce((s, e) => s + e.amount, 0)
                rolloverAmount += Math.max(0, cat.budget - prevSpent)
            }
        }

        const topCategories = Object.entries(categoryTotals)
            .filter(([_, v]) => v.amount > 0)
            .sort((a, b) => b[1].amount - a[1].amount)
            .slice(0, 5)
            .map(([name, data]) => ({ name, ...data }))

        return res.status(200).json({
            result: {
                dashboard: {
                    totalIncome, totalExpenses, balance: totalIncome - totalExpenses,
                    totalBudget, remainingBudget: totalBudget - totalExpenses + rolloverAmount,
                    rolloverAmount, topCategories, dailyTotals, paymentMethodTotals,
                    transactionCount: allExpenses.length, month: m, year: y
                },
                expenses: allExpenses,
                categories,
                savings: savings?.denominations || {},
                debts,
                lists,
                goals,
                exchangeRates: {
                    rates: exchangeRateDoc?.rates || null,
                    baseCurrency: exchangeRateDoc?.baseCurrency || 'PHP',
                    liveRates: liveRates || {},
                    budgetSettings: exchangeRateDoc?.budgetSettings || null,
                },
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== DASHBOARD ====================

exports.getDashboard = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { month, year } = req.query

        const m = parseInt(month) || new Date().getMonth() + 1
        const y = parseInt(year) || new Date().getFullYear()

        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59, 999)

        const expenses = await Expense.find({ user: userId, date: { $gte: start, $lte: end } }).populate('category', 'name icon color type budget rollover').lean()
        const categories = await fetchCategories(userId)

        let totalIncome = 0
        let totalExpenses = 0
        const categoryTotals = {}
        const dailyTotals = {}
        const paymentMethodTotals = {}

        expenses.forEach(e => {
            if (!e.listOnly) {
                if (e.type === 'income') totalIncome += e.amount
                else totalExpenses += e.amount
            }

            if (e.type === 'expense' && !e.listOnly) {
                const catName = e.category?.name || 'Uncategorized'
                const catColor = e.category?.color || '#94a3b8'
                if (!categoryTotals[catName]) categoryTotals[catName] = { amount: 0, color: catColor, budget: e.category?.budget || 0 }
                categoryTotals[catName].amount += e.amount
            }

            if (!e.listOnly) {
                const day = new Date(e.date).getDate()
                if (!dailyTotals[day]) dailyTotals[day] = { income: 0, expense: 0 }
                if (e.type === 'income') dailyTotals[day].income += e.amount
                else dailyTotals[day].expense += e.amount

                const pm = e.paymentMethod || 'Cash'
                if (!paymentMethodTotals[pm]) paymentMethodTotals[pm] = 0
                paymentMethodTotals[pm] += e.type === 'expense' ? e.amount : 0
            }
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
        const userId = req.budgetUserId || req.token.id

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
                const dateStart = new Date(nextDate)
                dateStart.setHours(0, 0, 0, 0)
                const dateEnd = new Date(nextDate)
                dateEnd.setHours(23, 59, 59, 999)
                const existing = await Expense.findOne({
                    user: userId,
                    recurrenceParentId: tpl._id,
                    date: { $gte: dateStart, $lte: dateEnd }
                }).lean()
                if (!existing) {
                    await new Expense({
                        user: userId, date: new Date(nextDate), description: tpl.description,
                        category: tpl.category, amount: tpl.amount, type: tpl.type,
                        paymentMethod: tpl.paymentMethod, notes: tpl.notes, currency: tpl.currency || 'PHP',
                        recurrenceParentId: tpl._id,
                    }).save()
                    created++
                }
                if (rule === 'daily') nextDate.setDate(nextDate.getDate() + 1)
                else if (rule === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
                else if (rule === 'biweekly') nextDate.setDate(nextDate.getDate() + 14)
                else if (rule === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
            }
        }

        if (created > 0) {
            const { month, year } = req.body
            const expenses = await fetchExpenses(userId, month, year)
            const io = req.app.get('io')
            io.to(`budget:${userId}`).emit('budget_expenses_updated', { result: expenses, userId, actorId: req.token.id })
            return res.status(200).json({ result: expenses, created, alert: { variant: 'success', message: `${created} recurring transaction${created !== 1 ? 's' : ''} generated` } })
        }
        return res.status(200).json({ created })
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

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_savings_updated', { result: denominations, userId, actorId: req.token.id })

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

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_savings_history_updated', { result: history, userId, actorId: req.token.id })

        return res.status(200).json({ result: history, alert: { variant: 'success', message: 'History entry deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== DEBTS ====================

exports.getDebts = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: debts })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.createDebt = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { name, type, person, total_amount, due_date, notes } = req.body

        if (!name || !total_amount) return res.status(400).json({ alert: { variant: 'danger', message: 'Name and amount are required' } })

        await new Debt({ user: userId, name, type, person, total_amount, due_date: due_date || null, notes }).save()
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_debts_updated', { result: debts, userId, actorId: req.token.id })

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Debt created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.updateDebt = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, name, type, person, total_amount, due_date, notes } = req.body

        const updated = await Debt.findOneAndUpdate({ _id: id, user: userId }, { name, type, person, total_amount, due_date: due_date || null, notes })
        if (!updated) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_debts_updated', { result: debts, userId, actorId: req.token.id })

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Debt updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteDebt = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params

        const deleted = await Debt.findOneAndDelete({ _id: id, user: userId })
        if (!deleted) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })
        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_debts_updated', { result: debts, userId, actorId: req.token.id })

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Debt deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.addDebtPayment = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params
        const { amount, notes, category, paymentMethod } = req.body

        if (!amount || amount <= 0) return res.status(400).json({ alert: { variant: 'danger', message: 'Valid amount is required' } })

        if (category) {
            const cat = await BudgetCategory.findOne({ _id: category, $or: [{ user: userId }, { sharedWith: userId }] }).lean()
            if (!cat) return res.status(403).json({ alert: { variant: 'danger', message: 'Category not found or not authorized' } })
        }

        const debt = await Debt.findOne({ _id: id, user: userId })
        if (!debt) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })

        const paymentDate = new Date()
        const expenseType = debt.type === 'owe' ? 'expense' : 'income'
        const personLabel = debt.person ? ` → ${debt.person}` : ''
        const expense = await new Expense({
            user: userId,
            date: paymentDate,
            description: `Debt: ${debt.name}${personLabel}`,
            category: category || null,
            amount: parseFloat(amount),
            type: expenseType,
            paymentMethod: paymentMethod || 'Cash',
            notes: notes || ''
        }).save()

        debt.payments.push({ amount, notes: notes || '', date: paymentDate, expenseId: expense._id })
        debt.amount_paid = debt.payments.reduce((s, p) => s + p.amount, 0)
        if (debt.amount_paid >= debt.total_amount) debt.status = 'paid'
        await debt.save()

        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_debts_updated', { result: debts, userId, actorId: req.token.id })

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Payment recorded' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.removeDebtPayment = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, paymentId } = req.params

        const debt = await Debt.findOne({ _id: id, user: userId })
        if (!debt) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })

        const payment = debt.payments.id(paymentId)
        if (payment) {
            if (payment.expenseId) {
                await Expense.findOneAndDelete({ _id: payment.expenseId, user: userId })
            } else {
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
        }

        debt.payments = debt.payments.filter(p => p._id.toString() !== paymentId)
        debt.amount_paid = debt.payments.reduce((s, p) => s + p.amount, 0)
        debt.status = debt.amount_paid >= debt.total_amount ? 'paid' : 'active'
        await debt.save()

        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_debts_updated', { result: debts, userId, actorId: req.token.id })

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: 'Payment removed' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.toggleDebtStatus = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params

        const debt = await Debt.findOne({ _id: id, user: userId })
        if (!debt) return res.status(404).json({ alert: { variant: 'danger', message: 'Debt not found' } })

        let warning = ''
        if (debt.status === 'active') {
            debt.status = 'paid'
            if (debt.amount_paid < debt.total_amount) {
                const pct = debt.total_amount > 0 ? ((debt.amount_paid / debt.total_amount) * 100).toFixed(0) : 0
                warning = ` (Note: only ${pct}% paid)`
            }
        } else {
            debt.status = debt.amount_paid >= debt.total_amount ? 'paid' : 'active'
            if (debt.amount_paid >= debt.total_amount) {
                warning = ' (fully paid - status unchanged)'
            }
        }
        await debt.save()

        const debts = await Debt.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_debts_updated', { result: debts, userId, actorId: req.token.id })

        return res.status(200).json({ result: debts, alert: { variant: 'success', message: `Debt marked as ${debt.status}${warning}` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

// ==================== BUDGET LISTS ====================

exports.getBudgetLists = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: lists })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load lists' } })
    }
}

exports.createBudgetList = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { name, description, color, icon, currency, showCurrency, items } = req.body
        if (!name) return res.status(400).json({ alert: { variant: 'danger', message: 'List name is required' } })

        await new BudgetList({ user: userId, name, description: description || '', color: color || '#3b82f6', icon: icon || 'peso-sign', currency: currency || '₱', showCurrency: showCurrency !== false, items: items || [] }).save()
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_lists_updated', { result: lists, userId, actorId: req.token.id })

        return res.status(200).json({ result: lists, alert: { variant: 'success', message: 'List created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to create list' } })
    }
}

exports.updateBudgetList = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, name, description, color, icon, currency, showCurrency, items } = req.body
        if (!id) return res.status(400).json({ alert: { variant: 'danger', message: 'List ID is required' } })

        await BudgetList.findOneAndUpdate(
            { _id: id, user: userId },
            { $set: { name, description, color, icon, currency, showCurrency, items } }
        )
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_lists_updated', { result: lists, userId, actorId: req.token.id })

        return res.status(200).json({ result: lists, alert: { variant: 'success', message: 'List updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to update list' } })
    }
}

exports.deleteBudgetList = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params
        await BudgetList.findOneAndDelete({ _id: id, user: userId })
        const lists = await BudgetList.find({ user: userId }).sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_lists_updated', { result: lists, userId, actorId: req.token.id })

        return res.status(200).json({ result: lists, alert: { variant: 'success', message: 'List deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete list' } })
    }
}

// ==================== FINANCIAL GOALS ====================

exports.getGoals = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()
        return res.status(200).json({ result: goals })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load goals' } })
    }
}

exports.createGoal = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { name, targetAmount, deadline, category, color, icon, notes } = req.body
        if (!name || !targetAmount) return res.status(400).json({ alert: { variant: 'danger', message: 'Name and target amount are required' } })

        await new FinancialGoal({ user: userId, name, targetAmount, deadline: deadline || null, category: category || null, color: color || '#3b82f6', icon: icon || 'bullseye', notes: notes || '' }).save()
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_goals_updated', { result: goals, userId, actorId: req.token.id })

        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Goal created' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to create goal' } })
    }
}

exports.updateGoal = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, name, targetAmount, deadline, category, color, icon, notes, status } = req.body
        const updated = await FinancialGoal.findOneAndUpdate({ _id: id, user: userId }, { name, targetAmount, deadline: deadline || null, category: category || null, color, icon, notes, status })
        if (!updated) return res.status(404).json({ alert: { variant: 'danger', message: 'Goal not found' } })
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_goals_updated', { result: goals, userId, actorId: req.token.id })

        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Goal updated' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to update goal' } })
    }
}

exports.deleteGoal = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id } = req.params
        const deleted = await FinancialGoal.findOneAndDelete({ _id: id, user: userId })
        if (!deleted) return res.status(404).json({ alert: { variant: 'danger', message: 'Goal not found' } })
        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_goals_updated', { result: goals, userId, actorId: req.token.id })

        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Goal deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete goal' } })
    }
}

exports.addGoalContribution = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
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

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_goals_updated', { result: goals, userId, actorId: req.token.id })

        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Contribution added' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to add contribution' } })
    }
}

exports.removeGoalContribution = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { id, contributionId } = req.params

        const goal = await FinancialGoal.findOne({ _id: id, user: userId })
        if (!goal) return res.status(404).json({ alert: { variant: 'danger', message: 'Goal not found' } })

        const contribution = goal.contributions.id(contributionId)
        if (!contribution) return res.status(404).json({ alert: { variant: 'danger', message: 'Contribution not found' } })

        await contribution.deleteOne()
        goal.currentAmount = goal.contributions.reduce((s, c) => s + c.amount, 0)
        if (goal.currentAmount < goal.targetAmount && goal.status === 'completed') goal.status = 'active'
        await goal.save()

        const goals = await FinancialGoal.find({ user: userId }).populate('category', 'name icon color').sort({ createdAt: -1 }).lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_goals_updated', { result: goals, userId, actorId: req.token.id })

        return res.status(200).json({ result: goals, alert: { variant: 'success', message: 'Contribution removed' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to remove contribution' } })
    }
}

// ==================== EXCHANGE RATES ====================

let cachedLiveRates = null
let cacheTimestamp = 0
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

async function fetchLiveRates() {
    if (cachedLiveRates && Date.now() - cacheTimestamp < CACHE_TTL) return cachedLiveRates
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/PHP')
        const data = await res.json()
        if (data.result === 'success' && data.rates) {
            cachedLiveRates = data.rates
            cacheTimestamp = Date.now()
            return data.rates
        }
    } catch (err) {
        console.log('Failed to fetch live exchange rates:', err.message)
    }
    return cachedLiveRates || null
}

exports.getExchangeRates = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const saved = await ExchangeRate.findOne({ user: userId }).lean()
        const liveRates = await fetchLiveRates()
        return res.status(200).json({
            result: {
                rates: saved?.rates || null,
                baseCurrency: saved?.baseCurrency || 'PHP',
                liveRates: liveRates || {},
                budgetSettings: saved?.budgetSettings || null,
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.saveExchangeRates = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { rates, baseCurrency } = req.body

        const update = { rates: rates || {} }
        if (baseCurrency) update.baseCurrency = baseCurrency

        await ExchangeRate.findOneAndUpdate(
            { user: userId },
            update,
            { upsert: true, new: true }
        )

        const result = { rates: rates || {}, baseCurrency: baseCurrency || 'PHP' }

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_settings_updated', { result, userId, actorId: req.token.id })

        return res.status(200).json({
            result,
            alert: { variant: 'success', message: 'Exchange rates saved' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.resetExchangeRates = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const liveRates = await fetchLiveRates()

        if (!liveRates) {
            return res.status(503).json({ alert: { variant: 'danger', message: 'Unable to fetch current exchange rates. Try again later.' } })
        }

        await ExchangeRate.findOneAndUpdate(
            { user: userId },
            { rates: {} },
            { upsert: true }
        )

        const result = { rates: null, liveRates }

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_settings_updated', { result, userId, actorId: req.token.id })

        return res.status(200).json({
            result,
            alert: { variant: 'success', message: 'Rates reset to current exchange rates' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Internal server error' } })
    }
}

exports.deleteReceipt = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { url } = req.body
        if (!url || typeof url !== 'string') return res.status(400).json({ alert: { variant: 'danger', message: 'URL is required' } })
        if (!url.includes('vercel-storage')) return res.status(400).json({ alert: { variant: 'danger', message: 'Invalid blob URL' } })

        const ownsReceipt = await Expense.findOne({ user: userId, attachments: url }).lean()
        if (!ownsReceipt) return res.status(403).json({ alert: { variant: 'danger', message: 'Not authorized to delete this receipt' } })

        await del(url)
        return res.status(200).json({ result: true, alert: { variant: 'success', message: 'Receipt deleted' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to delete receipt' } })
    }
}

exports.saveBudgetSettings = async (req, res) => {
    try {
        const userId = req.budgetUserId || req.token.id
        const { budgetSettings } = req.body
        if (!budgetSettings) return res.status(400).json({ alert: { variant: 'danger', message: 'Settings data required' } })

        await ExchangeRate.findOneAndUpdate(
            { user: userId },
            { $set: { budgetSettings } },
            { upsert: true, new: true }
        )

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_settings_updated', { result: { budgetSettings }, userId, actorId: req.token.id })

        return res.status(200).json({ result: { budgetSettings }, alert: { variant: 'success', message: 'Settings saved' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to save settings' } })
    }
}

// ==================== BUDGET SHARING ====================

exports.shareBudget = async (req, res) => {
    try {
        // Always use the logged-in user's ID - you can only share YOUR OWN budget
        const userId = req.token.id
        const { username, role } = req.body

        if (!username) return res.status(400).json({ alert: { variant: 'danger', message: 'Username is required' } })

        const targetUser = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } })
        if (!targetUser) return res.status(404).json({ alert: { variant: 'danger', message: `User "${username}" not found` } })
        if (targetUser._id.toString() === userId) return res.status(400).json({ alert: { variant: 'danger', message: 'You cannot share your budget with yourself' } })

        const validRole = ['viewer', 'editor'].includes(role) ? role : 'viewer'

        const existing = await BudgetShare.findOne({ owner: userId, sharedWith: targetUser._id })
        if (existing) return res.status(400).json({ alert: { variant: 'danger', message: `Budget is already shared with ${targetUser.username}` } })

        await new BudgetShare({ owner: userId, sharedWith: targetUser._id, role: validRole }).save()

        const sharedUsers = await BudgetShare.find({ owner: userId }).populate('sharedWith', 'username avatar').lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_sharing_updated', { result: sharedUsers, userId, actorId: req.token.id })
        io.to(`budget:${targetUser._id.toString()}`).emit('budget_access_changed', { ownerId: userId })

        return res.status(200).json({ result: sharedUsers, alert: { variant: 'success', message: `Budget shared with ${targetUser.username} as ${validRole}` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to share budget' } })
    }
}

exports.unshareBudget = async (req, res) => {
    try {
        // Always use the logged-in user's ID - you can only manage YOUR OWN shares
        const userId = req.token.id
        const { targetUserId } = req.body

        if (!targetUserId) return res.status(400).json({ alert: { variant: 'danger', message: 'Target user ID is required' } })

        await BudgetShare.findOneAndDelete({ owner: userId, sharedWith: targetUserId })

        const sharedUsers = await BudgetShare.find({ owner: userId }).populate('sharedWith', 'username avatar').lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_sharing_updated', { result: sharedUsers, userId, actorId: req.token.id })
        io.to(`budget:${targetUserId}`).emit('budget_access_changed', { ownerId: userId, revoked: true })

        return res.status(200).json({ result: sharedUsers, alert: { variant: 'success', message: 'Budget access revoked' } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to unshare budget' } })
    }
}

exports.updateBudgetShare = async (req, res) => {
    try {
        // Always use the logged-in user's ID - you can only manage YOUR OWN shares
        const userId = req.token.id
        const { targetUserId, role } = req.body

        if (!targetUserId || !role) return res.status(400).json({ alert: { variant: 'danger', message: 'Target user and role are required' } })
        if (!['viewer', 'editor'].includes(role)) return res.status(400).json({ alert: { variant: 'danger', message: 'Role must be viewer or editor' } })

        await BudgetShare.findOneAndUpdate({ owner: userId, sharedWith: targetUserId }, { role })

        const sharedUsers = await BudgetShare.find({ owner: userId }).populate('sharedWith', 'username avatar').lean()

        const io = req.app.get('io')
        io.to(`budget:${userId}`).emit('budget_sharing_updated', { result: sharedUsers, userId, actorId: req.token.id })
        io.to(`budget:${targetUserId}`).emit('budget_access_changed', { ownerId: userId, newRole: role })

        return res.status(200).json({ result: sharedUsers, alert: { variant: 'success', message: `Role updated to ${role}` } })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to update role' } })
    }
}

exports.getSharedBudgets = async (req, res) => {
    try {
        // Always use the logged-in user's ID - find budgets shared WITH me
        const userId = req.token.id
        const shares = await BudgetShare.find({ sharedWith: userId }).populate('owner', 'username avatar').lean()
        return res.status(200).json({ result: shares })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load shared budgets' } })
    }
}

exports.getSharedUsers = async (req, res) => {
    try {
        // Always use the logged-in user's ID - find users I shared MY budget with
        const userId = req.token.id
        const shares = await BudgetShare.find({ owner: userId }).populate('sharedWith', 'username avatar').lean()
        return res.status(200).json({ result: shares })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'Failed to load shared users' } })
    }
}
