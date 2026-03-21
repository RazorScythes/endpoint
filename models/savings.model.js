const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const savingsSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        unique: true
    },
    denominations: {
        1000: { type: Number, default: 0 },
        500:  { type: Number, default: 0 },
        200:  { type: Number, default: 0 },
        100:  { type: Number, default: 0 },
        50:   { type: Number, default: 0 },
        20:   { type: Number, default: 0 },
        10:   { type: Number, default: 0 },
        5:    { type: Number, default: 0 },
        1:    { type: Number, default: 0 },
    }
},{
    timestamps: true,
    collection: "savings"
})

const Savings = mongoose.model('Savings', savingsSchema)

module.exports = Savings
