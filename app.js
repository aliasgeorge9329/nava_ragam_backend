//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
var flash = require("connect-flash")
var ObjectId = require('mongodb').ObjectID;
const useragent = require('express-useragent');
var nodemailer = require('nodemailer');


const app = express();
const port = process.env.PORT || 3000

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "User Login Session",
  resave: false,
  saveUninitialized: false
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(useragent.express());

users_printed_login_admin = [];
admin_usernames = process.env.ADMIN_ID;
// add admin as admin1|admin2| ..
admin_username = admin_usernames.trim().split("|")
mongoDB = process.env.MONGO;
mailer_ID = process.env.EMAIL_ID

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: mailer_ID,
    pass: process.env.PASS,
  }
});



mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true, required: true },
  googleId: String,
  college: String,
  sentence: String,
  status: String
});


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "https://pretathva.herokuapp.com/auth/google/compose",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  redirect_uri: "https://pretathva.herokuapp.com/auth/google/compose"
},
  function (accessToken, refreshToken, profile, cb) {
    // console.log(profile);

    User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile", "email"] })
);

app.get("/auth/google/compose",
  passport.authenticate('google', { failureRedirect: "/" }),
  function (req, res) {
    // Successful authentication, redirect to compose.

    if (admin_username.indexOf(String(req["user"].username).trim()) != -1) {
      res.redirect("/admin");
    }

    else {
      res.redirect("/compose");
    }
  });



// Home Route
app.get("/", function (req, res) {

  User.find({ status: "accepted" }, { googleId: 0, username: 0, __v: 0, status: 0, _id: 0 }, function (err, all_user) {
    if (err) {
      console.log(err);
    }
    else {
      //For getting last appended 12 data's
      if (all_user.length > 12) {
        new_user_array = all_user.slice(all_user.length - 12, all_user.length)
      }
      else {
        new_user_array = all_user;
      };

      if (req.useragent["isDesktop"] == true) {
        // console.log(JSON.stringify(all_user));
        // res.render("new_home", { data: JSON.stringify(new_user_array) });
        res.render("home", { data: JSON.stringify(new_user_array) });
      }
      else {
        res.render("mobile_home", { data: JSON.stringify(new_user_array) });
      }

    }

  });


});



app.get("/compose", function (req, res) {

  if (req.isAuthenticated()) {
    message_ = req.flash('message')[0];
    sentence_ = req["user"].sentence;

    if (sentence_ == null && message_ == null) {
      res.render("compose", { message: "fresh" });
    }
    else if (sentence_ != null && message_ == null) {
      res.render("compose", { message: "alreadysaved", sentence: sentence_, status: req["user"].status });
    }
    else if (sentence_ != null && message_ != null) {
      res.render("compose", { message: message_, sentence: sentence_ });
    }

  } else {
    res.redirect("/")
  }

});



app.post("/compose", function (req, res) {
  const user_sentence = req.body.sentence;
  name_ = req.body.name;
  college_ = req.body.college;

  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
  // console.log(req.user);

  User.findById(req.user._id, function (err, foundUser) {
    if (err) {
      console.log(err);
    }

    else {
      if (foundUser) {
        foundUser.sentence = String(user_sentence).split(' ').filter(word => word).join(' ');
        foundUser.name = name_;
        foundUser.college = college_;
        foundUser.save(function () {
          req.flash('message', "saved")
          res.redirect("/compose");
        });
      }
    }

  });
});



app.get("/admin", function (req, res) {
  if (req.isAuthenticated() && (admin_username.indexOf(String(req["user"].username).trim()) != -1)) {
    message_ = req.flash('message')[0];
    User.find({}, { googleId: 0, username: 0, __v: 0, college: 0 }, function (err, all_user) {
      if (err) {
        console.log(err);
      }
      else {
        all_user.forEach(function (each) {
          if (each.status == null && (admin_username.indexOf(String(each.username).trim()) != -1) && each.sentence != null) {
            globalThis.users_printed_login_admin.push(String(each._id));
          }
        })
        res.render("admin", { user: all_user, err_msg: message_ });
      }
    });
  } else {
    res.redirect("/");
  }
});


app.post("/admin", function (req, res) {

  if (req.isAuthenticated() && (admin_username.indexOf(String(req["user"].username).trim()) != -1)) {
    accepted_ = Object.keys(req.body);
    accepted_.pop();
    rejected = globalThis.users_printed_login_admin.filter((el) => !accepted_.includes(el));
    approved = accepted_;

    rejected.forEach(function (id) {
      User.findById(ObjectId(id), function (err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          foundUser.status = "rejected";
          foundUser.save();
        };

      });

    });

    accepted_.forEach(function (id) {
      User.findById(ObjectId(id), function (err, foundUser) {

        if (err) {
          console.log(err);
        }

        else {
          foundUser.status = "accepted";
          foundUser.save();

          var mailOptions = {
            from: mailer_ID,
            to: foundUser.username,
            subject: 'PRE TATHVA',
            text: 'Hi ' + foundUser.name + '! YOUR QUOTE ACCEPTED \n\nThe quote you filled for pre_tathva is accepted by admin.\nCongratulations for you quote \n ' + foundUser.sentence + '\n\n\nWith Regards\nTathva Tech Team'
          };

          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            }

            else {
              console.log('Email sent: ' + info.response);
            }
          });

        };

      });


    });

    req.flash('message', "saved")
    users_printed_login_admin = [];
    res.redirect("/admin");

  }

});

app.post("/modify_accepted", function (req, res) {
  if (req.isAuthenticated() && (admin_username.indexOf(String(req["user"].username).trim()) != -1)) {
    to_reject_ = Object.keys(req.body);
    to_reject_.pop();
    to_reject = to_reject_;

    to_reject_.forEach(function (id) {
      User.findById(ObjectId(id), function (err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          foundUser.status = "rejected";
          foundUser.save();
        };

      });

    });

    req.flash('message', "saved")
    users_printed_login_admin = [];
    res.redirect("/admin");

  }

});


app.get("/print", function (req, res) {
  if (req.isAuthenticated() && (admin_username.indexOf(String(req["user"].username).trim()) != -1)) {
    User.find({}, { googleId: 0, __v: 0, _id: 0 }, function (err, all_user) {
      print_user = []
      all_user.forEach(function (each) {
        if (admin_username.indexOf(String(each.username).trim()) == -1 && each.sentence != null) {
          print_user.push(each);
        }
      })
      res.render("print", { data: JSON.stringify(print_user) });
    });
  }
  else {
    res.redirect("/")
  }
});



app.get("/logout", function (req, res) {
  req.logOut();
  res.status(200).clearCookie('connect.sid', {
    path: '/'
  });
  req.session.destroy(function (e) {

    res.redirect('/');
  });
});


app.listen(port, function () {
  console.log("Server started Successfully");
});




