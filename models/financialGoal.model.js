const mongoose = require('mongoose')
const Schema = mongoose.Schema

const financialGoalSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date, default: null },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'BudgetCategory',
        default: null
    },
    color: { type: String, default: '#3b82f6' },
    icon: { type: String, default: 'bullseye' },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    contributions: [{
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        notes: { type: String, default: '' }
    }]
}, {
    timestamps: true,
    collection: 'financialGoals'
})

module.exports = mongoose.model('FinancialGoal', financialGoalSchema)
