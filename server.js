require('dotenv').config();

process.env.DEBUG = 'nuxt:*'

const { Nuxt, Builder } = require('nuxt');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = require('express')();

// Body parser, to access req.body
app.use(bodyParser.json());

// Sessions to create req.session
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
}));

// postas loginui. Reikalingas, kad butu pasiekiama $store.state.authUser
app.post('/api/login', function(req, res) {
    if (req.body.username === 'demo' && req.body.password === 'demo') {
        req.session.authUser = { username: 'demo' }; //paliekam username, visa kita griebsim su juo + pasitikesim authUser
        return res.json({ username: 'demo' });
    }
    res.status(401).json({ error: 'Bad credentials' });
});

app.post('/api/register', function(req, res) {
    if (req.body.username === 'demo' && req.body.password === 'demo') {
        req.session.authUser = { username: 'demo' }; //paliekam username, visa kita griebsim su juo + pasitikesim authUser
        return res.json({ username: 'demo' });
    }
    res.status(401).json({ error: 'Bad credentials' });
});

// removinam useri is req.session on logout
app.post('/api/logout', function(req, res) {
    delete req.session.authUser;
    res.json({ ok: true });
});

//nuxt config
let config = require('./nuxt.config.js');
config.dev = !(process.env.NODE_ENV === 'production');
const nuxt = new Nuxt(config);

//nuxt build
if (config.dev) {
    const builder = new Builder(nuxt);
    builder.build();
};
// No build in production

app.use(nuxt.render);
app.listen(10700);
console.log('Server is listening on http://localhost:10700');