const mongoose = require('mongoose')
const Schema = mongoose.Schema

const budgetListSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#3b82f6' },
    icon: { type: String, default: 'peso-sign' },
    currency: { type: String, default: '₱' },
    showCurrency: { type: Boolean, default: true },
    items: [{
        name: { type: String, required: true },
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['add', 'subtract'], default: 'subtract' },
        checked: { type: Boolean, default: false },
        notes: { type: String, default: '' },
    }],
}, {
    timestamps: true,
    collection: 'budgetLists'
})

module.exports = mongoose.model('BudgetList', budgetListSchema)
