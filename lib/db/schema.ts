import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  unique,
} from 'drizzle-orm/pg-core'

// Better Auth tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// App tables
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  homeTeam: text('homeTeam').notNull(),
  awayTeam: text('awayTeam').notNull(),
  homeFlag: text('homeFlag'),
  awayFlag: text('awayFlag'),
  matchDate: timestamp('matchDate').notNull(),
  homeScore: integer('homeScore'),
  awayScore: integer('awayScore'),
  stage: text('stage').notNull().default('Fase de Grupos'),
  group: text('group'),
  status: text('status').notNull().default('scheduled'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const predictions = pgTable(
  'predictions',
  {
    id: serial('id').primaryKey(),
    userId: text('userId').notNull(),
    matchId: integer('matchId').notNull(),
    predictedWinner: text('predictedWinner').notNull(),
    predictedHomeScore: integer('predictedHomeScore'),
    predictedAwayScore: integer('predictedAwayScore'),
    points: integer('points').default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.matchId)]
)
