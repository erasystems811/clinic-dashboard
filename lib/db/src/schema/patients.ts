import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  nationalId: text("national_id"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  whatsappNumber: text("whatsapp_number"),
  age: integer("age"),
  gender: text("gender"),
  stage: text("stage").notNull().default("Booked"),
  preQueueStage: text("pre_queue_stage"),
  diagnosis: text("diagnosis"),
  doctor: text("doctor"),
  nextAppointment: text("next_appointment"),
  notes: text("notes"),
  treatmentPlan: text("treatment_plan"),
  treatmentType: text("treatment_type"),
  medicationTiming: text("medication_timing"),
  treatmentDurationDays: integer("treatment_duration_days"),
  treatmentEndDate: text("treatment_end_date"),
  checkedInAt: text("checked_in_at"),
  treatmentStartedAt: text("treatment_started_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;

export const pipelineStagesTable = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  order: integer("order").notNull().default(0),
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStagesTable).omit({ id: true });
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStagesTable.$inferSelect;

export const queueTable = pgTable("queue", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  patientName: text("patient_name").notNull(),
  position: integer("position").notNull(),
  appointmentId: integer("appointment_id"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQueueSchema = createInsertSchema(queueTable).omit({ id: true, addedAt: true });
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type QueueEntry = typeof queueTable.$inferSelect;

export const callTasksTable = pgTable("call_tasks", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  patientName: text("patient_name").notNull(),
  phone: text("phone").notNull(),
  reason: text("reason").notNull(),
  outcome: text("outcome"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  flaggedAt: timestamp("flagged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCallTaskSchema = createInsertSchema(callTasksTable).omit({ id: true, flaggedAt: true });
export type InsertCallTask = z.infer<typeof insertCallTaskSchema>;
export type CallTask = typeof callTasksTable.$inferSelect;
