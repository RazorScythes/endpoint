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
    }
},{
    timestamps: true,
    collection: "exchangeRates"
})

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema)

module.exports = ExchangeRate
