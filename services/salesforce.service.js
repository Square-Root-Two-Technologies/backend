// services/salesforce.service.js
const crypto = require("crypto");
const config = require("../config/index");

const LOGIN_BASE = "https://login.salesforce.com";
const API_VERSION = "62.0";

function buildAuthorizeUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.salesforce.clientId,
    redirect_uri: config.salesforce.callbackUrl,
    scope: "api refresh_token",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${LOGIN_BASE}/services/oauth2/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code, codeVerifier) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.salesforce.clientId,
    client_secret: config.salesforce.clientSecret,
    redirect_uri: config.salesforce.callbackUrl,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${LOGIN_BASE}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || "Failed to exchange code for token");
    err.statusCode = 400;
    throw err;
  }
  return data; // { access_token, refresh_token, instance_url, id, ... }
}

async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.salesforce.clientId,
    client_secret: config.salesforce.clientSecret,
  });

  const res = await fetch(`${LOGIN_BASE}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || "Failed to refresh Salesforce token");
    err.statusCode = 401;
    throw err;
  }
  return data; // { access_token, instance_url, ... }
}

async function getIdentity(idUrl, accessToken) {
  const res = await fetch(idUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error("Failed to fetch Salesforce identity");
    err.statusCode = 400;
    throw err;
  }
  return res.json(); // { user_id, organization_id, username, ... }
}

async function getOrgInfo(instanceUrl, accessToken) {
  const query = encodeURIComponent("SELECT IsSandbox, OrganizationType FROM Organization LIMIT 1");
  const res = await fetch(`${instanceUrl}/services/data/v${API_VERSION}/query?q=${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error("Failed to look up Salesforce org type");
    err.statusCode = 400;
    throw err;
  }
  const data = await res.json();
  const record = data.records && data.records[0];
  return {
    isSandbox: !!(record && record.IsSandbox),
    organizationType: record ? record.OrganizationType : null,
  };
}

function decodeXmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractField(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>|<${name}[^>]*/>`));
  if (!match) return null;
  const value = (match[1] ?? "").trim();
  return value === "" ? null : decodeXmlEntities(value);
}

async function executeAnonymous(instanceUrl, accessToken, apexCode) {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:apex="http://soap.sforce.com/2006/08/apex">
  <soapenv:Header>
    <apex:DebuggingHeader>
      <apex:categories>
        <apex:category>Apex_code</apex:category>
        <apex:level>DEBUG</apex:level>
      </apex:categories>
    </apex:DebuggingHeader>
    <apex:SessionHeader>
      <apex:sessionId>${accessToken}</apex:sessionId>
    </apex:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <apex:executeAnonymous>
      <apex:String><![CDATA[${apexCode}]]></apex:String>
    </apex:executeAnonymous>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(`${instanceUrl}/services/Soap/s/${API_VERSION}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=UTF-8",
      SOAPAction: '""',
    },
    body: soapEnvelope,
  });

  const xml = await res.text();
  if (!res.ok) {
    const err = new Error("Salesforce rejected the executeAnonymous request");
    err.statusCode = res.status === 401 ? 401 : 502;
    throw err;
  }

  const logMatch = xml.match(/<debugLog>([\s\S]*?)<\/debugLog>/);

  return {
    compiled: extractField(xml, "compiled") === "true",
    success: extractField(xml, "success") === "true",
    line: Number(extractField(xml, "line")) || null,
    column: Number(extractField(xml, "column")) || null,
    compileProblem: extractField(xml, "compileProblem"),
    exceptionMessage: extractField(xml, "exceptionMessage"),
    exceptionStackTrace: extractField(xml, "exceptionStackTrace"),
    debugLog: logMatch ? decodeXmlEntities(logMatch[1]) : "",
  };
}

function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  generatePkcePair,
  refreshAccessToken,
  getIdentity,
  getOrgInfo,
  executeAnonymous,
};
