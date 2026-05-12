const mongoose = require('mongoose')
const Schema = mongoose.Schema

const budgetShareSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedWith: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['viewer', 'editor'],
        default: 'viewer'
    }
}, {
    timestamps: true,
    collection: 'budgetShares'
})

budgetShareSchema.index({ owner: 1, sharedWith: 1 }, { unique: true })
budgetShareSchema.index({ sharedWith: 1 })

const BudgetShare = mongoose.model('BudgetShare', budgetShareSchema)

module.exports = BudgetShare
