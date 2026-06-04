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
  walletBalanceKobo: integer("wallet_balance_kobo").notNull().default(0),
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
  wellnessNewsletterEnabled: boolean("wellness_newsletter_enabled").notNull().default(true),
  whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
  messagesEnabled: boolean("messages_enabled").notNull().default(false),
  callTaskSmsEnabled: boolean("call_task_sms_enabled").notNull().default(false),
  followupSmsEnabled: boolean("followup_sms_enabled").notNull().default(false),
  appointmentReminderSmsEnabled: boolean("appointment_reminder_sms_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type HospitalModules = typeof hospitalModulesTable.$inferSelect;

export const hospitalStaffCredentialsTable = pgTable("hospital_staff_credentials", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().unique(),
  nurseUsername: text("nurse_username").notNull(),
  nursePasswordHash: text("nurse_password_hash").notNull(),
  receptionistUsername: text("receptionist_username").notNull(),
  receptionistPasswordHash: text("receptionist_password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type HospitalStaffCredentials = typeof hospitalStaffCredentialsTable.$inferSelect;
