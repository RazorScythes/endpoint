const mongoose = require('mongoose')
const Schema = mongoose.Schema

const debtSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    name: { type: String, required: true },
    type: { type: String, enum: ['owe', 'owed'], default: 'owe' },
    person: { type: String, default: '' },
    total_amount: { type: Number, required: true },
    amount_paid: { type: Number, default: 0 },
    due_date: { type: Date, default: null },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'paid'], default: 'active' },
    payments: [{
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        notes: { type: String, default: '' }
    }]
}, {
    timestamps: true,
    collection: "debts"
})

module.exports = mongoose.model('Debt', debtSchema)
