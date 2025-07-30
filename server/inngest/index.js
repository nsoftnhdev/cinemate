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
              ).toLocaleDateString("en-US", {
                timeZone: "Asia/Kuala_Lumpur",
              })}</p>
              <p style="margin: 5px 0;"><strong>🕒 Time:</strong> ${new Date(
                booking.show.showDateTime
              ).toLocaleTimeString("en-US", {
                timeZone: "Asia/Kuala_Lumpur",
              })}</p>
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

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
];
