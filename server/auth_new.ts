import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as UserSchema } from "@shared/schema";

// Extend the Express namespace to add the user type
declare global {
  namespace Express {
    interface User extends Omit<UserSchema, "passwordHash"> {
      passwordHash?: string;
    }
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-secret-do-not-use-in-prod",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport to use a simple LocalStrategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);

        // For demo purposes, we're storing the plain password in the passwordHash field
        if (!user || user.passwordHash !== password) {
          console.log(`Login attempt for ${username} failed`);
          return done(null, false);
        }

        console.log(`User ${username} logged in successfully`);
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Create admin user if it doesn't exist
  (async () => {
    try {
      const adminUser = await storage.getUserByUsername("admin");
      if (!adminUser) {
        console.log("Creating default admin user");
        await storage.createUser({
          username: "admin",
          password: "hygdog-gucke0-westuJ",
          fullName: "System Administrator",
          isActive: true,
          isAdmin: true,
        });
      }
    } catch (error) {
      console.error("Error creating admin user:", error);
    }
  })();

  // Register route - only for admin users to create new accounts
  app.post("/api/register", async (req, res, next) => {
    try {
      // In a real app, you'd check if the current user is an admin
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create user with plaintext password for demo
      const user = await storage.createUser({
        ...req.body,
        password: req.body.password,
      });

      // Exclude sensitive data
      const { passwordHash, ...userWithoutPassword } = user;

      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: UserSchema | false) => {
      if (err) return next(err);
      if (!user)
        return res
          .status(401)
          .json({ message: "Invalid username or password" });

      req.login(user, (err) => {
        if (err) return next(err);

        // Exclude sensitive data
        const { passwordHash, ...userWithoutPassword } = user;

        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user route
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Exclude sensitive data
    const { passwordHash, ...userWithoutPassword } = req.user as UserSchema;

    res.json(userWithoutPassword);
  });
}
