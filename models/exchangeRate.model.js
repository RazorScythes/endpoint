const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const exchangeRateSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        unique: true
    },
    baseCurrency: {
        type: String,
        default: 'PHP'
    },
    rates: {
        type: Map,
        of: Number,
        default: {}
    },
    budgetSettings: {
        paymentMethods: { type: [String], default: [] },
        numberFormat: { type: String, default: 'en-PH' },
        dateFormat: { type: String, default: 'en-US' },
        decimalPlaces: { type: Number, default: 2 },
        startOfWeek: { type: String, default: 'monday' },
    }
},{
    timestamps: true,
    collection: "exchangeRates"
})

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema)

module.exports = ExchangeRate
