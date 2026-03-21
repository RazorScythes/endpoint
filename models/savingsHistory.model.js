const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const savingsHistorySchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    changes: [{
        denomination: Number,
        previous: Number,
        current: Number,
        diff: Number,
    }],
    previousTotal: { type: Number, default: 0 },
    newTotal: { type: Number, default: 0 },
    diffTotal: { type: Number, default: 0 },
},{
    timestamps: true,
    collection: "savingsHistory"
})

const SavingsHistory = mongoose.model('SavingsHistory', savingsHistorySchema)

module.exports = SavingsHistory
