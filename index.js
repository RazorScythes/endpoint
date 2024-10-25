/* NODE MODULES */
const hsts                      = require('hsts')
const express                   = require('express')
const cors                      = require('cors')
const morgan                    = require('morgan')
const path                      = require('path')
const mongoose                  = require('mongoose')

require('dotenv').config();

/* MODELS */
const users                     = require('./models/user.model')
const profile                   = require('./models/profile.model')
const settings                  = require('./models/settings.model')

/* API */
const user                      = require('./routes/user')

const app   = express()
const port  = process.env.PORT
const db    = mongoose.connection

/* START SERVER */
mongoose.connect(process.env.MONGODB_URI, {   
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(() => {
    app.listen(port, (err) => {
        if(err) throw err
        console.log(`Server is running on PORT: ${port}`)
    })
})

db.once('open', () => {
    console.log('Database Connection Established')
})

/* MIDDLEWARE */
app.use(hsts({
    maxAge: 31536000,       
    includeSubDomains: true,
    preload: true
}))

app.use(morgan('dev'))
app.use(express.urlencoded({
    limit: '55mb',
    parameterLimit: 100000,
    extended: true 
}))

app.use(express.json({limit: '150mb'}))

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', req.header('origin') );
    next();
});

app.use(cors({
    origin: function(origin, callback){
      return callback(null, true);
    },
    optionsSuccessStatus: 200,
    credentials: true
}))

/* ROUTES */
app.get("/", async function(req, res) {
    res.send(`GET Request`);
})

app.use('/user', user);
