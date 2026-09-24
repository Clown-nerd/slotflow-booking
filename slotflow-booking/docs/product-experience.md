# SlotFlow Product Experience

SlotFlow is a confident, calm operations hub for an appointment-led business. The interface is designed to make time feel legible: operators can see the day at a glance, understand capacity before making a change, and move a customer from selection to confirmation without ambiguity.

> **Message hierarchy:** Run your day with clarity → see capacity and upcoming bookings → manage the schedule confidently → invite customers to book.

## Core Roles and Journeys

| Role              | Primary journey                                                                                                   | Completion signal                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Business operator | Review today, adjust availability, manage a booking, and inspect payment state.                                   | The calendar and appointment record agree on the current status. |
| Customer          | Select a service, staff member, date, and valid time; enter contact details; pay a deposit; receive confirmation. | A confirmation reference and reminder schedule are shown.        |
| Staff member      | See their schedule, prepare for upcoming work, and update an appointment outcome.                                 | Appointment is marked completed, rescheduled, or cancelled.      |

## Domain Model

| Entity            | Purpose                                                                                      | Key rules                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Business profile  | Establishes the booking context and display defaults.                                        | Holds name, timezone, booking settings, and confirmation rules.                   |
| Service           | A bookable offering with price, duration, deposit, and resource requirements.                | A service is active only when it can be scheduled against availability.           |
| Staff member      | A person who can deliver selected services.                                                  | A staff member cannot receive overlapping appointments.                           |
| Resource          | A bookable place or asset, such as a treatment room, chair, or tutoring booth.               | A required resource cannot be double-booked.                                      |
| Availability rule | Defines weekly working windows and time off.                                                 | Available slots are derived in UTC and presented in the visitor’s local timezone. |
| Appointment       | Binds the customer, service, staff, optional resource, start/end times, and lifecycle state. | Appointment creation rechecks all conflicts at the server boundary.               |
| Deposit payment   | Tracks the M-Pesa payment request and result.                                                | A pending booking only becomes paid after a verified simulator event.             |
| Reminder event    | Audits planned and sent appointment reminders.                                               | A reminder can be recorded only once per appointment, channel, and offset.        |

## Appointment Lifecycle

| State     | Meaning                                                     | Allowed next states        |
| --------- | ----------------------------------------------------------- | -------------------------- |
| Pending   | Time is held while the customer completes the deposit step. | Paid, Confirmed, Cancelled |
| Paid      | Deposit payment succeeded and awaits confirmation policy.   | Confirmed, Cancelled       |
| Confirmed | The customer’s appointment is secured.                      | Completed, Cancelled       |
| Cancelled | The booking no longer reserves staff or resources.          | —                          |
| Completed | The appointment took place.                                 | —                          |

## Visual Direction

The application uses a warm porcelain canvas, ink-black type, mist-grey dividers, and deep olive accents. The style borrows from boutique hospitality rather than generic SaaS: ample whitespace, quiet rounded forms, editorial serif headlines, and crisp monospaced booking references. Status is expressed with text, iconography, and colour together.

Motion is deliberately limited to short opacity and transform transitions on dialogs, dropdowns, and schedule cards. The system keeps every important control and state readable without motion and removes non-essential animation when a visitor requests reduced motion.

| Token            | Implementation                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Reading type     | DM Sans, 16px base, with 14px metadata and 12px labels.                                                                 |
| Display type     | Fraunces, used only for key page and empty-state headlines.                                                             |
| Operational text | DM Mono for payment receipts, time ranges, and booking references.                                                      |
| Brand accent     | Deep olive for primary actions, paired with a near-white foreground.                                                    |
| Surface system   | Warm porcelain page background, off-white cards, and muted sage status surfaces.                                        |
| Motion policy    | 160–300ms opacity and transform enhancement only; all non-essential motion is removed under reduced-motion preferences. |

## State Design

| Situation                         | Interface response                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Initial data is loading           | Show structured skeleton cards and preserve the final layout’s dimensions.                             |
| No appointments match a filter    | Explain why the calendar is empty and offer a direct path to create or clear filters.                  |
| A field is invalid                | Add a specific inline message, preserve the user’s input, and move focus to the first error on submit. |
| Selected slot becomes unavailable | Keep the customer’s progress and ask them to select a refreshed time.                                  |
| Deposit is pending                | Show the amount, customer phone number, a visible progress state, and a cancel/retry choice.           |
| Deposit is paid                   | Show a success state with booking reference, calendar summary, and scheduled reminder details.         |
