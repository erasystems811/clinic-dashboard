import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hospitalsTable = pgTable("hospitals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  logoUrl: text("logo_url"),
  active: boolean("active").notNull().default(true),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHospitalSchema = createInsertSchema(hospitalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHospital = z.infer<typeof insertHospitalSchema>;
export type Hospital = typeof hospitalsTable.$inferSelect;

export const hospitalSettingsTable = pgTable("hospital_settings", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().unique(),
  departments: text("departments").default("[]"),
  pipelinePostTreatmentDays: integer("pipeline_post_treatment_days").default(7),
  pipelineDormantDays: integer("pipeline_dormant_days").default(30),
  language: text("language").default("English"),
  tone: text("tone").default("Formal"),
  clinicDescription: text("clinic_description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type HospitalSettings = typeof hospitalSettingsTable.$inferSelect;

export const hospitalModulesTable = pgTable("hospital_modules", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().unique(),
  appointmentsEnabled: boolean("appointments_enabled").notNull().default(true),
  feedbackEnabled: boolean("feedback_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type HospitalModules = typeof hospitalModulesTable.$inferSelect;
