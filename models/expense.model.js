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
    attachments: [{ type: String }],
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly', ''], default: '' },
    recurrenceEnd: { type: Date, default: null },
    recurrenceParentId: { type: Schema.Types.ObjectId, ref: 'Expense', default: null },
},{
    timestamps: true,
    collection: "expenses"
})

const Expense = mongoose.model('Expense', expenseSchema)

module.exports = Expense
