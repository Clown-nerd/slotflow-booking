import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { canTransitionAppointment } from "./booking";
import { createHeartbeatJob } from "./_core/heartbeat";
import {
  completeSimulatedPayment,
  addTargetAvailability,
  createDemoWorkspace,
  createPublicAppointment,
  createResource,
  createService,
  createStaffMember,
  ensurePublicDemoBusiness,
  getBusinessByOwner,
  getAvailableSlots,
  getBusinessSnapshot,
  getDashboardSnapshot,
  getPublicBookingSetup,
  renameResource,
  renameService,
  renameStaffMember,
  retrySimulatedPayment,
  setReminderScheduleTask,
  saveBusinessAvailability,
  setResourceActive,
  setServiceActive,
  setStaffActive,
  updateResource,
  updateReminderSettings,
  updateService,
  updateStaffMember,
  updateAppointmentState,
  simulateNextReminderBatch,
} from "./bookingDb";

const dateRangeInput = z.object({
  start: z.number().int(),
  end: z.number().int(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  booking: router({
    demoDashboard: publicProcedure
      .input(dateRangeInput)
      .query(async ({ input }) => {
        const business = await ensurePublicDemoBusiness();
        return getBusinessSnapshot(business, input.start, input.end);
      }),
    setupDemoWorkspace: protectedProcedure.mutation(async ({ ctx }) =>
      createDemoWorkspace(ctx.user.id)
    ),
    dashboard: protectedProcedure
      .input(dateRangeInput)
      .query(({ ctx, input }) =>
        getDashboardSnapshot(ctx.user.id, input.start, input.end)
      ),
    publicSetup: publicProcedure
      .input(z.object({ slug: z.string().min(1).max(96) }))
      .query(({ input }) => getPublicBookingSetup(input.slug)),
    availableSlots: publicProcedure
      .input(
        z.object({
          slug: z.string().min(1).max(96),
          serviceId: z.number().int().positive(),
          staffId: z.number().int().positive(),
          resourceId: z.number().int().positive().nullable().optional(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
      .query(({ input }) => getAvailableSlots(input)),
    createPublicAppointment: publicProcedure
      .input(
        z.object({
          slug: z.string().min(1).max(96),
          serviceId: z.number().int().positive(),
          staffId: z.number().int().positive(),
          resourceId: z.number().int().positive().nullable().optional(),
          startsAt: z.number().int(),
          bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          customerName: z.string().trim().min(2).max(120),
          customerEmail: z.string().email().nullable().optional(),
          customerPhone: z.string().trim().min(8).max(32),
          notes: z.string().trim().max(800).nullable().optional(),
        })
      )
      .mutation(({ input }) => createPublicAppointment(input)),
    completeSimulatedPayment: publicProcedure
      .input(
        z.object({
          providerReference: z.string().min(8).max(80),
          outcome: z.enum(["paid", "failed"]),
        })
      )
      .mutation(({ input }) =>
        completeSimulatedPayment(input.providerReference, input.outcome)
      ),
    retrySimulatedPayment: publicProcedure
      .input(z.object({ providerReference: z.string().min(8).max(80) }))
      .mutation(({ input }) => retrySimulatedPayment(input.providerReference)),
    updateAppointmentState: protectedProcedure
      .input(
        z.object({
          appointmentId: z.number().int().positive(),
          from: z.enum([
            "pending",
            "paid",
            "confirmed",
            "cancelled",
            "completed",
          ]),
          to: z.enum([
            "pending",
            "paid",
            "confirmed",
            "cancelled",
            "completed",
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!canTransitionAppointment(input.from, input.to))
          throw new Error("That appointment transition is not allowed.");
        return updateAppointmentState(
          ctx.user.id,
          input.appointmentId,
          input.to
        );
      }),
    createService: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          description: z.string().trim().max(600).optional(),
          durationMinutes: z.number().int().min(15).max(480),
          priceCents: z.number().int().min(0).max(10_000_000),
          depositCents: z.number().int().min(0).max(10_000_000),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        })
      )
      .mutation(({ ctx, input }) => createService(ctx.user.id, input)),
    setServiceActive: protectedProcedure
      .input(
        z.object({
          serviceId: z.number().int().positive(),
          active: z.boolean(),
        })
      )
      .mutation(({ ctx, input }) =>
        setServiceActive(ctx.user.id, input.serviceId, input.active)
      ),
    renameService: protectedProcedure
      .input(
        z.object({
          serviceId: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
        })
      )
      .mutation(({ ctx, input }) =>
        renameService(ctx.user.id, input.serviceId, input.name)
      ),
    updateService: protectedProcedure
      .input(
        z.object({
          serviceId: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
          durationMinutes: z.number().int().min(15).max(480),
          priceCents: z.number().int().min(0).max(10_000_000),
          depositCents: z.number().int().min(0).max(10_000_000),
        })
      )
      .mutation(({ ctx, input }) => updateService(ctx.user.id, input)),
    createStaffMember: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          roleTitle: z.string().trim().max(100).optional(),
          email: z.string().email().optional(),
          phone: z.string().trim().max(32).optional(),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          serviceIds: z.array(z.number().int().positive()).max(30),
        })
      )
      .mutation(({ ctx, input }) => createStaffMember(ctx.user.id, input)),
    setStaffActive: protectedProcedure
      .input(
        z.object({ staffId: z.number().int().positive(), active: z.boolean() })
      )
      .mutation(({ ctx, input }) =>
        setStaffActive(ctx.user.id, input.staffId, input.active)
      ),
    renameStaffMember: protectedProcedure
      .input(
        z.object({
          staffId: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
        })
      )
      .mutation(({ ctx, input }) =>
        renameStaffMember(ctx.user.id, input.staffId, input.name)
      ),
    updateStaffMember: protectedProcedure
      .input(
        z.object({
          staffId: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
          roleTitle: z.string().trim().max(100).optional(),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().trim().max(32).optional(),
          serviceIds: z.array(z.number().int().positive()).max(30),
        })
      )
      .mutation(({ ctx, input }) => updateStaffMember(ctx.user.id, input)),
    createResource: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          resourceType: z.string().trim().min(2).max(60),
          capacity: z.number().int().min(1).max(50),
        })
      )
      .mutation(({ ctx, input }) => createResource(ctx.user.id, input)),
    setResourceActive: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int().positive(),
          active: z.boolean(),
        })
      )
      .mutation(({ ctx, input }) =>
        setResourceActive(ctx.user.id, input.resourceId, input.active)
      ),
    renameResource: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
        })
      )
      .mutation(({ ctx, input }) =>
        renameResource(ctx.user.id, input.resourceId, input.name)
      ),
    updateResource: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int().positive(),
          name: z.string().trim().min(2).max(120),
          resourceType: z.string().trim().min(2).max(60),
          capacity: z.number().int().min(1).max(50),
        })
      )
      .mutation(({ ctx, input }) => updateResource(ctx.user.id, input)),
    saveBusinessAvailability: protectedProcedure
      .input(
        z
          .object({
            dayOfWeek: z.number().int().min(0).max(6),
            startMinute: z.number().int().min(0).max(1439),
            endMinute: z.number().int().min(1).max(1440),
            active: z.boolean(),
          })
          .refine(value => value.endMinute > value.startMinute, {
            message: "End time must be later than start time.",
          })
      )
      .mutation(({ ctx, input }) =>
        saveBusinessAvailability(ctx.user.id, input)
      ),
    addTargetAvailability: protectedProcedure
      .input(
        z
          .object({
            targetType: z.enum(["staff", "resource"]),
            targetId: z.number().int().positive(),
            dayOfWeek: z.number().int().min(0).max(6),
            startMinute: z.number().int().min(0).max(1439),
            endMinute: z.number().int().min(1).max(1440),
          })
          .refine(value => value.endMinute > value.startMinute, {
            message: "End time must be later than start time.",
          })
      )
      .mutation(({ ctx, input }) => addTargetAvailability(ctx.user.id, input)),
    simulateNextReminderBatch: protectedProcedure.mutation(({ ctx }) =>
      simulateNextReminderBatch(ctx.user.id)
    ),
    updateReminderSettings: protectedProcedure
      .input(
        z
          .object({
            smsEnabled: z.boolean(),
            emailEnabled: z.boolean(),
            leadHours: z.number().int().min(1).max(168),
          })
          .refine(value => value.smsEnabled || value.emailEnabled, {
            message: "Choose at least one reminder channel.",
          })
      )
      .mutation(({ ctx, input }) => updateReminderSettings(ctx.user.id, input)),
    activateReminderSimulation: protectedProcedure.mutation(async ({ ctx }) => {
      const business = await getBusinessByOwner(ctx.user.id);
      if (!business)
        throw new Error("Set up a workspace before activating reminders.");
      if (business.scheduleCronTaskUid)
        return { taskUid: business.scheduleCronTaskUid, alreadyActive: true };
      const sessionToken =
        parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob(
        {
          name: `slotflow-reminders-${business.id}`,
          cron: "0 0 * * * *",
          path: "/api/scheduled/send-reminders",
          payload: { businessId: business.id },
          description: `Run the SlotFlow reminder simulator for ${business.name}.`,
        },
        sessionToken
      );
      await setReminderScheduleTask(ctx.user.id, job.taskUid);
      return { taskUid: job.taskUid, alreadyActive: false };
    }),
  }),
});

export type AppRouter = typeof appRouter;
