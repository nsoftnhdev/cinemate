import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest function to save user data to a datebase
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;
    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      name: first_name + " " + last_name,
      image: image_url,
    };
    await User.create(userData);
  }
);

// Inngest function to delete user from datebase
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { id } = event.data;
    await User.findByIdAndDelete(id);
  }
);

// Inngest function to update user data in datebase
const syncUserUpdation = inngest.createFunction(
  { id: "update-user-with-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;
    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      name: first_name + " " + last_name,
      image: image_url,
    };
    await User.findByIdAndUpdate(id, userData);
  }
);

// Inngest function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made
const releaseSeatsAndDeleteBooking = inngest.createFunction(
  { id: "release-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
    await step.sleepUntil("wait-for-10-minutes", tenMinutesLater);

    await step.run("check-payment-status", async () => {
      const bookingId = event.data.bookingId;

      const booking = await Booking.findById(bookingId);

      // If payment is not made, release seats and delete booking
      if (!booking.isPaid) {
        const show = await Show.findById(booking.show);
        booking.bookedSeats.forEach((seat) => {
          delete show.occupiedSeats[seat];
        });
        show.markModified("occupiedSeats");
        await show.save();
        await Booking.findByIdAndDelete(booking._id);
      }
    });
  }
);

// Inngest function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event, step }) => {
    const { bookingId } = event.data;

    const booking = await Booking.findById(bookingId)
      .populate({
        path: "show",
        populate: { path: "movie", model: "Movie" },
      })
      .populate("user");

    await sendEmail({
      to: booking.user.email,
      subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
      body: `<div style="font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f5f7fa; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <div style="background-color: #F84565; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎬 Your Booking is Confirmed!</h1>
    </div>

    <div style="padding: 30px;">
      <p style="font-size: 18px; margin: 0 0 15px;">Hi <strong>${
        booking.user.name
      }</strong>,</p>
      <p style="font-size: 16px; margin: 0 0 20px;">
        Thank you for booking with <strong>Cinemate</strong>. Your ticket for 
        <span style="color: #F84565;"><strong>"${
          booking.show.movie.title
        }"</strong></span> has been successfully confirmed.
      </p>

      <div style="border: 1px solid #eee; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
        <p style="margin: 5px 0;"><strong>🎥 Movie:</strong> ${
          booking.show.movie.title
        }</p>
        <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${new Date(
          booking.show.showDateTime
        ).toLocaleDateString("en-US", { timeZone: "Asia/Kuala_Lumpur" })}</p>
        <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${new Date(
          booking.show.showDateTime
        ).toLocaleTimeString("en-US", { timeZone: "Asia/Kuala_Lumpur" })}</p>
        <p style="margin: 5px 0;"><strong>💺 Seats:</strong> ${booking.bookedSeats.join(
          ", "
        )}</p>
      </div>

      <p style="font-size: 15px; margin-bottom: 20px;">We hope you have an amazing movie experience! 🍿</p>

      <div style="text-align: center;">
        <a href="https://cinemate.app/bookings/${
          booking._id
        }" style="background-color: #F84565; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Booking
        </a>
      </div>
    </div>

    <div style="background-color: #f1f1f1; text-align: center; padding: 20px; font-size: 13px; color: #777;">
      <p style="margin: 0;">This email was sent by NRoxas@Cinemate • © 2025 All rights reserved.</p>
    </div>
  </div>
</div>`,
    });
  }
);

// Inngest function to send reminders
const sendShowReminders = inngest.createFunction(
  { id: "send-show-reminders" },
  { cron: "0 */8 * * *" }, // Every 8 hours
  async ({ step }) => {
    const now = new Date();
    const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const windowStart = new Date(in8Hours.getTime() - 10 * 60 * 1000);

    // Prepare reminder tasks
    const reminderTasks = await step.run("prepare-reminder-tasks", async () => {
      const shows = await Show.find({
        showTime: { $gte: windowStart, $lte: in8Hours },
      }).populate("movie");

      const tasks = [];

      for (const show of shows) {
        if (!show.movie || !show.occupiedSeats) continue;

        const userIds = [...new Set(Object.values(show.occupiedSeats))];

        if (userIds.length === 0) continue;

        const users = await User.find({ _id: { $in: userIds } }).select(
          "name email"
        );

        for (const user of users) {
          tasks.push({
            userEmail: user.email,
            userName: user.name,
            movieTitle: show.movie.title,
            showTime: show.showTime,
          });
        }
      }
      return tasks;
    });

    if (reminderTasks.length === 0) {
      return { sent: 0, message: "No reminders to send." };
    }

    // Send reminder emails
    const results = await step.run("send-all-reminders", async () => {
      return await Promise.allSettled(
        reminderTasks.map((task) =>
          sendEmail({
            to: task.userEmail,
            subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
            body: `<div style="font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f9; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="background-color: #FFA726; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 22px;">🎬 Don't Miss Your Show!</h2>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 18px; margin: 0 0 15px;">Hi <strong>${task.userName}</strong>,</p>
          <p style="font-size: 16px; margin: 0 0 20px;">
            This is a friendly reminder that your movie 
            <span style="color: #FFA726;"><strong>"${task.movieTitle}"</strong></span> is starting soon.
          </p>

          <div style="border: 1px solid #eee; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
            <p style="margin: 5px 0;"><strong>🎥 Movie:</strong> ${task.movieTitle}</p>
            <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${task.showDate}</p>
            <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${task.showTime}</p>
            <p style="margin: 5px 0;"><strong>💺 Seats:</strong> ${task.seats}</p>
          </div>

          <p style="font-size: 15px; margin-bottom: 20px;">
            Please arrive 10–15 minutes early to avoid any delays.
          </p>

          <div style="text-align: center;">
            <a href="${task.bookingLink}" style="background-color: #FFA726; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Booking
            </a>
          </div>
        </div>

        <div style="background-color: #f1f1f1; text-align: center; padding: 20px; font-size: 13px; color: #777;">
          <p style="margin: 0;">This reminder was sent by NRoxas@Cinemate • © 2025 All rights reserved.</p>
        </div>
      </div>
    </div>`,
          })
        )
      );
    });

    const sent = results.filter((r) => r.status === "fullfilled").length;
    const failed = results.length - sent;

    return {
      sent,
      failed,
      message: `Sent ${sent} reminder(s), ${failed} failed.`,
    };
  }
);

// Inngest function to send notifications when a new show is added
const sendNewShowNotifications = inngest.createFunction(
  { id: "send-new-show-notifications" },
  { event: "app/show.added" },
  async ({ event }) => {
    const { movieTitle } = event.data;

    const users = await User.find({});

    for (const user of users) {
      const userEmail = user.email;
      const userName = user.name;

      const subject = `🎬 New Show Added: ${movieTitle}`;
      const body = `<div style="font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f9; padding: 30px;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background-color: #F84565; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🎉 A New Show Just Dropped!</h1>
            </div>

            <div style="padding: 30px;">
              <p style="font-size: 18px; margin: 0 0 15px;">Hi <strong>${userName}</strong>,</p>
              <p style="font-size: 16px; margin: 0 0 20px;">
                A new show for <strong style="color: #F84565;">"${movieTitle}"</strong> has been added on <strong>Cinemate</strong>! 🍿
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://cinemate-peach.vercel.app/movies" style="background-color: #F84565; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Check Showtimes
                </a>
              </div>

              <p style="font-size: 15px;">Book early to get the best seats. See you there!</p>
            </div>

            <div style="background-color: #f1f1f1; text-align: center; padding: 20px; font-size: 13px; color: #777;">
              <p style="margin: 0;">This email was sent by NRoxas@Cinemate • © 2025 All rights reserved.</p>
            </div>
          </div>
        </div>`;
      await sendEmail({
        to: userEmail,
        subject,
        body,
      });
    }
    return { message: "Notification sent." };
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
  sendShowReminders,
  sendNewShowNotifications,
];
