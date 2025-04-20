const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const API_URL = 'https://api.rec.us/v1/locations/81cd2b08-8ea6-40ee-8c89-aeba92506576/schedule?startDate=2025-04-20';
const CACHE_FILE = 'slots.json';

async function fetchSlots() {
  try {
    const response = await axios.get(API_URL);
    return JSON.stringify(response.data);
  } catch (err) {
    console.error('Error fetching slots:', err.message);
    return null;
  }
}

function sendEmailNotification() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your_email@gmail.com',
      pass: 'your_app_password'
    }
  });

  const mailOptions = {
    from: 'your_email@gmail.com',
    to: 'your_email@gmail.com',
    subject: 'New Booking Slots Available!',
    text: 'Go check REC — a new time slot just opened up!'
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error('Email failed:', error);
    else console.log('Email sent:', info.response);
  });
}

async function checkForNewSlots() {
  const newData = await fetchSlots();
  if (!newData) return;

  let oldData = null;
  if (fs.existsSync(CACHE_FILE)) {
    oldData = fs.readFileSync(CACHE_FILE, 'utf-8');
  }

  if (newData !== oldData) {
    console.log('New slots detected! 🎉');
    sendEmailNotification();
    fs.writeFileSync(CACHE_FILE, newData);
  } else {
    console.log('No new slots yet. ⏳');
  }
}

// Run every 10 minutes
cron.schedule('*/10 * * * *', checkForNewSlots);

// Run immediately once
checkForNewSlots();
