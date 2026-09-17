import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const eveUsage=sqliteTable('eve_usage',{
 id:text('id').primaryKey(),calls:integer('calls').notNull().default(0)
});
export const courseSessions=sqliteTable('course_sessions',{
 user_id:text('user_id').primaryKey(),token_hash:text('token_hash').notNull(),
 seen_at:integer('seen_at').notNull(),call_id:text('call_id')
});
export const courseAccess=sqliteTable('course_access',{
 email:text('email').primaryKey(),
 active:integer('active').notNull().default(1),
 added_by:text('added_by').notNull(),
 created_at:integer('created_at').notNull(),
 updated_at:integer('updated_at').notNull()
});
