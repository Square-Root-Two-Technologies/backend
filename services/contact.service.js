const ConsultationRequest = require("../models/ConsultationRequest");

async function saveRequest({ name, email, company, message }) {
  const newRequest = new ConsultationRequest({
    name,
    email,
    company: company || null,
    message,
    status: "New",
    emailedInBatch: false,
  });

  await newRequest.save();
  console.log(`New consultation request received from: ${email}`);
  return newRequest;
}

async function listRequests() {
  return ConsultationRequest.find({}).sort({ createdAt: -1 });
}

module.exports = { saveRequest, listRequests };
