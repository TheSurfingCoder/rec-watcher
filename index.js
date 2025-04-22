require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// MongoDB connection options
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

// MongoDB Schema and Model
const slotSchema = new mongoose.Schema({
  date: String,
  court: String,
  sport: String,
  time: String,
});

const Slot = mongoose.model('Slot', slotSchema);

// Send email alert
function sendEmailNotification(slots) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Group and format slots by date
  const grouped = slots.reduce((acc, slot) => {
    acc[slot.date] = acc[slot.date] || [];
    acc[slot.date].push(`- ${slot.sport} | Court ${slot.court} at ${slot.time}`);
    return acc;
  }, {});

  let slotText = '';
  for (const date in grouped) {
    slotText += `📅 ${date}:\n${grouped[date].join('\n')}\n\n`;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: '🎯 New Booking Slot(s) Available at REC!',
    text: `Here are the new available slots over the next 7 days:\n\n${slotText}Book now: https://www.rec.us/locations/81cd2b08-8ea6-40ee-8c89-aeba92506576?tab=book-now`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ Failed to send email:', error.message);
    } else {
      console.log('✅ Email sent:', info.response);
    }
  });
}

// Fetch slots for a single date
async function fetchAvailableSlotsForDate(dateString) {
  try {
    const response = await axios.get(`${process.env.BASE_URL}${dateString}`);
    const data = response.data;

    const dateKey = Object.keys(data.dates)[0];
    const daySchedule = data.dates[dateKey];

    const reservableSlots = [];

    daySchedule.forEach(court => {
      const { courtNumber, sports, schedule } = court;

      for (const timeBlock in schedule) {
        const entry = schedule[timeBlock];

        if (entry.referenceType === "RESERVABLE") {
          reservableSlots.push({
            date: dateKey,
            court: courtNumber,
            sport: sports.map(s => s.name).join(', '),
            time: timeBlock
          });
        }
      }
    });

    return reservableSlots;

  } catch (err) {
    console.error(`❌ Failed to fetch for ${dateString}:`, err.message);
    return [];
  }
}

// Loop through the next 7 days
async function fetchSlotsForNext7Days() {
  const today = new Date();
  const promises = [];

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const isoDate = checkDate.toISOString().split('T')[0];
    promises.push(fetchAvailableSlotsForDate(isoDate));
  }

  const results = await Promise.all(promises);
  return results.flat();
}

async function fetchSlots() {
  return await Slot.find();
}

async function saveSlots(slots) {
  await Slot.deleteMany(); // Clear old slots
  await Slot.insertMany(slots); // Insert new slots
}

// Main comparison and notification logic
async function checkForNewSlots() {
  const newSlots = await fetchSlotsForNext7Days();
  if (!newSlots.length) {
    console.log('No available slots. ⏳');
    return;
  }

  let oldSlots = await fetchSlots();

  const newDataString = JSON.stringify(newSlots);
  const oldDataString = JSON.stringify(oldSlots);

  if (newDataString !== oldDataString) {
    console.log('🎉 New slots detected!');
    sendEmailNotification(newSlots);
    await saveSlots(newSlots);
  } else {
    console.log('No changes in slot availability.');
  }
}

// MongoDB connection and execution
async function run() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("✅ Pinged your deployment. Successfully connected to MongoDB!");

    // Run your main function
    await checkForNewSlots();
  } catch (error) {
    console.error("❌ Error during execution:", error.message);
  } finally {
    // Ensure the MongoDB connection is closed
    await mongoose.disconnect();
    console.log("✅ MongoDB connection closed.");
  }
}

// Execute the script
run().catch(console.error);
