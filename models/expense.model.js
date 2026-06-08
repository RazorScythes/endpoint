const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const expenseSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    date: { type: Date, required: true },
    description: { type: String, required: true },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'BudgetCategory'
    },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense'], default: 'expense' },
    paymentMethod: { type: String, default: 'Cash' },
    notes: { type: String, default: '' },
    currency: { type: String, default: 'PHP' },
    listOnly: { type: Boolean, default: false },
    attachments: [{ type: String }],
    tags: [{ type: String }],
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly', ''], default: '' },
    recurrenceEnd: { type: Date, default: null },
    recurrenceParentId: { type: Schema.Types.ObjectId, ref: 'Expense', default: null },
},{
    timestamps: true,
    collection: "expenses"
})

expenseSchema.index({ user: 1, date: -1 })
expenseSchema.index({ user: 1, category: 1 })
expenseSchema.index({ user: 1, isRecurring: 1 })
expenseSchema.index({ user: 1, recurrenceParentId: 1, date: -1 })

const Expense = mongoose.model('Expense', expenseSchema)

module.exports = Expense
