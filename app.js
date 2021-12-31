//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
var flash = require("connect-flash");
var ObjectId = require("mongodb").ObjectID;
var cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "User Login Session",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

admin_usernames = process.env.ADMIN_ID;
// add admin as admin1|admin2| ..
admin_username = admin_usernames.trim().split("|");
mongoDB = process.env.MONGO;

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true, required: true },
  googleId: String,
});

const quotesSchema = new mongoose.Schema(
  {
    sentence: String,
    status: String,
  },
  {
    timestamps: true,
  }
);

quotesSchema.plugin(findOrCreate);
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Quote = new mongoose.model("Quotes", quotesSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://navaragam.herokuapp.com/auth/google/admin",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      redirect_uri: "https://navaragam.herokuapp.com/auth/google/admin",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate(
        { googleId: profile.id, username: profile.emails[0].value },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/admin",
  passport.authenticate("google", { failureRedirect: "/" }),
  function (req, res) {
    // Successful authentication, redirect to compose.

    if (admin_username.indexOf(String(req["user"].username).trim()) != -1) {
      res.redirect("/admin");
    } else {
      User.deleteOne({ username: String(req["user"].username).trim() })
        .then(function () {})
        .catch(function (error) {
          console.log(error);
        });
      res.send("Not Permitted");
    }
  }
);

// Home Route
app.get("/", function (req, res) {
  // res.send("<h1>HOME</h1>");
  res.redirect("https://nava.ragam.live");
});

var quotescorOptions = {
  origin: "*",
  methods: "GET",
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

//Accepted Quotes fetch Route
app.get("/quotes/:no", cors(quotescorOptions), function (req, res) {
  Quote.find(
    { status: "accepted" },
    { __v: 0, status: 0, _id: 0, createdAt: 0, updatedAt: 0 },
    function (err, all_quotes) {
      if (err) {
        console.log(err);
      } else {
        if (parseInt(req.params.no) < all_quotes.length) {
          random_quotes = [];
          var random_no_arr = [];
          while (random_no_arr.length < parseInt(req.params.no)) {
            var r = Math.floor(Math.random() * all_quotes.length);
            if (random_no_arr.indexOf(r) === -1) random_no_arr.push(r);
          }

          for (i = 0; i < random_no_arr.length; i++) {
            random_no = random_no_arr[i];
            random_quotes.push(all_quotes[random_no]);
          }
          res.send(random_quotes);
        } else {
          res.send(all_quotes);
        }
      }
    }
  )
    .sort({ updatedAt: -1 })
    .limit(2 * parseInt(req.params.no));
  // res.send(JSON.stringify(all_quotes));
});

var composecorOptions = {
  origin: "*",
  methods: "POST",
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Post Compose Route
app.post("/compose", cors(composecorOptions), function (req, res) {
  const user_sentence = req.body.sentence;
  const quote = new Quote({
    sentence: String(user_sentence)
      .split(" ")
      .filter((word) => word)
      .join(" "),
  });
  quote.save(function () {
    req.flash("message", "saved");
    res.redirect("/");
  });
});

app.get("/admin", function (req, res) {
  if (
    req.isAuthenticated() &&
    admin_username.indexOf(String(req["user"].username).trim()) != -1
  ) {
    message_ = req.flash("message")[0];
    Quote.find(
      {},
      { __v: 0, createdAt: 0, updatedAt: 0 },
      function (err, all_quotes) {
        if (err) {
          console.log(err);
        } else {
          res.render("admin", { user: all_quotes, err_msg: message_ });
        }
      }
    );
  } else {
    res.redirect("/auth/google");
  }
});

app.post("/admin", function (req, res) {
  if (
    req.isAuthenticated() &&
    admin_username.indexOf(String(req["user"].username).trim()) != -1
  ) {
    accepted = [];
    rejected = [];
    let data = req.body;
    delete data.button;
    Object.keys(data).forEach((key) => {
      value = data[key];
      if (value == "reject") {
        rejected.push(key);
      } else if (value == "accept") {
        accepted.push(key);
      }
    });

    rejected.forEach(function (id) {
      Quote.findById(ObjectId(id), function (err, foundQuote) {
        if (err) {
          console.log(err);
        } else {
          foundQuote.status = "rejected";
          foundQuote.save();
        }
      });
    });

    accepted.forEach(function (id) {
      Quote.findById(ObjectId(id), function (err, foundQuote) {
        if (err) {
          console.log(err);
        } else {
          foundQuote.status = "accepted";
          foundQuote.save();
        }
      });
    });

    req.flash("message", "saved");
    res.redirect("/admin");
  } else {
    res.send("Not Permitted");
  }
});

app.post("/modify_accepted", function (req, res) {
  if (
    req.isAuthenticated() &&
    admin_username.indexOf(String(req["user"].username).trim()) != -1
  ) {
    to_reject_ = Object.keys(req.body);
    to_reject_.pop();
    to_reject = to_reject_;

    to_reject_.forEach(function (id) {
      Quote.findById(ObjectId(id), function (err, foundQuote) {
        if (err) {
          console.log(err);
        } else {
          foundQuote.status = "rejected";
          foundQuote.save();
        }
      });
    });

    req.flash("message", "saved");
    users_printed_login_admin = [];
    res.redirect("/admin");
  } else {
    res.send("Not Permitted");
  }
});

app.get("/print", function (req, res) {
  if (
    req.isAuthenticated() &&
    admin_username.indexOf(String(req["user"].username).trim()) != -1
  ) {
    Quote.find(
      {},
      { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 },
      function (err, all_user) {
        print_user = [];
        all_user.forEach(function (each) {
          if (
            admin_username.indexOf(String(each.username).trim()) == -1 &&
            each.sentence != null
          ) {
            print_user.push(each);
          }
        });
        res.render("print", { data: JSON.stringify(print_user) });
      }
    );
  } else {
    res.send("Not Permitted");
  }
});

app.get("/logout", function (req, res) {
  req.logOut();
  res.status(200).clearCookie("connect.sid", {
    path: "/",
  });
  req.session.destroy(function (e) {
    res.redirect("/");
  });
});

app.listen(port, function () {
  console.log("Server started Successfully");
});
