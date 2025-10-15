import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';

dotenv.config();

export const userSessionMiddleware = session({
  name: 'userSessionId',
  secret: process.env.SESSION_SECRET_USER || 'userSecretKey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'userSessions',
    ttl: 1000 * 60 * 60, // 5 minutes
  }),
  cookie: {
    maxAge: 1000 * 60 * 60, // 5 minutes
    httpOnly: true,
    secure: false, 
  },
});

export const adminSessionMiddleware = session({
  name: 'adminSessionId',
  secret: process.env.SESSION_SECRET_ADMIN || 'adminSecretKey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'adminSessions',
    ttl: 1000 * 60 * 60, // 5 minutes
  }),
  cookie: {
    maxAge: 1000 * 60 * 60, // 5 minutes
    httpOnly: true,
    secure: false, 
  },
});

