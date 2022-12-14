if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
// const morgan = require('morgan');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const mongoSanitize = require('express-mongo-sanitize');

const ExpressError = require('./utils/ExpressError');

const campgroundRoutes = require('./routes/campgrounds');
const reviewRoutes = require('./routes/reviews');
const userRoutes = require('./routes/users');

const User = require('./models/user');

const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/yelp-camp';
const secret = process.env.SECRET || 'opensecret';

mongoose.set('strictQuery', true); // included to suppress console warning when connecting to mongodb server
mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}); //connecting to mongodb server

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Database connected');
});

const app = express();
// app.use(morgan('tiny')); //console logs info on each request

app.engine('ejs', ejsMate); //telling express to use ejsMate for the ejs engine instead of the default one
app.set('view engine', 'ejs'); //sets the view engine to ejs and "view" is the folder where web pages are kept
app.set('views', path.join(__dirname, 'views')); //serves static files in the views folder

//needed for POST and PUT requests to parse body
app.use(express.urlencoded({ extended: true })); // recognizes the incoming request obj as strings or arrays
app.use(express.json()); //recognizes the incoming request obj as a JSON object and parses it
app.use(methodOverride('_method')); //allows for override of method type in front end form requests

app.use(express.static(path.join(__dirname, 'public'))); // serves static files from the public directory

app.use(mongoSanitize()); //prevents any query/params/body with potentially harmful mongo scripts (i.e. includes $)

const store = MongoStore.create({
  mongoUrl: dbUrl,
  secret,
  touchAfter: 60 * 60 * 24,
});

store.on('error', (err) => {
  console.log('SESSION STORE ERROR: ', err);
});

//re-configure to store in .env file
const sessionConfig = {
  store,
  name: 'campers_yelp_session',
  secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    // secure: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session()); //needed to persistent login sessions
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

//express route handlers
app.use('/', userRoutes);
app.use('/campgrounds', campgroundRoutes);
app.use('/campgrounds/:id/reviews', reviewRoutes);

//root route handler
app.get('/', (req, res) => {
  res.render('home');
});

//404 catch all route handler
app.all('*', (req, res, next) => {
  next(new ExpressError('Page Not Found', 404));
});

//default error handler
app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = 'Oh no, something went wrong!';
  res.status(statusCode).render('error', { err });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serving on PORT ${PORT}`);
});
