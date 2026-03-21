const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const budgetCategorySchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    name: { type: String, required: true },
    icon: { type: String, default: '' },
    color: { type: String, default: '#3b82f6' },
    type: { type: String, enum: ['expense', 'income'], default: 'expense' },
    budget: { type: Number, default: 0 }
},{
    timestamps: true,
    collection: "budgetCategories"
})

const BudgetCategory = mongoose.model('BudgetCategory', budgetCategorySchema)

module.exports = BudgetCategory
