import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const eveUsage=sqliteTable('eve_usage',{
 id:text('id').primaryKey(),calls:integer('calls').notNull().default(0)
});
