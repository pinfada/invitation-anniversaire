// server/models/guest.js
const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  uniqueCode: { 
    type: String, 
    required: true, 
    unique: true 
  },
  attending: { 
    type: Boolean, 
    default: null 
  },
  guests: { 
    type: Number, 
    default: 0 
  },
  message: { 
    type: String 
  },
  needsAccommodation: { 
    type: Boolean, 
    default: false 
  },
  personalWelcomeMessage: { 
    type: String, 
    default: "Nous sommes ravis de vous accueillir à notre fête!" 
  },
  hasCheckedIn: { 
    type: Boolean, 
    default: false 
  },
  checkInTime: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Guest = mongoose.model('Guest', guestSchema);

module.exports = Guest;